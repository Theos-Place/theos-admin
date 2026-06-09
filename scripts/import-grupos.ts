/**
 * Importa los grupos reales de estudio desde data-import/grupos.csv.
 * - agrupa por "Group Name"; estudio del nombre, dirigente = Leader real (Ind ID != 12965), participantes = resto
 * - crea study_groups (nuevo id) + study_enrollments (participantes)
 * - REEMPLAZA los grupos placeholder "{code} — Histórico" (y sus inscripciones)
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

const ORG_ACCOUNT = '12965' // cuenta genérica "Estudios Bíblicos Theos Place"

// Matcher estudio: orden importa (específicos primero). Devuelve código o null.
const RULES: Array<[RegExp, string]> = [
  [/\bnivel\s*4\b/i, 'N4'], [/\bnivel\s*3\b/i, 'N3'], [/\bnivel\s*2\b/i, 'N2'], [/\bnivel\s*1\b/i, 'N1'],
  [/pre.?matri/i, 'PREMAT'], [/matrimonio/i, 'MAT'],
  [/disc[ií]pulo?s?\s*3/i, 'DIS3'], [/disc[ií]pulo?s?\s*2/i, 'DIS2'], [/disc[ií]pulo?s?\s*1/i, 'DIS1'],
  [/sirviendo como jes/i, 'SCJ'],
  [/panorama/i, 'PAN'], [/evangelismo/i, 'EVM'], [/evangelios/i, 'EVA'], [/hechos/i, 'HCH'],
  [/romanos/i, 'ROM'], [/hebreos/i, 'HEB'], [/efesios/i, 'EFE'], [/g[aá]latas/i, 'GAL'], [/apocalipsis/i, 'APO'],
  [/hermen|interpretar la b/i, 'HER'], [/religiones/i, 'RDM'], [/defendiendo|apolog/i, 'DLF'],
  [/dinero/i, 'AED'], [/amor sin front/i, 'ASF'],
  [/liderazgo/i, 'SCJ'], // "Liderazgo" era el nombre viejo de Sirviendo como Jesús
  [/c[oó]mo\s+dar\s+charlas/i, 'CDC'],
  [/\bcdeb\b|c[oó]mo\s+dar\s+estudios/i, 'CDEB'],
  [/buenas decis|bienestar integral/i, 'CTBD'],
  [/este bus|ad[oó]nde va/i, 'BUS'],
  [/una fe audaz/i, 'UFA'], [/transformad/i, 'TRANS'], [/tiempo para so/i, 'TPS'], [/para qu[eé] estoy/i, 'PQET'],
  [/campa[ñn]a/i, 'CAMP'],
]
function codeFor(name: string): string | null {
  // "Estudio N", "Estudio On N", "ON N" = Nivel N
  const lvl = name.match(/\b(?:estudio\s*(?:on\s*)?|on)\s*0?([1-4])\b/i)
  if (lvl) return 'N' + lvl[1]
  // "Servidores N" era el nombre viejo de Discípulos N
  const serv = name.match(/\bservidor(?:es)?\s*(?:on\s*)?0?([1-3])\b/i)
  if (serv) return 'DIS' + serv[1]
  for (const [re, c] of RULES) if (re.test(name)) return c
  return null
}
function yearOf(name: string): string | null { const m = name.match(/\b(19|20)\d{2}\b/); return m ? `${m[0]}-01-01` : null }

async function fetchAll<T>(table: string, select: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) { const { data, error } = await supabase.from(table).select(select).range(from, from + 999); if (error) throw error; out.push(...(data as T[])); if (!data || data.length < 1000) break }
  return out
}

type Row = Record<string, string>

async function main() {
  const recs: Row[] = parse(readFileSync(new URL('../data-import/grupos.csv', import.meta.url), 'utf8'), { columns: true, bom: true, relax_quotes: true, relax_column_count: true, skip_empty_lines: true })

  const members = await fetchAll<{ id: string; external_id: string | null; first_name: string; last_name: string }>('members', 'id, external_id, first_name, last_name')
  const extMap = new Map<string, { id: string; name: string }>()
  for (const m of members) if (m.external_id) extMap.set(String(m.external_id), { id: m.id, name: `${m.first_name} ${m.last_name}`.toLowerCase() })

  const plans = await fetchAll<{ id: string; code: string }>('study_plans', 'id, code')
  const planByCode = new Map(plans.map(p => [p.code, p.id]))

  // agrupar
  const groups = new Map<string, Row[]>()
  for (const r of recs) { const g = (r['Group Name'] ?? '').trim(); if (!g) continue; const a = groups.get(g) ?? []; a.push(r); groups.set(g, a) }

  type Plan = { name: string; code: string; planId: string; leaderId: string | null; starts_at: string | null; finished: boolean; members: string[] }
  const built: Plan[] = []
  const byCode = new Map<string, number>()
  const unmatched: string[] = []
  let noLeader = 0, membersNotFound = 0

  for (const [name, rows] of groups) {
    const code = codeFor(name)
    if (!code) { unmatched.push(name); continue }
    const planId = planByCode.get(code)
    if (!planId) { unmatched.push(name + ' (sin plan ' + code + ')'); continue }

    // dirigente: Leader real
    const leaderRows = rows.filter(r => (r['Most Recent Status'] ?? '').trim() === 'Leader' && (r['Ind ID'] ?? '').trim() !== ORG_ACCOUNT)
    let leaderId: string | null = null
    const nameLc = name.toLowerCase()
    const matchByName = leaderRows.find(r => { const m = extMap.get((r['Ind ID'] ?? '').trim()); return m && m.name.split(' ').some(t => t.length > 2 && nameLc.includes(t)) })
    const chosen = matchByName ?? leaderRows[0]
    if (chosen) leaderId = extMap.get((chosen['Ind ID'] ?? '').trim())?.id ?? null
    if (!leaderId) noLeader++

    // participantes (Member; excluye org y excluye al líder)
    const memberIds = new Set<string>()
    for (const r of rows) {
      const ext = (r['Ind ID'] ?? '').trim()
      if (ext === ORG_ACCOUNT) continue
      const status = (r['Most Recent Status'] ?? '').trim()
      const mm = extMap.get(ext)
      if (!mm) { if (status === 'Member') membersNotFound++; continue }
      if (mm.id === leaderId) continue
      memberIds.add(mm.id)
    }

    const finished = (rows[0]['Group Active/Inactive'] ?? '').trim().toLowerCase() === 'inactive'
    built.push({ name, code, planId, leaderId, starts_at: yearOf(name), finished, members: [...memberIds] })
    byCode.set(code, (byCode.get(code) ?? 0) + 1)
  }

  const totalEnroll = built.reduce((s, g) => s + g.members.length, 0)
  console.log(`Grupos en CSV: ${groups.size}`)
  console.log(`Grupos a crear: ${built.length}`)
  console.log(`  con dirigente: ${built.length - noLeader} · sin dirigente: ${noLeader}`)
  console.log(`Inscripciones (participantes) a crear: ${totalEnroll}`)
  console.log(`Participantes (Member) sin miembro en BD: ${membersNotFound}`)
  console.log(`Grupos sin estudio (omitidos): ${unmatched.length}`)
  console.log('Por estudio:', JSON.stringify(Object.fromEntries([...byCode.entries()].sort((a, b) => b[1] - a[1]))))
  if (unmatched.length) { console.log('Ejemplos sin estudio:'); unmatched.slice(0, 10).forEach(u => console.log('  ', u)) }

  if (!APPLY) { console.log('\n(dry-run) Corré con --apply para escribir.'); return }

  // 1) borrar placeholder históricos
  const { data: ph } = await supabase.from('study_groups').select('id').ilike('name', '%— Histórico')
  const phIds = (ph ?? []).map((r: { id: string }) => r.id)
  if (phIds.length) { await supabase.from('study_groups').delete().in('id', phIds); console.log(`Placeholder borrados: ${phIds.length}`) }

  // 2) crear grupos + enrollments (idempotente: salta nombres ya existentes)
  const existingGroups = await fetchAll<{ name: string }>('study_groups', 'name')
  const existingNames = new Set(existingGroups.map(g => g.name))
  let gOk = 0, eOk = 0, gSkip = 0
  for (const g of built) {
    if (existingNames.has(g.name)) { gSkip++; continue }
    const { data, error } = await supabase.from('study_groups').insert({
      plan_id: g.planId, name: g.name, leader_id: g.leaderId,
      status: g.finished ? 'finished' : 'in_progress', starts_at: g.starts_at, current_week: 0,
    }).select('id').single()
    if (error) { console.error('\ngrupo', g.name, error.message); continue }
    gOk++
    const gid = (data as { id: string }).id
    if (g.members.length) {
      const rows = g.members.map(mid => ({ group_id: gid, member_id: mid, status: g.finished ? 'completed' : 'enrolled', enrolled_at: g.starts_at, completed_at: g.finished ? g.starts_at : null }))
      const { error: eErr } = await supabase.from('study_enrollments').upsert(rows, { onConflict: 'group_id,member_id', ignoreDuplicates: true })
      if (eErr) console.error('\nenroll', g.name, eErr.message); else eOk += rows.length
    }
    if (gOk % 200 === 0) process.stdout.write(`\rGrupos: ${gOk}/${built.length}`)
  }
  console.log(`\nGrupos creados: ${gOk} · ya existían (skip): ${gSkip} · inscripciones: ${eOk}`)
}

main()
