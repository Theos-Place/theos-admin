/**
 * Reimporta DESDE CERO grupos de estudio + inscripciones desde dos CSV de PCO:
 *   scripts/data/group_participants.csv  (Ind ID, Name, Group Name,
 *       Group Active/Inactive, Group Involvement, Most Recent Status)
 *   scripts/data/process_detail.csv      (Queue Name, …, Status, Ind ID)
 *
 * Paso 1 — LIMPIEZA (requiere --confirm-delete): borra en orden de dependencias
 *   study_attendance → study_sessions → study_enrollments → study_groups.
 *   NO toca study_plans (catálogo). Reporta los conteos previos (respaldo).
 *   Decisión del usuario (2026-06-16): borrar TODAS las inscripciones, incluidas
 *   las directas sin grupo (históricos migración 032) — estos CSV no las recrean.
 * Paso 2 — Parseo: del Group Name se extrae tipo de estudio (→ study_plan) y la
 *   fecha (mes/año, varios formatos). Group Name sin mapeo → reporte.
 * Paso 3 — Grupos: 1 study_group por Group Name único (plan_id, name original,
 *   starts_at/ends_at, status finalizado/en_curso, leader_id + co_leader_id).
 * Paso 4 — Inscripciones: 1 study_enrollment por persona Member, estado cruzado
 *   con process_detail (completed / dropped / enrolled / completed-sin-certeza).
 * Paso 5 — Reportes en scripts/output/ (solo Ind IDs, nunca nombres en consola).
 *
 * Match de personas: "Ind ID" → members.external_id (= Individual ID de PCO).
 * Privacidad: CSV en scripts/data/ (gitignored); logs solo conteos.
 *
 * Dry-run (no escribe nada):   npx tsx scripts/reimport-studies.ts --dry-run
 * Ejecución real (borra+crea): npx tsx scripts/reimport-studies.ts --confirm-delete
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { parse } from 'csv-parse/sync'
import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')
const CONFIRM_DELETE = process.argv.includes('--confirm-delete')
const GP_FILE = new URL('./data/group_participants.csv', import.meta.url)
const PD_FILE = new URL('./data/process_detail.csv', import.meta.url)
const ORG_ACCOUNT = '12965' // cuenta genérica "Estudios Bíblicos Theos Place"

for (const f of ['../.env.local', '../.env']) {
  try { const t = readFileSync(new URL(f, import.meta.url), 'utf8'); for (const l of t.split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') } } catch { /* */ }
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } })

const str = (v: unknown): string => (v == null ? '' : String(v).trim())
const extId = (v: unknown): string => str(v).replace(/\.0$/, '')

