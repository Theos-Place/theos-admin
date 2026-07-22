/**
 * Migración de donaciones nuevas (2026-07-21). Inserta en `donations` las filas de
 * data-import/donaciones_migration.csv que NO estén ya registradas, y marca
 * members.is_donor = true para todos los donadores.
 *   cols: member_external_id, donation_date (YYYY-MM-DD), amount (siempre 0), source_group
 *
 * - member: member_external_id → members.external_id. Sin match → skip + warn.
 * - Dedup: no inserta si ya hay una donación de ese miembro en esa misma fecha
 *   (ni en la BD ni repetida dentro del propio CSV).
 * - amount = 0 es intencional (monto real desconocido, consistente con lo existente).
 * - source_group → donations.source_file (trazabilidad). is_identified = true.
 * - Lotes de 500. Sin transacción global: si un lote falla, reintenta fila a fila.
 *
 * Dry-run:   npx tsx scripts/import-donaciones-migration.ts --dry-run
 * Ejecución: npx tsx scripts/import-donaciones-migration.ts --run
 */
import { readFileSync } from 'node:fs'
import { parse } from 'csv-parse/sync'
import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')
const RUN = process.argv.includes('--run')
if (!DRY_RUN && !RUN) { console.error('Pasá --dry-run o --run.'); process.exit(1) }

for (const f of ['../.env.local', '../.env']) {
  try {
    const t = readFileSync(new URL(f, import.meta.url), 'utf8')
    for (const l of t.split('\n')) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* */ }
}
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!,
  { auth: { persistSession: false } },
)

const CSV = new URL('../data-import/donaciones_migration.csv', import.meta.url)
const BATCH = 500
const str = (v: unknown): string => (v == null ? '' : String(v).trim())
const extId = (v: unknown): string => str(v).replace(/\.0$/, '')

async function fetchAll<T>(table: string, cols: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(cols).range(from, from + 999)
    if (error) throw error
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < 1000) break
  }
  return out
}

async function main() {
  console.log(`\n=== Migración de donaciones ${DRY_RUN ? '(DRY-RUN)' : '(REAL)'} ===\n`)

  // Miembros por external_id + su is_donor actual (para contar cuántos se marcan).
  const members = await fetchAll<{ id: string; external_id: string | null; is_donor: boolean | null }>('members', 'id, external_id, is_donor')
  const byExt = new Map<string, string>()
  const isDonorNow = new Map<string, boolean>()
  for (const m of members) {
    if (m.external_id) byExt.set(extId(m.external_id), m.id)
    isDonorNow.set(m.id, m.is_donor === true)
  }

  // Donaciones ya registradas: clave member_id|donation_date para dedup.
  const existingDon = await fetchAll<{ member_id: string | null; donation_date: string }>('donations', 'member_id, donation_date')
  const seen = new Set<string>()
  for (const d of existingDon) if (d.member_id) seen.add(`${d.member_id}|${d.donation_date}`)

  const rows = parse(readFileSync(CSV), { columns: true, bom: true, skip_empty_lines: true, relax_column_count: true }) as Array<Record<string, string>>

  const now = new Date().toISOString()
  let skipMember = 0, skipDup = 0
  const toInsert: Array<Record<string, unknown>> = []
  const donorIds = new Set<string>()          // todos los donadores (con match), para is_donor

  for (const r of rows) {
    const memberId = byExt.get(extId(r.member_external_id))
    if (!memberId) { skipMember++; console.warn(`  skip: external_id ${str(r.member_external_id)} sin match en members`); continue }
    donorIds.add(memberId)                      // es donador aunque la donación ya exista
    const date = str(r.donation_date)
    const key = `${memberId}|${date}`
    if (seen.has(key)) { skipDup++; continue }   // ya registrada (BD o repetida en el CSV)
    seen.add(key)
    toInsert.push({
      member_id: memberId,
      donation_date: date,
      amount: 0,
      source_file: str(r.source_group) || null,
      is_identified: true,
      imported_at: now,
      created_at: now,
    })
  }

  // Miembros que pasarán de no-donador a donador (para el conteo del reporte).
  const toMarkDonor = [...donorIds].filter(id => !isDonorNow.get(id))

  let inserted = 0
  if (!DRY_RUN) {
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const chunk = toInsert.slice(i, i + BATCH)
      const { error } = await supabase.from('donations').insert(chunk)
      if (error) {
        // Reintento fila a fila: no perder el lote entero por una fila mala.
        for (const p of chunk) {
          const { error: e2 } = await supabase.from('donations').insert(p)
          if (e2) console.warn(`  insert falló (member ${p.member_id}, ${p.donation_date}): ${e2.message}`)
          else inserted++
        }
      } else {
        inserted += chunk.length
      }
    }
    // Marcar is_donor en lotes de 500.
    for (let i = 0; i < toMarkDonor.length; i += BATCH) {
      const chunk = toMarkDonor.slice(i, i + BATCH)
      const { error } = await supabase.from('members').update({ is_donor: true, updated_at: now }).in('id', chunk)
      if (error) console.warn(`  update is_donor falló (lote ${i / BATCH}): ${error.message}`)
    }
  } else {
    inserted = toInsert.length
  }

  console.log('──────── Reporte ────────')
  console.log(`✅ Donaciones insertadas:            ${inserted}`)
  console.log(`✅ Miembros marcados is_donor:       ${toMarkDonor.length}`)
  console.log(`⚠️  Skipped (ya registrada):          ${skipDup}`)
  console.log(`⚠️  Skipped (member no encontrado):   ${skipMember}`)
  console.log(`   (donadores totales con match:     ${donorIds.size})`)
  console.log(DRY_RUN ? '\n(DRY-RUN: no se escribió nada)\n' : '\nListo.\n')
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
