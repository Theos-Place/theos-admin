/**
 * Backfill de members.created_at con la fecha REAL de PCO ("Date Created" del
 * CSV de origen), casando por external_id (= "Individual ID" del CSV).
 *
 * Motivo: import-members.ts nunca seteó created_at, así que todos los importados
 * quedaron con la fecha del import (DEFAULT NOW()) → el reporte de crecimiento
 * contaba "cuándo se importó", no "cuándo entró".
 *
 * Dry-run por defecto. Aplicar: npx tsx scripts/backfill-created-at.ts --apply
 */
import { readFileSync } from 'node:fs'
import { parse } from 'csv-parse/sync'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')

for (const f of ['../.env.local', '../.env']) {
  try {
    const t = readFileSync(new URL(f, import.meta.url), 'utf8')
    for (const line of t.split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
  } catch { /* */ }
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } })

// "Date Created" viene como YYYY/MM/DD (a veces con hora). Tomamos la fecha y la
// fijamos a mediodía hora CR para que el año/mes no se corra por zona horaria.
function parsePcoDate(v: string | undefined): string | null {
  const t = (v ?? '').trim()
  const m = t.match(/^(\d{4})\/(\d{2})\/(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}T12:00:00-06:00` : null
}

const raw = readFileSync(new URL('../data-import/bd-temp.csv', import.meta.url), 'utf8')
const records: Record<string, string>[] = parse(raw, { columns: true, bom: true, relax_quotes: true, relax_column_count: true, skip_empty_lines: true, trim: false })

// external_id (Individual ID) → fecha real de PCO
const realDate = new Map<string, string>()
for (const r of records) {
  const id = (r['Individual ID'] ?? '').trim()
  const d = parsePcoDate(r['Date Created'])
  if (id && d && !realDate.has(id)) realDate.set(id, d)
}
console.log(`CSV: filas=${records.length} · con Individual ID + Date Created válida=${realDate.size}`)

async function main() {
  // Trae todos los miembros con external_id.
  const members: Array<{ id: string; external_id: string | null; created_at: string }> = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('members').select('id, external_id, created_at').range(from, from + 999)
    if (error) throw error
    members.push(...(data as typeof members))
    if (!data || data.length < 1000) break
  }
  const withExt = members.filter(m => m.external_id)
  console.log(`BD: miembros=${members.length} · con external_id=${withExt.length}`)

  type Change = { id: string; ext: string; old: string; neu: string }
  const changes: Change[] = []
  let noMatch = 0, sameYear = 0
  for (const m of withExt) {
    const neu = realDate.get(m.external_id!)
    if (!neu) { noMatch++; continue }
    const oldYM = m.created_at.slice(0, 7)
    const newYM = neu.slice(0, 7)
    if (oldYM === newYM) { sameYear++; continue }
    changes.push({ id: m.id, ext: m.external_id!, old: m.created_at, neu })
  }

  // Resumen del impacto por año (cuántos miembros se mueven a qué año).
  const yearDelta = new Map<number, { from: number; to: number }>()
  const bump = (y: number, k: 'from' | 'to') => { const e = yearDelta.get(y) ?? { from: 0, to: 0 }; e[k]++; yearDelta.set(y, e) }
  for (const c of changes) { bump(Number(c.old.slice(0, 4)), 'from'); bump(Number(c.neu.slice(0, 4)), 'to') }

  console.log(`\nCon external_id sin match en CSV: ${noMatch}`)
  console.log(`Ya estaban en el mes/año correcto: ${sameYear}`)
  console.log(`A CORREGIR (cambian de mes/año): ${changes.length}`)
  console.log('\nImpacto por año (− salen del año / + entran al año):')
  for (const y of [...yearDelta.keys()].sort((a, b) => a - b)) {
    const e = yearDelta.get(y)!
    console.log(`  ${y}: -${e.from}  +${e.to}  (neto ${e.to - e.from > 0 ? '+' : ''}${e.to - e.from})`)
  }
  console.log('\nEjemplos:')
  for (const c of changes.slice(0, 8)) console.log(`  ext ${c.ext}: ${c.old.slice(0, 10)} → ${c.neu.slice(0, 10)}`)

  if (!APPLY) { console.log('\n(dry-run) Corré con --apply para escribir.'); return }

  let done = 0
  for (let i = 0; i < changes.length; i += 50) {
    const batch = changes.slice(i, i + 50)
    await Promise.all(batch.map(c => supabase.from('members').update({ created_at: c.neu }).eq('id', c.id)))
    done += batch.length
    process.stdout.write(`\rActualizados: ${done}/${changes.length}`)
  }
  console.log('\nListo.')
}

main()