// ── Group Name → código de estudio (específicos primero) ──
const RULES: Array<[RegExp, string]> = [
  [/\bnivel\s*4\b/i, 'N4'], [/\bnivel\s*3\b/i, 'N3'], [/\bnivel\s*2\b/i, 'N2'], [/\bnivel\s*1\b/i, 'N1'],
  [/pre.?matri/i, 'PREMAT'], [/matrimonio/i, 'MAT'], [/parejas/i, 'PAREJAS'], // Grupo Parejas: matrimonios descontinuado (archivado)
  [/disc[ií]pulo?s?\s*3/i, 'DIS3'], [/disc[ií]pulo?s?\s*2/i, 'DIS2'], [/disc[ií]pulo?s?\s*1/i, 'DIS1'],
  [/sir[i]?viendo como jes/i, 'SCJ'], // incluye typo "Siriviendo"
  [/panorama/i, 'PAN'], [/evangelismo/i, 'EVM'], [/evangelios/i, 'EVA'], [/hechos/i, 'HCH'],
  [/romanos/i, 'ROM'], [/hebreos/i, 'HEB'], [/efesios/i, 'EFE'], [/g[aá]latas/i, 'GAL'], [/apocalipsis/i, 'APO'],
  [/hermen|interpretar la b/i, 'HER'], [/relig/i, 'RDM'], [/defendiendo|apolog/i, 'DLF'],
  [/dinero|finanzas/i, 'AED'], [/amor sin front/i, 'ASF'],
  [/liderazgo/i, 'SCJ'], // nombre viejo de Sirviendo como Jesús
  [/plan\s+(de\s+)?daniel/i, 'PLANDANIEL'], // capacitación inicial histórica (archivada)
  [/teolog[ií]a|esepa/i, 'TEOAT'], // curso externo (archivado)
  [/c[oó]mo\s+dar\s+charlas|homil[eé]tica|predicaci/i, 'CDC'], // homilética/predicación = dar charlas
  [/\bcdeb\b|c[oó]mo\s+dar\s+(estudios?|eb)/i, 'CDEB'],
  [/buenas de[cs]i|bienestar integral|integri|[eé]tica\b/i, 'CTBD'], // "Decisiones"/"Desiciones"; Ética = CTBD
  [/lecturas con prop/i, 'LECTPROP'], // estudio de prueba (archivado)
  [/este bus|ad[oó]nde va/i, 'BUS'],
  [/qui[eé]n es jes[uú]s/i, 'QEJ'], // estudio inicial descontinuado (archivado)
  [/una fe audaz/i, 'UFA'], [/trans?formad/i, 'TRANS'], [/tiempo para so/i, 'TPS'], [/para qu[eé] estoy/i, 'PQET'],
  [/campa[ñn]a/i, 'CAMP'],
]
// 'DISALL' = "Discípulos"/"Servidores" sin número: originalmente UN solo curso
// que luego se dividió en 2 y 3 → el grupo se crea como DIS1 pero inscribe en
// DIS1+DIS2+DIS3 juntos.
function codeFor(name: string): string | null {
  const lvl = name.match(/\b(?:estudio\s*(?:on\s*)?|on)\s*0?([1-4])\b/i)
  if (lvl) return 'N' + lvl[1]
  const serv = name.match(/\bservidor(?:es)?\s*(?:on\s*)?0?([1-3])\b/i)
  if (serv) return 'DIS' + serv[1]
  for (const [re, c] of RULES) if (re.test(name)) return c
  if (/\bdisc[ií]pulos?\b|\bservidor(?:es)?\b/i.test(name)) return 'DISALL'
  return null
}
// Códigos a inscribir por persona según el código del grupo.
const enrollCodesFor = (code: string): string[] => code === 'DISALL' ? ['DIS1', 'DIS2', 'DIS3'] : [code]
// Plan del grupo (DISALL se ancla a DIS1).
const groupCodeFor = (code: string): string => code === 'DISALL' ? 'DIS1' : code

// ── fecha del nombre (mes/año en varios formatos) ──
const MONTHS: Array<[RegExp, number]> = [
  [/\benero\b|\bene\b/i, 1], [/\bfebrero\b|\bfeb\b/i, 2], [/\bmarzo\b|\bmar\b/i, 3], [/\babril\b|\babr\b/i, 4],
  [/\bmayo\b/i, 5], [/\bjunio\b|\bjun\b/i, 6], [/\bjulio\b|\bjul\b/i, 7], [/\bagosto\b|\bago\b/i, 8],
  [/\bsetiembre\b|\bseptiembre\b|\bsept?\b|\bset\b/i, 9], [/\boctubre\b|\boct\b/i, 10],
  [/\bnoviembre\b|\bnov\b/i, 11], [/\bdiciembre\b|\bdic\b/i, 12],
]
function parseStart(name: string): string | null {
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
  const d = new Date(dateStr + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + weeks * 7); return d.toISOString().slice(0, 10)
}

// ── process_detail: Queue Name → código (colas normales = aprobó) ──
const QUEUE_MAP: Record<string, string> = {
  'Nivel 1': 'N1', 'Nivel 2': 'N2', 'Nivel 3': 'N3', 'Nivel 4': 'N4', 'Sirviendo como Jesús': 'SCJ',
  'Discípulos 1': 'DIS1', 'Discípulos 2': 'DIS2', 'Discipulos 3': 'DIS3', 'Discípulos 3': 'DIS3',
  'Panorama': 'PAN', 'Administrando el Dinero': 'AED', 'Matrimonios': 'MAT', 'Religiones del Mundo': 'RDM',
  'Evangelismo': 'EVM', '¿Cómo interpretar la Biblia? (Hermenéutica)': 'HER', 'Evangelios': 'EVA', 'Hechos': 'HCH',
  'Defendiendo la Fe (Apologética)': 'DLF', 'Cómo Tomar Buenas Desiciones (Viviendo en Integri)': 'CTBD',
  'Pre Matrimonial': 'PREMAT', 'Hebreos': 'HEB', 'Romanos': 'ROM', 'Amor sin Fronteras': 'ASF',
  'Efesios': 'EFE', 'Galatas': 'GAL', 'Gálatas': 'GAL', 'Apocalipsis': 'APO', '¿Adónde va este bus?': 'BUS',
  'Bienestar Integral': 'CTBD', '¿Cómo dar Estudios Bíblicos?': 'CDEB', '¿Cómo dar Charlas?': 'CDC',
  '¿Quien es Jesús?': 'QEJ', '¿Quién es Jesús?': 'QEJ',
}
const REPRUEBA_NIVEL = 'Reprueba Nivel 1 - 4'
const REPRUEBA_CAP = 'Reprueba Capacitación'
const isNivel = (code: string) => /^N[1-4]$/.test(code)

