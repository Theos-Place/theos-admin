/**
 * Backfill de members.created_at desde el Excel maestro (Maestro_Asistentes.xlsx,
 * hoja "Total"), columna "Date Created" (fecha REAL de PCO). Match por external_id
 * (= "Individual ID"). Es la fuente de verdad de Power BI.
 *
 * Complementa el backfill desde bd-temp.csv: cubre los miembros que entraron por
 * seed-members-upsert.ts (que tampoco seteaba created_at) y reconcilia cualquier
 * diferencia con el maestro.
 *
 * Dry-run por defecto. Aplicar: npx tsx scripts/backfill-created-at-xlsx.ts --apply
 */
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')

for (const f of ['../.env.local', '../.env']) {
  try {
    const t = readFileSync(new URL(f, import.meta.url), 'utf8')
    for (const line of t.split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
  } catch { /* */ }
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } })

const pad = (n: number) => String(n).padStart(2, '0')
// "Date Created" puede venir como Date (SheetJS cellDates) o string YYYY-MM-DD.
// SheetJS arma las fechas en UTC → usamos componentes UTC para no correr el día.
// Fijamos a mediodía CR para que año/mes sean estables por zona horaria.
function toCreatedAt(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}T12:00:00-06:00`
  }
  const s = String(v ?? '').trim()
  const m = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}T12:00:00-06:00` : null
}

const wb = XLSX.read(readFileSync(new URL('./data/Maestro_Asistentes.xlsx', import.meta.url)), { type: 'buffer', cellDates: true })
const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Total'], { defval: '' })
const realDate = new Map<string, string>()
for (const r of rows) {
  const id = String(r['Individual ID'] ?? '').trim()
  const d = toCreatedAt(r['Date Created'])
  if (id && d && !realDate.has(id)) realDate.set(id, d)
}
console.log(`Excel: filas=${rows.length} · con Individual ID + Date Created válida=${realDate.size}`)

async function main() {
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
  let noMatch = 0, same = 0
  for (const m of withExt) {
    const neu = realDate.get(m.external_id!)
    if (!neu) { noMatch++; continue }
    if (m.created_at.slice(0, 7) === neu.slice(0, 7)) { same++; continue }
    changes.push({ id: m.id, ext: m.external_id!, old: m.created_at, neu })
  }

  const yearDelta = new Map<number, { from: number; to: number }>()
  const bump = (y: number, k: 'from' | 'to') => { const e = yearDelta.get(y) ?? { from: 0, to: 0 }; e[k]++; yearDelta.set(y, e) }
  for (const c of changes) { bump(Number(c.old.slice(0, 4)), 'from'); bump(Number(c.neu.slice(0, 4)), 'to') }

  console.log(`\nCon external_id sin match en Excel: ${noMatch}`)
  console.log(`Ya en el mes/año correcto: ${same}`)
  console.log(`A CORREGIR (cambian de mes/año): ${changes.length}`)
  const stillBatch = changes.filter(c => c.old.slice(0, 10) === '2026-06-16').length
  console.log(`  de los cuales venían del batch 2026-06-16: ${stillBatch}`)
  console.log('\nImpacto por año (− salen / + entran):')
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
