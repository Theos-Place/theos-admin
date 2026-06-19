/**
 * Importa miembros desde data-import/bd-temp.csv a Supabase.
 * - Inserta SOLO nuevos (dedup por external_id PCO, email o cédula contra la BD).
 * - Crea familias (Family ID con 2+ integrantes).
 * Dry-run por defecto. Aplicar: npx tsx scripts/import-members.ts --apply
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

const raw = readFileSync(new URL('../data-import/bd-temp.csv', import.meta.url), 'utf8')
const records: Record<string, string>[] = parse(raw, { columns: true, bom: true, relax_quotes: true, relax_column_count: true, skip_empty_lines: true, trim: false })

const SEDE_MAP: Record<string, string> = {
  'Pro Oeste (Meridiano)': 'meridiano', 'Pro Este (Antares)': 'antares', 'Heredia': 'heredia',
  'United': 'united', 'Liberia': 'liberia', 'Life (Escalante)': 'life-escalante',
  'Alajuela': 'alajuela', 'Cartago': 'cartago', 'Potrero': 'potrero', 'Guapiles': 'guapiles',
}
const MARITAL: Record<string, string> = { s: 'Soltero/a', m: 'Casado/a', d: 'Divorciado/a', w: 'Viudo/a', p: 'Unión libre' }
const REL: Record<string, string> = { 'primary contact': 'Titular', 'spouse': 'Cónyuge', 'child': 'Hijo/a', 'other': 'Otro' }

const clean = (v: string | undefined) => { const t = (v ?? '').trim(); return t && t !== '0' ? t : '' }
function normPhone(v: string | undefined): string | null {
  let d = clean(v).replace(/[^\d]/g, ''); if (!d) return null
  if (d.length === 11 && d.startsWith('506')) d = d.slice(3)
  if (d.length === 8) return `${d.slice(0, 4)}-${d.slice(4)}`
  return d || null
}
function parseDate(v: string | undefined): string | null { const t = clean(v); const m = t.match(/^(\d{4})\/(\d{2})\/(\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}` : null }
// created_at: fecha REAL de PCO ("Date Created"), a mediodía CR para que el
// año/mes no se corra por zona horaria. Sin ella, omitimos (DB usa DEFAULT NOW()).
function parseCreatedAt(v: string | undefined): string | undefined { const d = parseDate(v); return d ? `${d}T12:00:00-06:00` : undefined }
const norm = (s: string) => s.replace(/[-\s]/g, '').toLowerCase()
const G = (r: Record<string, string>, k: string) => r[k] ?? ''

type Person = {
  ext: string; first: string; last: string; emailLower: string; cedula: string
  famId: string; famPos: string; row: Record<string, unknown>; _id?: string
}

const persons: Person[] = []
for (const r of records) {
  const first = clean(G(r, 'First Name')).replace(/^[-.]+$/, '')
  const last = clean(G(r, 'Last Name')).replace(/^[-.]+$/, '')
  const email = clean(G(r, 'Email'))
  if (!first && !last && !email) continue
  const ext = clean(G(r, 'Individual ID'))
  const cedula = clean(G(r, 'Custom Fields - ID'))
  const allergiesRaw = clean(G(r, 'Allergies'))
  const allergies = /^\d+$/.test(allergiesRaw) ? '' : allergiesRaw
  const gender = ({ m: 'M', f: 'F' } as Record<string, string>)[clean(G(r, 'Gender')).toLowerCase()] ?? null
  persons.push({
    ext, first: first || '—', last: last || '—', emailLower: email.toLowerCase(), cedula,
    famId: clean(G(r, 'Family ID')), famPos: clean(G(r, 'Family Position')).toLowerCase(),
    row: {
      first_name: first || '—', last_name: last || '—',
      email: email || null,
      phone: normPhone(G(r, 'Mobile Phone')) ?? normPhone(G(r, 'Preferred Phone')) ?? normPhone(G(r, 'Home Phone')),
      cedula: cedula || null,
      birth_date: parseDate(G(r, 'Birthdate')),
      gender,
      marital_status: MARITAL[clean(G(r, 'Marital Status')).toLowerCase()] ?? null,
      occupation: clean(G(r, 'Custom Fields - Trabajo actual que realiza')) || null,
      workplace: clean(G(r, 'Custom Fields - Empresa en la que trabaja')) || null,
      address: clean(G(r, 'Home Street')) || null,
      allergies: allergies || null,
      emergency_contact_name: clean(G(r, 'Emergency Contact')) || null,
      emergency_contact_phone: normPhone(G(r, 'Emergency Phone')),
      sede_code: SEDE_MAP[clean(G(r, 'Custom Fields - Sede a la que asiste con mayor frecuencia'))] ?? null,
      is_active: !clean(G(r, 'Deceased')),
      external_id: ext || null,
      created_at: parseCreatedAt(G(r, 'Date Created')),
    },
  })
}

async function fetchAllExisting() {
  const out: Array<{ id: string; email: string | null; cedula: string | null; external_id: string | null }> = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('members').select('id, email, cedula, external_id').range(from, from + 999)
    if (error) throw error
    out.push(...(data as typeof out))
    if (!data || data.length < 1000) break
  }
  return out
}

async function main() {
  const { data: sedes } = await supabase.from('sedes').select('id, code')
  const sedeId: Record<string, string> = {}
  for (const s of (sedes ?? []) as Array<{ id: string; code: string }>) sedeId[s.code] = s.id

  const existing = await fetchAllExisting()
  const byEmail = new Map<string, string>(), byCedula = new Map<string, string>(), byExt = new Map<string, string>()
  for (const m of existing) {
    if (m.email) byEmail.set(m.email.toLowerCase(), m.id)
    if (m.cedula) byCedula.set(norm(m.cedula), m.id)
    if (m.external_id) byExt.set(m.external_id, m.id)
  }

  const memberIdByExt = new Map<string, string>()
  const toInsert: Person[] = []
  const seenEmail = new Set<string>(), seenCedula = new Set<string>(), seenExt = new Set<string>()
  let skipped = 0
  for (const p of persons) {
    const existId = (p.ext && byExt.get(p.ext)) || (p.emailLower && byEmail.get(p.emailLower)) || (p.cedula && byCedula.get(norm(p.cedula)))
    if (existId) { if (p.ext) memberIdByExt.set(p.ext, existId as string); skipped++; continue }
    if (p.ext && seenExt.has(p.ext)) continue
    if (p.emailLower && seenEmail.has(p.emailLower)) continue
    if (p.cedula && seenCedula.has(norm(p.cedula))) continue
    if (p.ext) seenExt.add(p.ext)
    if (p.emailLower) seenEmail.add(p.emailLower)
    if (p.cedula) seenCedula.add(norm(p.cedula))
    toInsert.push(p)
  }

  console.log(`Registros CSV válidos: ${persons.length}`)
  console.log(`Ya existen (skip): ${skipped}`)
  console.log(`A insertar: ${toInsert.length}`)
  console.log(`  con sede: ${toInsert.filter(p => p.row.sede_code).length} · con cédula: ${toInsert.filter(p => p.cedula).length} · con email: ${toInsert.filter(p => p.row.email).length}`)
  const famGroups = new Map<string, Person[]>()
  for (const p of persons) { if (!p.famId) continue; const g = famGroups.get(p.famId) ?? []; g.push(p); famGroups.set(p.famId, g) }
  const multiFams = [...famGroups.entries()].filter(([, g]) => g.length >= 2)
  console.log(`Familias con 2+ integrantes: ${multiFams.length}`)

  if (!APPLY) { console.log('\n(dry-run) Corré con --apply para escribir.'); return }

  let inserted = 0
  for (let i = 0; i < toInsert.length; i += 500) {
    const batch = toInsert.slice(i, i + 500)
    const rows = batch.map(p => { const { sede_code, ...rest } = p.row; return { ...rest, sede_id: sede_code ? sedeId[sede_code as string] ?? null : null } })
    const { data, error } = await supabase.from('members').insert(rows).select('id')
    if (error) { console.error('\nError batch', i, error.message); process.exit(1) }
    const ids = (data as Array<{ id: string }>).map(d => d.id)
    batch.forEach((p, j) => { if (p.ext) memberIdByExt.set(p.ext, ids[j]); else p._id = ids[j] })
    inserted += ids.length
    process.stdout.write(`\rInsertados: ${inserted}/${toInsert.length}`)
  }
  console.log('')

  const pid = (p: Person) => p.ext ? memberIdByExt.get(p.ext) : p._id
  let famCreated = 0
  for (const [, g] of multiFams) {
    const uniq = new Map<string, { id: string; pos: string; last: string }>()
    for (const p of g) { const id = pid(p); if (id && !uniq.has(id)) uniq.set(id, { id, pos: p.famPos, last: p.last }) }
    if (uniq.size < 2) continue
    const list = [...uniq.values()]
    const primary = list.find(m => m.pos === 'primary contact') ?? list[0]
    const { data: unit, error: uErr } = await supabase.from('family_units').insert({ name: `Familia ${primary.last}` }).select('id').single()
    if (uErr) { console.error('\nfamily_unit', uErr.message); continue }
    const unitId = (unit as { id: string }).id
    const { error: fErr } = await supabase.from('family_members').insert(list.map(m => ({ family_unit_id: unitId, member_id: m.id, relation: REL[m.pos] ?? 'Otro' })))
    if (fErr) { console.error('\nfamily_members', fErr.message); continue }
    famCreated++
    if (famCreated % 200 === 0) process.stdout.write(`\rFamilias: ${famCreated}`)
  }
  console.log(`\nFamilias creadas: ${famCreated}`)
  console.log('Listo.')
}

main()
