/**
 * Completa la info de los grupos ACTIVOS desde data-import/grupos-activos.csv:
 * zona (sede), día, horario, ubicación y dirigente (por email). Match por nombre de grupo.
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

const SEDE_MAP: Record<string, string> = {
  'Pro Oeste (Meridiano)': 'meridiano', 'Pro Este (Antares)': 'antares', 'Heredia': 'heredia',
  'United': 'united', 'Liberia': 'liberia', 'Life (Escalante)': 'life-escalante',
  'Alajuela': 'alajuela', 'Cartago': 'cartago', 'Potrero': 'potrero', 'Guapiles': 'guapiles',
}
const DAY: Record<string, string> = { lunes: 'L', martes: 'M', miercoles: 'X', miércoles: 'X', jueves: 'J', viernes: 'V', sabado: 'S', sábado: 'S', domingo: 'D' }

// Matcher de estudio (igual a import-grupos) para CREAR grupos activos faltantes.
const RULES: Array<[RegExp, string]> = [
  [/pre.?matri/i, 'PREMAT'], [/matrimonio/i, 'MAT'],
  [/disc[ií]pulo?s?\s*3/i, 'DIS3'], [/disc[ií]pulo?s?\s*2/i, 'DIS2'], [/disc[ií]pulo?s?\s*1/i, 'DIS1'],
  [/sirviendo como jes/i, 'SCJ'], [/liderazgo/i, 'SCJ'],
  [/c[oó]mo\s+dar\s+charlas/i, 'CDC'],
  [/\bcdeb\b|c[oó]mo\s+dar\s+estudios/i, 'CDEB'],
  [/panorama/i, 'PAN'], [/evangelismo/i, 'EVM'], [/evangelios/i, 'EVA'], [/hechos/i, 'HCH'],
  [/romanos/i, 'ROM'], [/hebreos/i, 'HEB'], [/efesios/i, 'EFE'], [/g[aá]latas/i, 'GAL'], [/apocalipsis/i, 'APO'],
  [/hermen|interpretar la b/i, 'HER'], [/religiones/i, 'RDM'], [/defendiendo|apolog/i, 'DLF'],
  [/dinero/i, 'AED'], [/amor sin front/i, 'ASF'], [/buenas decis|bienestar integral/i, 'CTBD'],
  [/este bus|ad[oó]nde va/i, 'BUS'], [/una fe audaz/i, 'UFA'], [/transformad/i, 'TRANS'],
  [/tiempo para so/i, 'TPS'], [/para qu[eé] estoy/i, 'PQET'], [/campa[ñn]a/i, 'CAMP'],
]
function codeFor(name: string): string | null {
  const lvl = name.match(/\b(?:estudio\s*(?:on\s*)?|on)\s*0?([1-4])\b/i); if (lvl) return 'N' + lvl[1]
  if (/\bnivel\s*4\b/i.test(name)) return 'N4'; if (/\bnivel\s*3\b/i.test(name)) return 'N3'
  if (/\bnivel\s*2\b/i.test(name)) return 'N2'; if (/\bnivel\s*1\b/i.test(name)) return 'N1'
  const serv = name.match(/\bservidor(?:es)?\s*(?:on\s*)?0?([1-3])\b/i); if (serv) return 'DIS' + serv[1]
  for (const [re, c] of RULES) if (re.test(name)) return c
  return null
}

function normTime(v: string): string | null {
  const t = (v ?? '').trim(); if (!t) return null
  return t.replace(/\s*([ap])\.?m\.?/i, (_, p) => ` ${p.toUpperCase()}M`).trim()
}

async function fetchAll<T>(table: string, select: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) { const { data, error } = await supabase.from(table).select(select).range(from, from + 999); if (error) throw error; out.push(...(data as T[])); if (!data || data.length < 1000) break }
  return out
}

async function main() {
  const recs: Record<string, string>[] = parse(readFileSync(new URL('../data-import/grupos-activos.csv', import.meta.url), 'utf8'), { columns: true, bom: true, relax_quotes: true, relax_column_count: true, skip_empty_lines: true })

  const members = await fetchAll<{ id: string; email: string | null; first_name: string; last_name: string }>('members', 'id, email, first_name, last_name')
  const byEmail = new Map<string, string>()
  const byName = new Map<string, string>() // `${primer nombre}|${primer apellido}`
  const norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
  for (const m of members) {
    if (m.email) byEmail.set(m.email.toLowerCase(), m.id)
    const k = `${norm((m.first_name || '').split(' ')[0])}|${norm((m.last_name || '').split(' ')[0])}`
    if (!byName.has(k)) byName.set(k, m.id)
  }
  function leaderId(r: Record<string, string>): string | null {
    const first = (r['Leader First'] ?? '').trim(), last = (r['Leader Last'] ?? '').trim()
    const nameKey = `${norm(first.split(' ')[0])}|${norm(last.split(' ')[0])}`
    const byNameId = byName.get(nameKey)
    if (byNameId) return byNameId // nombre+apellido es más confiable que el email (correos compartidos)
    const email = (r['Email'] ?? '').replace(/\(.*?\)/g, '').trim().toLowerCase()
    return email ? byEmail.get(email) ?? null : null
  }

  const groups = await fetchAll<{ id: string; name: string }>('study_groups', 'id, name')
  const groupByName = new Map(groups.map(g => [g.name.trim(), g.id]))
  const plans = await fetchAll<{ id: string; code: string }>('study_plans', 'id, code')
  const planByCode = new Map(plans.map(p => [p.code, p.id]))

  function fields(r: Record<string, string>) {
    const day = DAY[(r['Meeting Day'] ?? '').trim().toLowerCase()]
    const sedeCode = SEDE_MAP[(r['Sede a la que asiste con mayor frecuencia'] ?? '').trim()] ?? null
    const location = [(r['Street'] ?? '').trim(), (r['City'] ?? '').trim()].filter(Boolean).join(', ') || null
    return {
      leader_id: leaderId(r),
      schedule_days: day ? [day] : [],
      schedule_time: normTime(r['Meet Time']),
      location,
      zone: sedeCode,
    }
  }

  let matched = 0, noLeader = 0
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = []
  const toCreate: Array<{ name: string; planId: string; f: ReturnType<typeof fields> }> = []
  const skipped: string[] = []
  for (const r of recs) {
    const name = (r['Group'] ?? '').trim()
    const f = fields(r)
    if (!f.leader_id) noLeader++
    const gid = groupByName.get(name)
    if (gid) { matched++; updates.push({ id: gid, patch: { ...f, ...(f.leader_id ? {} : { leader_id: undefined }) } }); continue }
    // no existe → crear si el estudio resuelve a un plan
    const code = codeFor(name)
    const planId = code ? planByCode.get(code) : undefined
    if (planId) toCreate.push({ name, planId, f })
    else skipped.push(name)
  }

  console.log(`Filas CSV: ${recs.length}`)
  console.log(`A actualizar (existen): ${matched}`)
  console.log(`A crear (activos faltantes con plan): ${toCreate.length}`)
  console.log(`Omitidos (sin plan, p.ej. CDEB): ${skipped.length}`, skipped)
  console.log(`Sin dirigente por email: ${noLeader}`)

  if (!APPLY) { console.log('\n(dry-run) Corré con --apply para escribir.'); return }

  let upd = 0
  for (const u of updates) {
    const patch = { ...u.patch }; if (patch.leader_id === undefined) delete patch.leader_id
    const { error } = await supabase.from('study_groups').update(patch).eq('id', u.id)
    if (error) { console.error('\n', u.id, error.message); continue }
    upd++
  }
  console.log(`Actualizados: ${upd}`)

  let cre = 0
  for (const g of toCreate) {
    const { error } = await supabase.from('study_groups').insert({
      plan_id: g.planId, name: g.name, status: 'en_curso', current_week: 0,
      leader_id: g.f.leader_id, schedule_days: g.f.schedule_days, schedule_time: g.f.schedule_time, location: g.f.location, zone: g.f.zone,
    })
    if (error) { console.error('\ncrear', g.name, error.message); continue }
    cre++
  }
  console.log(`Creados: ${cre}`)
}

main()
