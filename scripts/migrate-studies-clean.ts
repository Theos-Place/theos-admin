/**
 * Migración LIMPIA de estudios (2026-07-17). Reemplaza el histórico mal
 * matcheado por la fuente curada y recrea los grupos abiertos.
 *
 * Fuentes (data-import/):
 *   - study_enrollments_migration.csv  → histórico (todo status 'completed')
 *       cols: member_external_id, plan_code, status, completed_at, group_name, leader_name
 *   - grupos_activos_17jul.csv         → grupos abiertos (SIN inscripciones)
 *       cols: Group Name, plan_code, lider, starts_at_str, ends_at, total_miembros
 *
 * Fases:
 *   0. Crea el study_plan 'MDM' si no existe.
 *   1. BORRA todo study_enrollments + study_groups (requiere --confirm-delete).
 *      Ojo: las FKs a estas tablas son SET NULL/CASCADE, así que el borrado
 *      NO falla, pero nullifica los pocos enlaces vivos (pagos/solicitudes/
 *      recomendaciones que apuntaban a grupos/inscripciones). Se reporta el
 *      conteo previo como respaldo. NO toca study_plans.
 *   2. Histórico: 1 grupo por group_name único (plan más frecuente, líder por
 *      nombre, fecha parseada del nombre, status 'finalizado') + inscripciones
 *      'completed' (member por external_id, group por el mapa del paso anterior).
 *   3. Grupos abiertos: 1 grupo por fila del CSV de activos (status 'en_curso',
 *      fechas ya vienen como texto). Sin inscripciones (el CSV no las trae).
 *   4. Reporte de conteos y skips.
 *
 * Match de persona (alumno): member_external_id → members.external_id.
 * Match de dirigente: por nombre, sin tildes, case-insensitive; sin match → null.
 * NO deduplica inscripciones (un (member,plan) puede repetirse: son
 * completaciones de distintos grupos/momentos). Procesa en batches de 500 sin
 * transacción global: una fila que falla se loguea y se sigue.
 *
 * Dry-run (no escribe):        npx tsx scripts/migrate-studies-clean.ts --dry-run
 * Ejecución real (borra+crea): npx tsx scripts/migrate-studies-clean.ts --confirm-delete
 */
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { parse } from 'csv-parse/sync'
import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')
const CONFIRM_DELETE = process.argv.includes('--confirm-delete')

if (!DRY_RUN && !CONFIRM_DELETE) {
  console.error('Refuse: pasá --dry-run (simula) o --confirm-delete (borra y reimporta de verdad).')
  process.exit(1)
}

// ── Env (.env.local / .env) ──
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

const HIST_FILE = new URL('../data-import/study_enrollments_migration.csv', import.meta.url)
const ACTIVE_FILE = new URL('../data-import/grupos_activos_17jul.csv', import.meta.url)

// ── Helpers ──
const str = (v: unknown): string => (v == null ? '' : String(v).trim())
const extId = (v: unknown): string => str(v).replace(/\.0$/, '')
const norm = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

// Duraciones (semanas) por código de plan; default 10.
const DURATION: Record<string, number> = {
  N1: 10, N2: 11, N3: 10, N4: 11,
  DIS1: 10, DIS2: 9, DIS3: 10,
  AED: 8, ASF: 8, APO: 10, BUS: 10, CDC: 10, CDEB: 10,
  CTBD: 11, DLF: 8, EFE: 10, EVA: 10, EVM: 8,
  GAL: 10, HCH: 9, HEB: 10, HER: 10, LECTPROP: 10,
  MAT: 11, MDM: 10, PAN: 12, PLANDANIEL: 10, PREMAT: 10,
  QEJ: 10, RDM: 9, ROM: 11, SCJ: 12, TEOAT: 10,
}
const durationWeeks = (code: string): number => DURATION[code] ?? 10

// Meses (variantes → 1-12).
const MONTHS: Record<string, number> = {
  enero: 1, ene: 1, febrero: 2, feb: 2, marzo: 3, mar: 3, abril: 4, abr: 4,
  mayo: 5, may: 5, junio: 6, jun: 6, julio: 7, jul: 7, agosto: 8, ago: 8,
  septiembre: 9, setiembre: 9, sept: 9, sep: 9, set: 9,
  octubre: 10, oct: 10, noviembre: 11, nov: 11, diciembre: 12, dic: 12,
}
const MONTH_ALT = 'septiembre|setiembre|sept|sep|set|enero|ene|febrero|feb|marzo|mar|abril|abr|mayo|may|junio|jun|julio|jul|agosto|ago|octubre|oct|noviembre|nov|diciembre|dic'