async function fetchAll<T>(table: string, select: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) { const { data, error } = await supabase.from(table).select(select).range(from, from + 999); if (error) throw error; out.push(...(data as T[])); if (!data || data.length < 1000) break }
  return out
}
const OUT = new URL('./output/', import.meta.url)
function writeCsv(name: string, header: string, lines: string[]) {
  if (DRY_RUN && !lines.length) { /* en dry-run igual escribimos para revisión */ }
  mkdirSync(OUT, { recursive: true })
  writeFileSync(new URL(name, OUT), [header, ...lines].join('\n'))
}

async function main() {
  if (!existsSync(GP_FILE) || !existsSync(PD_FILE)) {
    console.error('Faltan CSV en scripts/data/: group_participants.csv y/o process_detail.csv (gitignored).')
    process.exit(1)
  }
  if (!DRY_RUN && !CONFIRM_DELETE) {
    console.error('Ejecución destructiva. Corré con --dry-run para previsualizar, o --confirm-delete para borrar y reimportar.')
    process.exit(1)
  }

  // ── Respaldo: conteos previos ──
  const counts = async (t: string, filter?: (q: any) => any) => {
    let q = supabase.from(t).select('*', { count: 'exact', head: true }); if (filter) q = filter(q)
    const { count } = await q; return count ?? 0
  }
  const before = {
    study_attendance: await counts('study_attendance'),
    study_sessions: await counts('study_sessions'),
    study_enrollments: await counts('study_enrollments'),
    study_groups: await counts('study_groups'),
    study_plans: await counts('study_plans'),
  }
  console.log('── Respaldo (conteos actuales) ──')
  for (const [k, v] of Object.entries(before)) console.log(`  ${k}: ${v.toLocaleString('es-CR')}`)

  // ── Cargar CSV ──
  const gp: Record<string, string>[] = parse(readFileSync(GP_FILE, 'utf8'), { columns: true, bom: true, relax_quotes: true, relax_column_count: true, skip_empty_lines: true })
  const pd: Record<string, string>[] = parse(readFileSync(PD_FILE, 'utf8'), { columns: true, bom: true, relax_quotes: true, relax_column_count: true, skip_empty_lines: true })
  console.log(`\nCSV: group_participants ${gp.length.toLocaleString('es-CR')} filas · process_detail ${pd.length.toLocaleString('es-CR')} filas`)

  // ── process_detail: aprobados por código + cubetas de reprobado ──
  const passByCode = new Map<string, Set<string>>()
  const reproveNivel = new Set<string>(), reproveCap = new Set<string>()
  for (const r of pd) {
    const ind = extId(r['Ind ID']); if (!ind) continue
    const queue = str(r['Queue Name'])
    if (queue === REPRUEBA_NIVEL) { reproveNivel.add(ind); continue }
    if (queue === REPRUEBA_CAP) { reproveCap.add(ind); continue }
    const code = QUEUE_MAP[queue]
    if (!code) continue
    let s = passByCode.get(code); if (!s) { s = new Set(); passByCode.set(code, s) }
    s.add(ind)
  }

  // ── Miembros: external_id → uuid + nombre (para match de dirigente) ──
  const members = await fetchAll<{ id: string; external_id: string | null; first_name: string; last_name: string }>('members', 'id, external_id, first_name, last_name')
  const extMap = new Map<string, { id: string; name: string }>()
  for (const m of members) if (m.external_id) extMap.set(String(m.external_id), { id: m.id, name: `${m.first_name} ${m.last_name}`.toLowerCase() })

  const plans = await fetchAll<{ id: string; code: string | null; duration_weeks: number | null }>('study_plans', 'id, code, duration_weeks')
  const planByCode = new Map(plans.filter(p => p.code).map(p => [p.code as string, p]))

  // ── Agrupar filas por Group Name ──
  const byGroup = new Map<string, Record<string, string>[]>()
  for (const r of gp) { const g = str(r['Group Name']); if (!g) continue; const a = byGroup.get(g) ?? []; a.push(r); byGroup.set(g, a) }

  type Built = {
    name: string; code: string; planId: string; starts_at: string | null; ends_at: string | null
    active: boolean; leaderId: string | null; coLeaderId: string | null
    members: string[] // memberIds (Member status)
  }
  const built: Built[] = []
  const noMapeo: string[] = []           // Group Names sin estudio
  const extraLeaders: string[] = []      // group_name, leaders_extra (>2)
  const noMatch = new Set<string>()      // Ind IDs (Member) sin miembro en BD

  for (const [name, rows] of byGroup) {
    const rawCode = codeFor(name)
    const groupCode = rawCode ? groupCodeFor(rawCode) : null
    const plan = groupCode ? planByCode.get(groupCode) : undefined
    if (!rawCode || !groupCode || !plan) { noMapeo.push(name); continue }
    // DISALL ("Discípulos"/"Servidores" sin número) → 3 grupos (DIS1/2/3) con los
    // mismos miembros (el UNIQUE(group_id,member_id) impide 3 inscripciones en 1 grupo).
    const groupCodes = enrollCodesFor(rawCode) // [code] o ['DIS1','DIS2','DIS3']

    const start = parseStart(name)
    const active = str(rows[0]['Group Active/Inactive']).toLowerCase() === 'active'

    // dirigentes: status Leader, no org. Ordenar: nombre-en-grupo primero.
    const nameLc = name.toLowerCase()
    const leaderIds: string[] = []
    const seenL = new Set<string>()
    const leaderRows = rows.filter(r => str(r['Most Recent Status']) === 'Leader' && extId(r['Ind ID']) !== ORG_ACCOUNT)
    leaderRows.sort((a, b) => {
      const ma = extMap.get(extId(a['Ind ID'])), mb = extMap.get(extId(b['Ind ID']))
      const ina = ma && ma.name.split(' ').some(t => t.length > 2 && nameLc.includes(t)) ? 0 : 1
      const inb = mb && mb.name.split(' ').some(t => t.length > 2 && nameLc.includes(t)) ? 0 : 1
      return ina - inb
    })
    for (const r of leaderRows) { const m = extMap.get(extId(r['Ind ID'])); if (m && !seenL.has(m.id)) { seenL.add(m.id); leaderIds.push(m.id) } }
    const leaderId = leaderIds[0] ?? null
    const coLeaderId = leaderIds[1] ?? null
    if (leaderIds.length > 2) extraLeaders.push(`"${name.replace(/"/g, '""')}",${leaderIds.length}`)

    // estudiantes: status Member, no org, con match; sin duplicar; excluye dirigentes
    const memberIds = new Set<string>()
    for (const r of rows) {
      if (str(r['Most Recent Status']) !== 'Member') continue
      const ind = extId(r['Ind ID']); if (!ind || ind === ORG_ACCOUNT) continue
      const m = extMap.get(ind)
      if (!m) { noMatch.add(ind); continue }
      if (m.id === leaderId || m.id === coLeaderId) continue
      memberIds.add(m.id)
    }
    const memberArr = [...memberIds]
    for (const gc of groupCodes) {
      const p = planByCode.get(gc); if (!p) continue
      const end = start && p.duration_weeks ? addWeeks(start, p.duration_weeks) : null
      const gname = groupCodes.length > 1 ? `${name} · ${gc}` : name
      built.push({ name: gname, code: gc, planId: p.id, starts_at: start, ends_at: end, active, leaderId, coLeaderId, members: memberArr })
    }
  }

  // ── Inscripciones con estado (cruce process_detail) ──
  // Para ambigüedad (misma persona+código en varios grupos): el resultado de
  // process_detail se aplica al grupo MÁS RECIENTE; los otros quedan por defecto.
  const idToExt = new Map<string, string>() // memberId → external_id (para cruce)
  for (const m of members) if (m.external_id) idToExt.set(m.id, String(m.external_id))

  // Una inscripción por (grupo, miembro). Cada grupo ya tiene un único código.
  type Intent = { built: Built; memberId: string }
  const intents: Intent[] = []
  for (const g of built) for (const mid of g.members) intents.push({ built: g, memberId: mid })

  // índice (memberId|code) → grupo más reciente (para resolver ambigüedad)
  const latestByKey = new Map<string, Built>()
  for (const it of intents) {
    const k = `${it.memberId}|${it.built.code}`
    const cur = latestByKey.get(k)
    if (!cur || (it.built.starts_at ?? '') > (cur.starts_at ?? '')) latestByKey.set(k, it.built)
  }
  const ambiguous = new Map<string, number>() // `${ext}|${code}` → #grupos (para log)
  { const cnt = new Map<string, number>(); for (const it of intents) { const k = `${it.memberId}|${it.built.code}`; cnt.set(k, (cnt.get(k) ?? 0) + 1) }
    for (const [k, n] of cnt) if (n > 1) { const [mid, code] = k.split('|'); ambiguous.set(`${idToExt.get(mid) ?? '?'}|${code}`, n) } }

  type Enroll = { group_id?: string; planId: string; member_id: string; status: string; enrolled_at: string | null; completed_at: string | null; dropped_at: string | null; drop_reason: string | null; notes: string | null; _built: Built }
  const byStatus: Record<string, number> = { completed: 0, dropped: 0, enrolled: 0 }
  const enrolls: Enroll[] = []
  for (const it of intents) {
    const g = it.built
    const ext = idToExt.get(it.memberId)
    const isPrimary = latestByKey.get(`${it.memberId}|${g.code}`) === g
    let status = 'enrolled', notes: string | null = null, dropped_at: string | null = null, completed_at: string | null = null, drop_reason: string | null = null

    const passed = ext ? passByCode.get(g.code)?.has(ext) : false
    const reproved = ext ? (isNivel(g.code) ? reproveNivel.has(ext) : reproveCap.has(ext)) : false

    if (passed && isPrimary) { status = 'completed'; completed_at = g.ends_at ?? g.starts_at }
    else if (reproved && isPrimary) { status = 'dropped'; dropped_at = g.starts_at; drop_reason = 'reprobó (process_detail)' }
    else if (!g.active) { status = 'completed'; completed_at = g.ends_at ?? g.starts_at; notes = 'completado sin registro de aprobación (grupo inactivo)' }
    else status = 'enrolled'

    byStatus[status] = (byStatus[status] ?? 0) + 1
    enrolls.push({ planId: g.planId, member_id: it.memberId, status, enrolled_at: g.starts_at, completed_at, dropped_at, drop_reason, notes, _built: g })
  }

  // ── Reporte de plan ──
  const activos = built.filter(g => g.active).length
  console.log('\n── Plan de reimportación ──')
  console.log(`  Group Names en CSV:       ${byGroup.size.toLocaleString('es-CR')}`)
  console.log(`  Grupos a crear:           ${built.length.toLocaleString('es-CR')}  (activos ${activos} · finalizados ${built.length - activos})`)
  console.log(`  Grupos sin mapeo estudio: ${noMapeo.length.toLocaleString('es-CR')}`)
  console.log(`  Grupos sin dirigente:     ${built.filter(g => !g.leaderId).length.toLocaleString('es-CR')}`)
  console.log(`  Codirigentes asignados:   ${built.filter(g => g.coLeaderId).length.toLocaleString('es-CR')}  (grupos con 3+ leaders: ${extraLeaders.length})`)
  console.log(`  Inscripciones a crear:    ${enrolls.length.toLocaleString('es-CR')}  → completed ${byStatus.completed} · dropped ${byStatus.dropped} · enrolled ${byStatus.enrolled}`)
  console.log(`  Personas Member sin match: ${noMatch.size.toLocaleString('es-CR')}`)
  console.log(`  Casos ambiguos (mismo estudio en varios grupos): ${ambiguous.size.toLocaleString('es-CR')}`)

  // ── Reportes a archivo ──
  writeCsv('reimport-grupos-sin-mapeo-estudio.csv', 'group_name', noMapeo.map(n => `"${n.replace(/"/g, '""')}"`))
  writeCsv('reimport-grupos-sin-dirigente.csv', 'group_name', built.filter(g => !g.leaderId).map(g => `"${g.name.replace(/"/g, '""')}"`))
  writeCsv('reimport-personas-sin-match.csv', 'ind_id', [...noMatch])
  writeCsv('reimport-ambiguos.csv', 'ind_id,code,grupos', [...ambiguous].map(([k, n]) => `${k.replace('|', ',')},${n}`))
  console.log('  → reportes en scripts/output/reimport-*.csv (solo Ind IDs)')

  if (DRY_RUN) { console.log('\n[DRY-RUN] No se escribió nada. Corré con --confirm-delete para borrar y reimportar.'); return }

  // ── Paso 1: BORRAR (orden de dependencias) ──
  console.log('\n── Borrando (--confirm-delete) ──')
  // Por LOTES: un delete masivo (decenas de miles de filas) excede el statement
  // timeout de PostgREST. Borramos en chunks de 1000 por id hasta vaciar.
  for (const t of ['study_attendance', 'study_sessions', 'study_enrollments', 'study_groups']) {
    let removed = 0
    for (;;) {
      const { data, error } = await supabase.from(t).select('id').limit(1000)
      if (error) { console.error(`  ✗ leyendo ${t}: ${error.message}`); process.exit(1) }
      const chunk = (data ?? []).map((r: { id: string }) => r.id)
      if (!chunk.length) break
      const { error: dErr } = await supabase.from(t).delete().in('id', chunk)
      if (dErr) { console.error(`  ✗ borrando ${t}: ${dErr.message}`); process.exit(1) }
      removed += chunk.length
    }
    console.log(`  ✓ ${t} vaciada (${removed.toLocaleString('es-CR')})`)
  }

  // ── Paso 3: crear grupos ──
  console.log('\n── Creando grupos ──')
  let gOk = 0, gErr = 0
  const groupIdByName = new Map<string, string>()
  for (let i = 0; i < built.length; i += 200) {
    const chunk = built.slice(i, i + 200)
    const rows = chunk.map(g => ({
      plan_id: g.planId, name: g.name, leader_id: g.leaderId, co_leader_id: g.coLeaderId,
      starts_at: g.starts_at, ends_at: g.ends_at, status: g.active ? 'en_curso' : 'finalizado', current_week: 0,
    }))
    const { data, error } = await supabase.from('study_groups').insert(rows).select('id, name')
    if (error) { gErr += chunk.length; console.error(`  ✗ batch grupos ${i / 200 + 1}: ${error.message} — continuando…`); continue }
    for (const r of data as Array<{ id: string; name: string }>) groupIdByName.set(r.name, r.id)
    gOk += (data as unknown[]).length
    if (gOk % 600 < 200 || gOk >= built.length - 200) console.log(`  ✓ grupos: ${gOk}/${built.length}`)
  }

  // ── Paso 4: crear inscripciones ──
  console.log('\n── Creando inscripciones ──')
  const rows = enrolls.map(e => ({
    group_id: groupIdByName.get(e._built.name) ?? null, plan_id: e.planId, member_id: e.member_id,
    status: e.status, enrolled_at: e.enrolled_at, completed_at: e.completed_at,
    dropped_at: e.dropped_at, drop_reason: e.drop_reason, notes: e.notes,
  })).filter(r => r.group_id)
  let eOk = 0, eErr = 0
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200)
    const { error } = await supabase.from('study_enrollments').insert(chunk)
    if (error) { eErr += chunk.length; console.error(`  ✗ batch enroll ${i / 200 + 1}: ${error.message} — continuando…`); continue }
    eOk += chunk.length
    if (eOk % 2000 < 200 || eOk >= rows.length - 200) console.log(`  ✓ inscripciones: ${eOk}/${rows.length}`)
  }

  console.log('\n── Resumen ──')
  console.log(`  Grupos creados:        ${gOk.toLocaleString('es-CR')} (errores ${gErr})`)
  console.log(`  Inscripciones creadas: ${eOk.toLocaleString('es-CR')} (errores ${eErr})`)
  console.log(`    completed ${byStatus.completed} · dropped ${byStatus.dropped} · enrolled ${byStatus.enrolled}`)
  console.log(`  Sin dirigente: ${built.filter(g => !g.leaderId).length} · sin mapeo: ${noMapeo.length} · sin match: ${noMatch.size}`)
}

main().catch(e => { console.error('Error fatal:', e); process.exit(1) })
