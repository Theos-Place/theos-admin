/**
 * Calcula starts_at (mes/año del nombre del grupo; enero por defecto) y
 * ends_at (inicio + duración del plan en semanas) para los study_groups.
 * Dry-run por defecto. Aplicar: --apply
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
for (const f of ['../.env.local', '../.env']) {
  try { const t = readFileSync(new URL(f, import.meta.url), 'utf8'); for (const l of t.split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') } } catch { /* */ }
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } })

const MONTHS: Array<[RegExp, number]> = [
  [/\benero\b/i, 1], [/\bfebrero\b|\bfeb\b/i, 2], [/\bmarzo\b|\bmar\b/i, 3], [/\babril\b|\babr\b/i, 4],
  [/\bmayo\b/i, 5], [/\bjunio\b|\bjun\b/i, 6], [/\bjulio\b|\bjul\b/i, 7], [/\bagosto\b|\bago\b/i, 8],
  [/\bsetiembre\b|\bseptiembre\b|\bsept?\b|\bset\b/i, 9], [/\boctubre\b|\boct\b/i, 10],
  [/\bnoviembre\b|\bnov\b/i, 11], [/\bdiciembre\b|\bdic\b/i, 12],
]

function parseStart(name: string): string | null {
  // año: 4 dígitos (19/20xx) o 2 dígitos tras un mes ("Oct 22")
  let year: number | null = null
  const y4 = name.match(/\b(19|20)\d{2}\b/)
  if (y4) year = Number(y4[0])
  else { const y2 = name.match(/\b([012]\d)\b(?!\d)/); if (y2 && Number(y2[1]) <= 26) year = 2000 + Number(y2[1]) }
  if (!year) return null
  let month = 1
  for (const [re, n] of MONTHS) if (re.test(name)) { month = n; break }
  return `${year}-${String(month).padStart(2, '0')}-01`
}

function addWeeks(dateStr: string, weeks: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + weeks * 7)
  return d.toISOString().slice(0, 10)
}

async function fetchAll<T>(table: string, select: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) { const { data, error } = await supabase.from(table).select(select).range(from, from + 999); if (error) throw error; out.push(...(data as T[])); if (!data || data.length < 1000) break }
  return out
}

async function main() {
  const groups = await fetchAll<{ id: string; name: string; plan: { duration_weeks: number | null } | null }>(
    'study_groups', 'id, name, plan:study_plans(duration_weeks)')

  let toUpdate = 0, noDate = 0, withEnd = 0
  const updates: Array<{ id: string; starts_at: string; ends_at: string | null }> = []
  const samples: string[] = []
  for (const g of groups) {
    const start = parseStart(g.name)
    if (!start) { noDate++; continue }
    const weeks = g.plan?.duration_weeks ?? null
    const end = weeks ? addWeeks(start, weeks) : null
    if (end) withEnd++
    updates.push({ id: g.id, starts_at: start, ends_at: end })
    toUpdate++
    if (samples.length < 12) samples.push(`${g.name}  →  ${start}${end ? ' … ' + end : ''} (${weeks ?? '?'} sem)`)
  }

  console.log(`Grupos: ${groups.length}`)
  console.log(`A actualizar (con fecha): ${toUpdate} · con fecha fin: ${withEnd} · sin año en nombre: ${noDate}`)
  console.log('\nMuestras:'); samples.forEach(s => console.log('  ', s))

  if (!APPLY) { console.log('\n(dry-run) Corré con --apply para escribir.'); return }

  let ok = 0
  for (const u of updates) {
    const { error } = await supabase.from('study_groups').update({ starts_at: u.starts_at, ends_at: u.ends_at }).eq('id', u.id)
    if (error) { console.error('\n', u.id, error.message); continue }
    ok++; if (ok % 200 === 0) process.stdout.write(`\rActualizados: ${ok}/${updates.length}`)
  }
  console.log(`\nActualizados: ${ok}`)
}

main()