/** Fecha de inicio a partir del group_name (ver patrones del prompt). null si no hay. */
function parseStartFromName(name: string): string | null {
  const n = norm(name)
  // 1+2: "Mes Año" o "MesAño" (espacio opcional) con año de 4 dígitos.
  let m = n.match(new RegExp(`(${MONTH_ALT})\\s*((?:19|20)\\d{2})`))
  if (m) return ymd(MONTHS[m[1]], Number(m[2]), 1)
  // 3: "Mes YY" (año corto de 2 dígitos, no seguido de otro dígito).
  m = n.match(new RegExp(`(${MONTH_ALT})\\s+(\\d{2})(?!\\d)`))
  if (m) return ymd(MONTHS[m[1]], 2000 + Number(m[2]), 1)
  // 4: solo año → 1 de junio (estimado a mitad de año).
  m = n.match(/((?:19|20)\d{2})/)
  if (m) return ymd(6, Number(m[1]), 1)
  // 5: sin fecha.
  return null
}
function ymd(month: number, year: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
function addWeeks(startIso: string, weeks: number): string {
  const d = new Date(`${startIso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + weeks * 7)
  return d.toISOString().slice(0, 10)
}
/** Normaliza una fecha 'YYYY-MM-DD' del CSV; null si viene vacía/ inválida. */
function cleanDate(v: unknown): string | null {
  const s = str(v)
  if (!s) return null
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!m) return null
  return ymd(Number(m[2]), Number(m[1]), Number(m[3]))
}

// ── Carga paginada (supabase corta en 1000 filas) ──
async function fetchAll<T>(table: string, cols: string): Promise<T[]> {
  const out: T[] = []
  const size = 1000
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase.from(table).select(cols).range(from, from + size - 1)
    if (error) throw error
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < size) break
  }
  return out
}

async function main() {
  console.log(`\n=== Migración limpia de estudios ${DRY_RUN ? '(DRY-RUN, no escribe)' : '(EJECUCIÓN REAL)'} ===\n`)

  // Índices de personas y planes.
  const members = await fetchAll<{ id: string; external_id: string | null; first_name: string | null; last_name: string | null }>(
    'members', 'id, external_id, first_name, last_name',
  )
  const byExt = new Map<string, string>()
  for (const m of members) if (m.external_id) byExt.set(extId(m.external_id), m.id)

  // Índice de nombres para dirigentes: nombre normalizado → id (primero gana) +
  // tokens para fallback por subconjunto.
  const byFullName = new Map<string, string>()
  const memberTokens: Array<{ id: string; tokens: Set<string> }> = []
  for (const m of members) {
    const full = norm(`${m.first_name ?? ''} ${m.last_name ?? ''}`)
    if (!full) continue
    if (!byFullName.has(full)) byFullName.set(full, m.id)
    memberTokens.push({ id: m.id, tokens: new Set(full.split(' ')) })
  }
  function matchLeader(raw: string): string | null {
    const t = str(raw)
    if (!t) return null
    const cands: string[] = []
    if (t.includes(',')) { const [ape, nom] = t.split(','); cands.push(norm(`${nom} ${ape}`)) }
    cands.push(norm(t))
    for (const c of cands) { const hit = byFullName.get(c); if (hit) return hit }
    // Fallback: un miembro cuyos tokens contienen TODOS los del candidato (≥2 tokens).
    for (const c of cands) {
      const ct = c.split(' ').filter(Boolean)
      if (ct.length < 2) continue
      const hit = memberTokens.find(mt => ct.every(tok => mt.tokens.has(tok)))
      if (hit) return hit.id
    }
    return null
  }

  const plans = await fetchAll<{ id: string; code: string | null }>('study_plans', 'id, code')
  const planByCode = new Map<string, string>()
  for (const p of plans) if (p.code) planByCode.set(p.code, p.id)

  // ── Paso 0: plan MDM ──
  if (!planByCode.has('MDM')) {
    console.log('Paso 0 · plan MDM no existe → crear')
    if (!DRY_RUN) {
      const { data, error } = await supabase.from('study_plans').insert({
        name: 'Movimiento de Discípulos Multiplicadores', code: 'MDM',
        level: 'etapa_intermedia', duration_weeks: 10, is_active: false,
        is_curricular: true, requires_invitation: false, requires_bus_talk: false,
      }).select('id').single()
      if (error) throw error
      planByCode.set('MDM', (data as { id: string }).id)
    } else {
      planByCode.set('MDM', randomUUID())
    }
  } else {
    console.log('Paso 0 · plan MDM ya existe')
  }

  // ── Paso 1: respaldo de conteos + borrado ──
  const [{ count: gCount }, { count: eCount }] = await Promise.all([
    supabase.from('study_groups').select('id', { count: 'exact', head: true }),
    supabase.from('study_enrollments').select('id', { count: 'exact', head: true }),
  ])
  console.log(`Paso 1 · antes de borrar: study_groups=${gCount} · study_enrollments=${eCount}`)
  if (!DRY_RUN) {
    // Orden: enrollments primero (FK group_id CASCADE, pero explícito es más claro).
    const del1 = await supabase.from('study_enrollments').delete().not('id', 'is', null)
    if (del1.error) throw del1.error
    const del2 = await supabase.from('study_groups').delete().not('id', 'is', null)
    if (del2.error) throw del2.error
    console.log('Paso 1 · borrado OK (study_enrollments + study_groups)')
  } else {
    console.log('Paso 1 · (dry-run) no se borra')
  }

  // ── Paso 2: histórico ──
  const histRows = parse(readFileSync(HIST_FILE), { columns: true, bom: true, skip_empty_lines: true, relax_column_count: true }) as Array<Record<string, string>>

  // Grupos únicos por group_name (plan y líder más frecuentes).
  type GAcc = { planVotes: Map<string, number>; leaderVotes: Map<string, number> }
  const groupAcc = new Map<string, GAcc>()
  for (const r of histRows) {
    const gname = str(r.group_name)
    if (!gname) continue
    const acc = groupAcc.get(gname) ?? { planVotes: new Map(), leaderVotes: new Map() }
    const pc = str(r.plan_code)
    if (pc) acc.planVotes.set(pc, (acc.planVotes.get(pc) ?? 0) + 1)
    const ln = str(r.leader_name)
    if (ln) acc.leaderVotes.set(ln, (acc.leaderVotes.get(ln) ?? 0) + 1)
    groupAcc.set(gname, acc)
  }
  const mostFrequent = (m: Map<string, number>): string | null => {
    let best: string | null = null; let n = -1
    for (const [k, v] of m) if (v > n) { best = k; n = v }
    return best
  }

  const groupIdByName = new Map<string, string>()
  let groupsNoDate = 0, groupsNoLeader = 0, groupsNoPlan = 0
  const groupInserts: Array<{ id: string; plan_id: string; name: string; leader_id: string | null; starts_at: string | null; ends_at: string | null; status: string; is_virtual: boolean }> = []
  for (const [gname, acc] of groupAcc) {
    const planCode = mostFrequent(acc.planVotes) ?? ''
    const planId = planByCode.get(planCode) ?? null
    if (!planId) { groupsNoPlan++; continue } // sin plan no se puede crear el grupo; sus enrollments caerán a group_id null si igual matchean plan
    const leaderId = matchLeader(mostFrequent(acc.leaderVotes) ?? '')
    if (!leaderId) groupsNoLeader++
    const startsAt = parseStartFromName(gname)
    if (!startsAt) groupsNoDate++
    const endsAt = startsAt ? addWeeks(startsAt, durationWeeks(planCode)) : null
    const id = randomUUID()
    groupIdByName.set(gname, id)
    groupInserts.push({ id, plan_id: planId, name: gname, leader_id: leaderId, starts_at: startsAt, ends_at: endsAt, status: 'finalizado', is_virtual: false })
  }
  if (!DRY_RUN && groupInserts.length) {
    for (let i = 0; i < groupInserts.length; i += 500) {
      const chunk = groupInserts.slice(i, i + 500)
      const { error } = await supabase.from('study_groups').insert(chunk)
      if (error) { // fallback fila por fila
        for (const g of chunk) {
          const { error: e2 } = await supabase.from('study_groups').insert(g)
          if (e2) console.warn(`  grupo histórico falló (${g.name.slice(0, 40)}): ${e2.message}`)
        }
      }
    }
  }
  console.log(`Paso 2 · grupos históricos: ${groupInserts.length} (sin plan: ${groupsNoPlan} · sin fecha: ${groupsNoDate} · sin líder: ${groupsNoLeader})`)

  // Inscripciones.
  let enrOk = 0, skipMember = 0, skipPlan = 0
  const enrollBuffer: Array<Record<string, unknown>> = []
  async function flush() {
    if (DRY_RUN || !enrollBuffer.length) { enrollBuffer.length = 0; return }
    const chunk = enrollBuffer.splice(0, enrollBuffer.length)
    const { error } = await supabase.from('study_enrollments').insert(chunk)
    if (error) {
      for (const row of chunk) {
        const { error: e2 } = await supabase.from('study_enrollments').insert(row)
        if (e2) console.warn(`  enrollment falló (member ${row.member_id}): ${e2.message}`)
        else enrOk++
      }
    } else {
      enrOk += chunk.length
    }
  }
  for (const r of histRows) {
    const memberId = byExt.get(extId(r.member_external_id))
    if (!memberId) { skipMember++; continue }
    const planId = planByCode.get(str(r.plan_code))
    if (!planId) { skipPlan++; continue }
    const gname = str(r.group_name)
    const groupId = gname ? (groupIdByName.get(gname) ?? null) : null
    const completedAt = cleanDate(r.completed_at)
    enrollBuffer.push({
      member_id: memberId, plan_id: planId, group_id: groupId,
      status: 'completed', completed_at: completedAt, enrolled_at: completedAt,
    })
    if (DRY_RUN) { enrOk++; enrollBuffer.length = 0 }
    else if (enrollBuffer.length >= 500) await flush()
  }
  await flush()
  console.log(`Paso 2 · inscripciones: ${enrOk} (skip sin member: ${skipMember} · skip sin plan: ${skipPlan})`)

  // ── Paso 3: grupos abiertos ──
  const activeRows = parse(readFileSync(ACTIVE_FILE), { columns: true, bom: true, skip_empty_lines: true, relax_column_count: true }) as Array<Record<string, string>>
  let activeOk = 0, activeNoPlan = 0, activeNoLeader = 0
  const activeInserts: Array<Record<string, unknown>> = []
  for (const r of activeRows) {
    const name = str(r['Group Name'])
    if (!name) continue
    const planId = planByCode.get(str(r.plan_code))
    if (!planId) { activeNoPlan++; continue }
    const leaderId = matchLeader(str(r.lider))
    if (!leaderId) activeNoLeader++
    activeInserts.push({
      id: randomUUID(), plan_id: planId, name, leader_id: leaderId,
      starts_at: cleanDate(r.starts_at_str), ends_at: cleanDate(r.ends_at),
      status: 'en_curso', is_virtual: false,
    })
  }
  if (!DRY_RUN && activeInserts.length) {
    for (let i = 0; i < activeInserts.length; i += 500) {
      const chunk = activeInserts.slice(i, i + 500)
      const { error } = await supabase.from('study_groups').insert(chunk)
      if (error) {
        for (const g of chunk) {
          const { error: e2 } = await supabase.from('study_groups').insert(g)
          if (e2) console.warn(`  grupo activo falló (${String(g.name).slice(0, 40)}): ${e2.message}`)
          else activeOk++
        }
      } else { activeOk += chunk.length }
    }
  } else { activeOk = activeInserts.length }
  console.log(`Paso 3 · grupos abiertos: ${activeOk} (sin plan: ${activeNoPlan} · sin líder: ${activeNoLeader})`)

  // ── Paso 4: reporte ──
  console.log('\n──────── Reporte final ────────')
  console.log(`✅ study_groups creados: ${groupInserts.length + activeOk}  (histórico ${groupInserts.length} + abiertos ${activeOk})`)
  console.log(`✅ study_enrollments insertados: ${enrOk}`)
  console.log(`⚠️  Enrollments skipped (member no encontrado): ${skipMember}`)
  console.log(`⚠️  Enrollments skipped (plan no encontrado): ${skipPlan}`)
  console.log(`⚠️  Grupos sin fecha parseada: ${groupsNoDate}`)
  console.log(`⚠️  Grupos sin leader match: ${groupsNoLeader + activeNoLeader}`)
  console.log(`⚠️  Grupos históricos sin plan (omitidos): ${groupsNoPlan}`)
  console.log(DRY_RUN ? '\n(DRY-RUN: no se escribió nada)\n' : '\nListo.\n')
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
