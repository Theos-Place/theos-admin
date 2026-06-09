/**
 * Restaura los volunteers (servidores) que se perdieron al recargar miembros.
 * - member por external_id (paginado; el bug del tope de 1000 fue lo que rompió el import original)
 * - puesto por (comité normalizado, título) contra los puestos ACTUALES
 *   aplicando data-import/normalizar-comites.csv (nombre viejo → destino)
 * Dry-run por defecto. Aplicar: npx tsx scripts/restore-volunteers.ts --apply
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
for (const f of ['../.env.local', '../.env']) {
  try { const t = readFileSync(new URL(f, import.meta.url), 'utf8'); for (const l of t.split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') } } catch { /* */ }
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } })

function parseCSV(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], f = '', q = false
  for (let i = 0; i < text.length; i++) { const c = text[i]
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++ } else q = false } else f += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(f); f = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.some(x => x !== '')) rows.push(row); row = [] }
    else f += c }
  if (f !== '' || row.length) { row.push(f); if (row.some(x => x !== '')) rows.push(row) }
  return rows
}
const url = (p: string) => new URL('../data-import/' + p, import.meta.url)

// normalizar: nombre viejo -> destino (omite inactivar)
const normRows = parseCSV(readFileSync(url('normalizar-comites.csv'), 'utf8')).slice(1)
const renameMap = new Map<string, string>()
for (const r of normRows) { const [actual, accion, destino] = r; if (accion === 'inactivar') continue; renameMap.set(actual.trim(), (destino || actual).trim()) }
// Override: el comité final quedó como "Charlistas" (un rename posterior revirtió el merge a "Comité de Charlas").
renameMap.set('Charlistas', 'Charlistas')
const committeeFor = (name: string) => renameMap.get(name.trim()) ?? name.trim()

// srv-servidores
const srvRows = parseCSV(readFileSync(url('srv-servidores.csv'), 'utf8'))
const hi = srvRows.findIndex(r => r[0]?.trim() === 'member_external_id')
const header = srvRows[hi].map(h => h.trim())
const srv = srvRows.slice(hi + 1).map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])))

async function fetchAll<T>(table: string, select: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + 999)
    if (error) throw error
    out.push(...(data as T[])); if (!data || data.length < 1000) break
  }
  return out
}

async function main() {
  const members = await fetchAll<{ id: string; external_id: string | null }>('members', 'id, external_id')
  const extMap = new Map<string, string>()
  for (const m of members) if (m.external_id) extMap.set(String(m.external_id), m.id)

  const positions = await fetchAll<{ id: string; title: string; area: { name: string } | null }>('service_positions', 'id, title, area:areas(name)')
  const posByKey = new Map<string, string>()
  for (const p of positions) if (p.area) posByKey.set(`${p.area.name}||${p.title}`, p.id)

  const vols: Array<{ member_id: string; position_id: string; status: string; start_date: string | null }> = []
  let noMember = 0, noPos = 0
  const missPos = new Map<string, number>()
  const seen = new Set<string>()
  for (const s of srv) {
    const mid = extMap.get(String(s.member_external_id))
    if (!mid) { noMember++; continue }
    const comite = committeeFor(s.comite)
    const pid = posByKey.get(`${comite}||${s.puesto}`)
    if (!pid) { noPos++; const k = `${comite} || ${s.puesto}`; missPos.set(k, (missPos.get(k) ?? 0) + 1); continue }
    const key = `${mid}|${pid}`; if (seen.has(key)) continue; seen.add(key)
    vols.push({ member_id: mid, position_id: pid, status: s.status || 'active', start_date: s.fecha_inicio || null })
  }

  console.log(`srv filas: ${srv.length}`)
  console.log(`resueltos (a insertar): ${vols.length}`)
  console.log(`sin miembro: ${noMember} · sin puesto: ${noPos}`)
  if (missPos.size) { console.log('Puestos no resueltos (top 15):'); [...missPos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([k, n]) => console.log(`  ${n}\t${k}`)) }

  if (!APPLY) { console.log('\n(dry-run) Corré con --apply para escribir.'); return }

  let ok = 0
  for (let i = 0; i < vols.length; i += 300) {
    const chunk = vols.slice(i, i + 300)
    const { error } = await supabase.from('volunteers').upsert(chunk, { onConflict: 'member_id,position_id', ignoreDuplicates: true })
    if (error) { console.error('\nError lote', i, error.message); process.exit(1) }
    ok += chunk.length; process.stdout.write(`\rInsertados: ${ok}/${vols.length}`)
  }
  console.log(`\nVolunteers restaurados: ${ok}`)
}

main()
