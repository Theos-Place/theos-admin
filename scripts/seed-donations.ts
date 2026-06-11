/**
 * Importa donaciones históricas (2014–2026) desde scripts/data/group_participants.csv.
 * - Match por members.external_id (= "Ind ID" de PCO).
 * - donation_date según el trimestre del nombre del grupo.
 * - amount = 0 (se actualizará desde QuickBooks).
 * - Dedup: member_id + donation_date + source_file 'group_participants_import%'.
 * - Sin match → scripts/output/donations-no-match.csv para revisión manual.
 *
 * Dry-run por defecto (no escribe nada). Aplicar:
 *   npx tsx scripts/seed-donations.ts --apply
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { parse } from 'csv-parse/sync'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')

for (const f of ['../.env.local', '../.env']) {
  try {
    const t = readFileSync(new URL(f, import.meta.url), 'utf8')
    for (const line of t.split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
  } catch { /* */ }
}
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!,
  { auth: { persistSession: false } },
)

// ── Fecha del trimestre según el nombre del grupo ────────────────────────────
// El orden importa: los rangos (Ene-Mar, Oct-Dic…) van antes que los sueltos
// (Dic 2015, Jul 2014). "Madrid Oct - Dic" cae en la regla de Oct-Dic.
const DATE_RULES: Array<[RegExp, string]> = [
  [/Ene\s*-\s*Mar\s+(\d{4})/, '01-01'],
  [/Abr\s*-\s*Jun\s+(\d{4})/, '04-01'],
  [/Jul\s*-\s*Set\s+(\d{4})/, '07-01'],
  [/Oct\s*-\s*Dic\s+(\d{4})/, '10-01'],
  [/Ene\s*-\s*Dic\s+(\d{4})/, '01-01'],
  [/UPPT\s+(\d{4})/, '01-01'],
  [/Dic\s+(\d{4})/, '10-01'],
  [/Jul\s+(\d{4})/, '07-01'],
]

function dateForGroup(groupName: string): string | null {
  for (const [re, monthDay] of DATE_RULES) {
    const m = groupName.match(re)
    if (m) return `${m[1]}-${monthDay}`
  }
  return null
}

async function main() {
  // ── CSV ──
  const raw = readFileSync(new URL('./data/group_participants.csv', import.meta.url), 'utf8')
  const records: Record<string, string>[] = parse(raw, { columns: true, bom: true, skip_empty_lines: true, trim: true })
  console.log(`CSV: ${records.length.toLocaleString()} registros`)

  // Validar que todos los grupos mapean a fecha antes de tocar nada.
  const unknownGroups = new Set<string>()
  for (const r of records) {
    if (!dateForGroup(r['Group Name'] ?? '')) unknownGroups.add(r['Group Name'] ?? '(vacío)')
  }
  if (unknownGroups.size) {
    console.error('✗ Grupos sin regla de fecha (corregir antes de importar):')
    for (const g of unknownGroups) console.error('  ·', g)
    process.exit(1)
  }

  // ── Miembros: external_id → uuid (paginado) ──
  const extToId = new Map<string, string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('members').select('id, external_id')
      .not('external_id', 'is', null)
      .order('id')
      .range(from, from + 999)
    if (error) throw error
    for (const m of data as Array<{ id: string; external_id: string }>) extToId.set(m.external_id, m.id)
    if (data.length < 1000) break
  }
  console.log(`Miembros con external_id: ${extToId.size.toLocaleString()}`)

  // ── Donaciones ya importadas (dedup) ──
  const existing = new Set<string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('donations').select('member_id, donation_date')
      .like('source_file', 'group_participants_import%')
      .order('id')
      .range(from, from + 999)
    if (error) throw error
    for (const d of data as Array<{ member_id: string | null; donation_date: string }>) {
      existing.add(`${d.member_id}|${d.donation_date}`)
    }
    if (data.length < 1000) break
  }
  console.log(`Donaciones ya importadas: ${existing.size.toLocaleString()}`)

  // ── Construir inserts ──
  type Insert = {
    member_id: string; donation_date: string; amount: number
    source_file: string; is_identified: boolean; imported_at: string
  }
  const inserts: Insert[] = []
  const noMatch: Array<{ ind_id: string; name: string; group: string }> = []
  let dupes = 0
  const importedAt = new Date().toISOString()

  for (const r of records) {
    const indId = (r['Ind ID'] ?? '').trim()
    const groupName = (r['Group Name'] ?? '').trim()
    const date = dateForGroup(groupName)!
    const memberId = extToId.get(indId)
    if (!memberId) {
      noMatch.push({ ind_id: indId, name: r['Name'] ?? '', group: groupName })
      continue
    }
    const key = `${memberId}|${date}`
    if (existing.has(key)) { dupes++; continue }
    existing.add(key) // dedup también dentro de esta corrida
    inserts.push({
      member_id: memberId,
      donation_date: date,
      amount: 0, // se actualizará desde QuickBooks
      source_file: `group_participants_import | ${groupName}`,
      is_identified: true,
      imported_at: importedAt,
    })
  }

  console.log(`\nPlan: insertar ${inserts.length.toLocaleString()} · sin match ${noMatch.length.toLocaleString()} · duplicados saltados ${dupes.toLocaleString()}`)

  // ── Sin match → CSV para revisión manual ──
  if (noMatch.length) {
    mkdirSync(new URL('./output/', import.meta.url), { recursive: true })
    const csv = ['ind_id,name,group', ...noMatch.map(n => `${n.ind_id},"${n.name.replace(/"/g, '""')}","${n.group}"`)].join('\n')
    writeFileSync(new URL('./output/donations-no-match.csv', import.meta.url), csv)
    console.log(`Sin match guardados en scripts/output/donations-no-match.csv`)
  }

  if (!APPLY) {
    console.log('\nDRY-RUN: no se insertó nada. Corré con --apply para aplicar.')
    return
  }

  // ── Insertar en batches de 100 ──
  let inserted = 0, failedBatches = 0
  for (let i = 0; i < inserts.length; i += 100) {
    const batch = inserts.slice(i, i + 100)
    const { error } = await supabase.from('donations').insert(batch)
    if (error) {
      failedBatches++
      console.error(`✗ Batch ${i / 100 + 1} falló: ${error.message} — continuando…`)
      continue
    }
    inserted += batch.length
    if (inserted % 1000 < 100 || inserted === inserts.length) {
      console.log(`✓ ${inserted.toLocaleString()} / ${inserts.length.toLocaleString()} procesados…`)
    }
  }

  console.log('\n── Resumen ──')
  console.log(`Insertados:          ${inserted.toLocaleString()}`)
  console.log(`Sin match:           ${noMatch.length.toLocaleString()} (scripts/output/donations-no-match.csv)`)
  console.log(`Duplicados saltados: ${dupes.toLocaleString()}`)
  if (failedBatches) console.log(`Batches fallidos:    ${failedBatches}`)
}

main().catch(e => { console.error('Error fatal:', e); process.exit(1) })
