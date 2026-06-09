/**
 * Asigna co_leader_id en study_groups desde grupos.csv:
 * si un grupo tiene 2+ leaders reales (Ind ID != 12965), el que NO tiene su nombre
 * en el nombre del grupo es el co-dirigente.
 * Dry-run por defecto. Aplicar: --apply
 */
import { readFileSync } from 'node:fs'
import { parse } from 'csv-parse/sync'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
for (const f of ['../.env.local', '../.env']) {
  try { const t = readFileSync(new URL(f, import.meta.url), 'utf8'); for (const l of t.split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') } } catch { /* */ }
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } })
const ORG = '12965'

async function fetchAll<T>(table: string, select: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) { const { data, error } = await supabase.from(table).select(select).range(from, from + 999); if (error) throw error; out.push(...(data as T[])); if (!data || data.length < 1000) break }
  return out
}

async function main() {
  const recs: Record<string, string>[] = parse(readFileSync(new URL('../data-import/grupos.csv', import.meta.url), 'utf8'), { columns: true, bom: true, relax_quotes: true, relax_column_count: true, skip_empty_lines: true })
  const members = await fetchAll<{ id: string; external_id: string | null; first_name: string; last_name: string }>('members', 'id, external_id, first_name, last_name')
  const ext = new Map<string, { id: string; name: string }>()
  for (const m of members) if (m.external_id) ext.set(String(m.external_id), { id: m.id, name: `${m.first_name} ${m.last_name}`.toLowerCase() })
  const groups = await fetchAll<{ id: string; name: string }>('study_groups', 'id, name')
  const groupByName = new Map(groups.map(g => [g.name.trim(), g.id]))

  const byGroup = new Map<string, Record<string, string>[]>()
  for (const r of recs) { const g = (r['Group Name'] ?? '').trim(); if (!g) continue; const a = byGroup.get(g) ?? []; a.push(r); byGroup.set(g, a) }

  let withCo = 0, noGroup = 0
  const updates: Array<{ id: string; co: string }> = []
  for (const [name, rows] of byGroup) {
    const gid = groupByName.get(name); if (!gid) { continue }
    const leaders = rows.filter(r => (r['Most Recent Status'] ?? '').trim() === 'Leader' && (r['Ind ID'] ?? '').trim() !== ORG)
    const ids = [...new Set(leaders.map(r => ext.get((r['Ind ID'] ?? '').trim())?.id).filter(Boolean))] as string[]
    if (ids.length < 2) continue
    const nameLc = name.toLowerCase()
    // main = el que tiene su nombre en el grupo
    const mainRow = leaders.find(r => { const m = ext.get((r['Ind ID'] ?? '').trim()); return m && m.name.split(' ').some(t => t.length > 2 && nameLc.includes(t)) })
    const mainId = mainRow ? ext.get((mainRow['Ind ID'] ?? '').trim())?.id : ids[0]
    const co = ids.find(i => i !== mainId)
    if (co) { updates.push({ id: gid, co }); withCo++ }
  }

  console.log(`Grupos con co-dirigente detectado: ${withCo}`)
  if (!APPLY) { console.log('(dry-run) Corré con --apply para escribir.'); return }
  let ok = 0
  for (const u of updates) { const { error } = await supabase.from('study_groups').update({ co_leader_id: u.co }).eq('id', u.id); if (!error) ok++ }
  console.log(`Actualizados: ${ok}`)
}

main()
