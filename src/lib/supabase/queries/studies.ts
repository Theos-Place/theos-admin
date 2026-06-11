import { createAdminClient } from '@/lib/supabase/admin'

// NOTA: usamos createAdminClient (service role) porque la app corre con mock auth.
// Migrar a createClient de server.ts cuando haya Supabase Auth real.

// ── Tipos crudos ───────────────────────────────────────────

export type DbStudyPlan = {
  id: string
  code: string | null
  name: string
  description: string | null
  level: 'niveles' | 'etapa_inicial' | 'etapa_intermedia' | 'campanas'
  cost: number
  duration_weeks: number | null
  max_students: number | null
  requires_donor: boolean
  requires_attendance: boolean
  requires_payment: boolean
  requires_grade: boolean
  requires_server: boolean
  auto_promote: boolean
  prerequisite_code: string | null
  next_study_code: string | null
  min_attendance_pct: number
  is_active: boolean
  difficulty: string | null
  commitments: string | null
  mentor_id: string | null
}

export type DbGroupEnriched = {
  id: string
  plan: { code: string | null } | null
  name: string
  leader_id: string | null
  co_leader_id: string | null
  leader: { first_name: string; last_name: string } | null
  co_leader: { first_name: string; last_name: string } | null
  zone: string | null
  schedule_days: string[] | null
  schedule_time: string | null
  location: string | null
  max_students: number | null
  starts_at: string | null
  ends_at: string | null
  status: 'pending_leader' | 'pending_opening' | 'open' | 'in_progress' | 'finished'
  current_week: number
  whatsapp_group_url: string | null
  enrollments: Array<{
    member_id: string
    status: 'enrolled' | 'waitlist' | 'completed' | 'dropped' | 'transferred'
    grade: number | null
    member: { first_name: string; last_name: string } | null
  }>
}

// ── Queries ────────────────────────────────────────────────

/** Catálogo de planes de estudio (StudyType). */
export async function getStudyPlans(): Promise<DbStudyPlan[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('study_plans')
    .select('*')
    .order('code', { ascending: true })
  if (error) throw error
  return (data ?? []) as DbStudyPlan[]
}

export type DbLeaderEnriched = {
  id: string
  member_id: string
  zone_preference: string[] | null
  availability_status: 'available' | 'assigned' | 'resting' | 'inactive'
  is_active: boolean
  qualified_study_codes: string[] | null
  member: { first_name: string; last_name: string; is_donor: boolean } | null
  evaluations: Array<{
    id: string
    group_id: string | null
    score: number
    evaluation_date: string
    comments: string | null
  }>
}

/** Grupos de estudio con líder y participantes (enrollments + nombre del miembro). */
export async function getStudyGroups(): Promise<DbGroupEnriched[]> {
  const supabase = createAdminClient()
  // PostgREST corta en 1000 filas; hay >1000 grupos → paginar con range().
  const all: DbGroupEnriched[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('study_groups')
      .select(LIST_GROUP_SELECT)
      .order('starts_at', { ascending: false })
      .range(from, from + 999)
    if (error) throw error
    const batch = (data ?? []) as unknown as DbGroupEnriched[]
    all.push(...batch)
    if (batch.length < 1000) break
  }
  return all
}

const GROUP_SELECT = `
  id, name, leader_id, co_leader_id, zone, schedule_days, schedule_time, location,
  max_students, starts_at, ends_at, status, current_week, whatsapp_group_url,
  plan:study_plans(code),
  leader:members!study_groups_leader_id_fkey(first_name, last_name),
  co_leader:members!study_groups_co_leader_id_fkey(first_name, last_name),
  enrollments:study_enrollments!study_enrollments_group_id_fkey(
    member_id, status, grade,
    member:members(first_name, last_name)
  )
`

// Versión liviana para el LISTADO de grupos: participantes sin nombre ni nota
// (solo lo necesario para CONTAR). Los nombres se cargan en el detalle (getGroupById).
const LIST_GROUP_SELECT = `
  id, name, leader_id, co_leader_id, zone, schedule_days, schedule_time, location,
  max_students, starts_at, ends_at, status, current_week, whatsapp_group_url,
  plan:study_plans(code),
  leader:members!study_groups_leader_id_fkey(first_name, last_name),
  co_leader:members!study_groups_co_leader_id_fkey(first_name, last_name),
  enrollments:study_enrollments!study_enrollments_group_id_fkey(member_id, status)
`

export async function getGroupById(id: string): Promise<DbGroupEnriched | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('study_groups')
    .select(GROUP_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as DbGroupEnriched) ?? null
}

/**
 * Asistencia activa = ≥1 check-in de CHARLA en los últimos N días.
 * Criterio relajado a propósito: el histórico importado solo cubre eventos
 * puntuales (con "1 check-in por mes en 6 meses" NADIE calificaba). Cuando
 * haya varios meses de check-ins corrientes, endurecer subiendo la ventana
 * o volviendo al criterio mensual.
 */
export const ATTENDANCE_WINDOW_DAYS = 60

/** Ids de miembros con ≥1 check-in de charla en la ventana de asistencia. */
export async function getRecentCharlaAttendeeIds(days = ATTENDANCE_WINDOW_DAYS): Promise<Set<string>> {
  const supabase = createAdminClient()
  const since = new Date(Date.now() - days * 86400000).toISOString()
  const ids = new Set<string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('event_checkins')
      .select('member_id, events!inner(event_type)')
      .gte('checked_in_at', since)
      .eq('events.event_type', 'charla')
      .order('id')
      .range(from, from + 999)
    if (error) throw error
    for (const c of data as unknown as Array<{ member_id: string | null }>) {
      if (c.member_id) ids.add(c.member_id)
    }
    if (data.length < 1000) break
  }
  return ids
}

export type StudyDemandRow = {
  zone: string
  graduating: number
  eligible: number
  graduating_members: string[]
  eligible_members: string[]
}

export type StudyDemandResult = {
  rows: StudyDemandRow[]
  totalGraduating: number
  totalEligible: number
  studyInfo: {
    code: string
    name: string
    weeks: number
    stage: string
    prerequisite: string | null
    requirements: string[]
  }
}

const LEVEL_TO_STAGE: Record<string, string> = {
  niveles: 'niveles', etapa_inicial: 'inicial', etapa_intermedia: 'intermedia', campanas: 'campaña',
}

/**
 * Demanda estimada de un estudio para el bloque siguiente.
 *
 * Categoría A "por graduarse": inscritos HOY en el prerequisito, con fecha de
 * inicio conocida y ≥50% de las semanas cursadas (o ≤5 semanas restantes),
 * sin inscripción activa en el objetivo y cumpliendo los compromisos de la etapa.
 *
 * Categoría B "elegibles": completaron el prerequisito, no están inscritos ni
 * completaron el objetivo, no están en A, y cumplen los compromisos.
 *
 * Compromisos por etapa del estudio OBJETIVO:
 *   inicial    → donador + asistencia activa (1 check-in/mes en los últimos 6 meses)
 *   intermedia → donador + asistencia activa + servidor activo en comité
 *
 * Zona: sede del miembro; si no tiene, su provincia.
 */
export async function getStudyDemand(studyCode: string, now: Date = new Date()): Promise<StudyDemandResult> {
  const supabase = createAdminClient()

  // Plan objetivo: etapa, semanas y prerequisito.
  const { data: planRow, error: pErr } = await supabase
    .from('study_plans')
    .select('code, name, level, duration_weeks, prerequisite_code')
    .eq('code', studyCode)
    .maybeSingle()
  if (pErr) throw pErr
  const plan = planRow as { code: string; name: string; level: string; duration_weeks: number | null; prerequisite_code: string | null } | null
  if (!plan) throw new Error(`Plan ${studyCode} no encontrado`)
  const prereq = plan.prerequisite_code

  const stage = LEVEL_TO_STAGE[plan.level] ?? plan.level
  const requirements =
    stage === 'inicial' ? ['donador', 'asistencia']
    : stage === 'intermedia' ? ['donador', 'asistencia', 'servidor']
    : stage === 'niveles' ? ['asistencia'] // niveles: solo asistencia
    : []

  const studyInfo = {
    code: plan.code,
    name: plan.name,
    weeks: plan.duration_weeks ?? 0,
    stage,
    prerequisite: prereq,
    requirements,
  }

  // Sin prerequisito (Niveles, campañas) este análisis no aplica.
  if (!prereq) {
    return { rows: [], totalGraduating: 0, totalEligible: 0, studyInfo }
  }

  // Semanas totales del prerequisito, para el umbral de avance de Categoría A.
  const { data: prereqPlan } = await supabase
    .from('study_plans')
    .select('duration_weeks')
    .eq('code', prereq)
    .maybeSingle()
  const prereqWeeks = (prereqPlan as { duration_weeks: number | null } | null)?.duration_weeks ?? null

  // Inscripciones (activas + completadas) con inicio del grupo, código del plan
  // y datos del miembro (compromisos + zona). Paginado: PostgREST corta en 1000.
  type EnrollRow = {
    member_id: string
    status: string
    group: { starts_at: string | null; plan: { code: string | null } | null } | null
    member: { is_donor: boolean; province: string | null; is_active: boolean; sede: { code: string } | null } | null
  }
  const enrollments: EnrollRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('study_enrollments')
      .select(`
        member_id, status,
        group:study_groups!study_enrollments_group_id_fkey(starts_at, plan:study_plans(code)),
        member:members(is_donor, province, is_active, sede:sedes(code))
      `)
      .in('status', ['enrolled', 'completed'])
      .order('id')
      .range(from, from + 999)
    if (error) throw error
    const batch = (data ?? []) as unknown as EnrollRow[]
    enrollments.push(...batch)
    if (batch.length < 1000) break
  }

  // Compromisos: asistencia = charla en los últimos ATTENDANCE_WINDOW_DAYS días.
  const { getServerMemberIds } = await import('./members')
  const [attendanceSet, serverIds] = await Promise.all([
    requirements.includes('asistencia') ? getRecentCharlaAttendeeIds() : Promise.resolve(new Set<string>()),
    requirements.includes('servidor') ? getServerMemberIds() : Promise.resolve([]),
  ])
  const serverSet = new Set(serverIds)

  type MemberState = {
    zone: string
    isDonor: boolean
    isActive: boolean
    completedPrereq: boolean
    enrolledTarget: boolean
    completedTarget: boolean
    prereqStartsAt: string | null // inicio del grupo de su inscripción ACTIVA en el prereq
  }
  const byMember = new Map<string, MemberState>()
  for (const r of enrollments) {
    const code = r.group?.plan?.code
    if (!code) continue
    const entry = byMember.get(r.member_id) ?? {
      zone: r.member?.sede?.code ?? r.member?.province ?? 'Sin zona',
      isDonor: r.member?.is_donor ?? false,
      isActive: r.member?.is_active ?? true,
      completedPrereq: false,
      enrolledTarget: false,
      completedTarget: false,
      prereqStartsAt: null,
    }
    if (code === prereq) {
      if (r.status === 'completed') entry.completedPrereq = true
      if (r.status === 'enrolled') entry.prereqStartsAt = r.group?.starts_at ?? entry.prereqStartsAt
    }
    if (code === studyCode) {
      if (r.status === 'enrolled') entry.enrolledTarget = true
      if (r.status === 'completed') entry.completedTarget = true
    }
    byMember.set(r.member_id, entry)
  }

  function meetsCommitments(memberId: string, m: MemberState): boolean {
    if (requirements.includes('donador') && !m.isDonor) return false
    if (requirements.includes('asistencia') && !attendanceSet.has(memberId)) return false
    if (requirements.includes('servidor') && !serverSet.has(memberId)) return false
    return true
  }

  const zones = new Map<string, { graduating: string[]; eligible: string[] }>()
  const nowMs = now.getTime()

  for (const [memberId, m] of byMember) {
    if (!m.isActive || m.enrolledTarget || m.completedTarget) continue
    if (!meetsCommitments(memberId, m)) continue

    // Categoría A: cursando el prereq con avance suficiente
    // (≥50% de las semanas o ≤5 semanas restantes).
    let isGraduating = false
    if (m.prereqStartsAt && prereqWeeks && prereqWeeks > 0) {
      const weeksElapsed = (nowMs - new Date(m.prereqStartsAt).getTime()) / (7 * 86400000)
      isGraduating = weeksElapsed >= prereqWeeks / 2 || prereqWeeks - weeksElapsed <= 5
    }

    if (!isGraduating && !m.completedPrereq) continue

    const zone = zones.get(m.zone) ?? { graduating: [], eligible: [] }
    if (isGraduating) zone.graduating.push(memberId)
    else zone.eligible.push(memberId) // Categoría B (excluye a los de A)
    zones.set(m.zone, zone)
  }

  const rowsOut: StudyDemandRow[] = Array.from(zones.entries())
    .map(([zone, v]) => ({
      zone,
      graduating: v.graduating.length,
      eligible: v.eligible.length,
      graduating_members: v.graduating,
      eligible_members: v.eligible,
    }))
    .filter(r => r.graduating + r.eligible > 0)
    .sort((a, b) => (b.graduating + b.eligible) - (a.graduating + a.eligible))

  return {
    rows: rowsOut,
    totalGraduating: rowsOut.reduce((s, r) => s + r.graduating, 0),
    totalEligible: rowsOut.reduce((s, r) => s + r.eligible, 0),
    studyInfo,
  }
}

/** Perfil académico de un miembro para calcular elegibilidad de matrícula.
 *  Devuelve los CÓDIGOS de plan (no nombres) y los compromisos reales. */
export async function getMemberStudyProfile(memberId: string): Promise<{
  completed_codes: string[]
  current_code: string | null
  is_donor: boolean
  is_server: boolean
  charla_count: number
}> {
  const supabase = createAdminClient()
  const [memberRes, enrRes, volRes, chkRes] = await Promise.all([
    supabase.from('members').select('is_donor').eq('id', memberId).maybeSingle(),
    supabase
      .from('study_enrollments')
      .select('status, study_groups!study_enrollments_group_id_fkey(plan:study_plans(code))')
      .eq('member_id', memberId),
    supabase.from('volunteers').select('id').eq('member_id', memberId).eq('status', 'active').limit(1),
    supabase
      .from('event_checkins')
      .select('id, events!inner(event_type)')
      .eq('member_id', memberId)
      .eq('events.event_type', 'charla'),
  ])

  const enrollments = (enrRes.data ?? []) as unknown as Array<{ status: string; study_groups: { plan: { code: string } | null } | null }>
  const completed_codes = enrollments
    .filter(e => e.status === 'completed' && e.study_groups?.plan?.code)
    .map(e => e.study_groups!.plan!.code)
  const current_code = enrollments
    .find(e => e.status === 'enrolled' && e.study_groups?.plan?.code)
    ?.study_groups?.plan?.code ?? null

  return {
    completed_codes,
    current_code,
    is_donor: Boolean((memberRes.data as { is_donor?: boolean } | null)?.is_donor),
    is_server: (volRes.data ?? []).length > 0,
    charla_count: (chkRes.data ?? []).length,
  }
}

export type MemberStudyEligibility = {
  /** Inscripciones activas (para el dropdown de "grupo actual" en reubicación). */
  active_enrollments: Array<{ group_id: string; group_name: string; plan_code: string | null }>
  /** Planes que el miembro puede solicitar: no llevados + prerequisito + compromisos. */
  eligible_plans: Array<{ id: string; code: string; name: string; stage: string }>
  /** Compromisos del miembro (para mensajes de la UI). */
  commitments: { is_donor: boolean; attendance_active: boolean; is_server: boolean }
}

const ELIG_LEVEL_TO_STAGE: Record<string, string> = {
  niveles: 'niveles', etapa_inicial: 'inicial', etapa_intermedia: 'intermedia', campanas: 'campaña',
}

/**
 * Elegibilidad de estudios de UN miembro, centralizada para los modales de
 * solicitud (perfil del miembro y flujo del coordinador).
 *
 * Un plan es solicitable si:
 *  - el miembro no lo llevó (sin inscripción completed ni enrolled), y
 *  - cumple el prerequisito de la cadena (completed del prereq), y
 *  - cumple los compromisos de la etapa: inicial = donador + asistencia activa
 *    (1 check-in/mes, 6 meses); intermedia = + servidor activo.
 */
export async function getEligibleStudiesForMember(memberId: string): Promise<MemberStudyEligibility> {
  const supabase = createAdminClient()

  // Misma ventana de asistencia que el análisis de demanda (criterio unificado).
  const since = new Date(Date.now() - ATTENDANCE_WINDOW_DAYS * 86400000).toISOString()

  const [memberRes, enrRes, volRes, chkRes, plansRes] = await Promise.all([
    supabase.from('members').select('is_donor').eq('id', memberId).maybeSingle(),
    supabase
      .from('study_enrollments')
      .select('status, group:study_groups!study_enrollments_group_id_fkey(id, name, plan:study_plans(code))')
      .eq('member_id', memberId),
    supabase.from('volunteers').select('id').eq('member_id', memberId).eq('status', 'active').limit(1),
    supabase
      .from('event_checkins')
      .select('id, events!inner(event_type)')
      .eq('member_id', memberId)
      .eq('events.event_type', 'charla')
      .gte('checked_in_at', since)
      .limit(1),
    supabase
      .from('study_plans')
      .select('id, code, name, level, prerequisite_code')
      .eq('is_active', true)
      .order('code'),
  ])

  const enrollments = (enrRes.data ?? []) as unknown as Array<{
    status: string
    group: { id: string; name: string; plan: { code: string | null } | null } | null
  }>
  const completed = new Set(
    enrollments.filter(e => e.status === 'completed' && e.group?.plan?.code).map(e => e.group!.plan!.code!),
  )
  const enrolledCodes = new Set(
    enrollments.filter(e => e.status === 'enrolled' && e.group?.plan?.code).map(e => e.group!.plan!.code!),
  )
  const active_enrollments = enrollments
    .filter(e => e.status === 'enrolled' && e.group)
    .map(e => ({ group_id: e.group!.id, group_name: e.group!.name, plan_code: e.group!.plan?.code ?? null }))

  // Asistencia activa: al menos 1 check-in en cada uno de los últimos 6 meses.
  // ≥1 check-in de charla en la ventana (mismo criterio que getStudyDemand).
  const attendance_active = (chkRes.data ?? []).length > 0

  const is_donor = Boolean((memberRes.data as { is_donor?: boolean } | null)?.is_donor)
  const is_server = (volRes.data ?? []).length > 0

  const meetsStage = (stage: string): boolean => {
    if (stage === 'inicial') return is_donor && attendance_active
    if (stage === 'intermedia') return is_donor && attendance_active && is_server
    if (stage === 'niveles') return attendance_active // niveles: solo asistencia
    return true // campañas: sin compromisos
  }

  const plans = (plansRes.data ?? []) as Array<{
    id: string; code: string | null; name: string; level: string; prerequisite_code: string | null
  }>
  const eligible_plans = plans
    .filter(p => p.code)
    .map(p => ({ ...p, stage: ELIG_LEVEL_TO_STAGE[p.level] ?? p.level }))
    .filter(p =>
      !completed.has(p.code!) &&
      !enrolledCodes.has(p.code!) &&
      (!p.prerequisite_code || completed.has(p.prerequisite_code)) &&
      meetsStage(p.stage),
    )
    .map(p => ({ id: p.id, code: p.code!, name: p.name, stage: p.stage }))

  return {
    active_enrollments,
    eligible_plans,
    commitments: { is_donor, attendance_active, is_server },
  }
}

/** Sesiones de asistencia de un grupo con conteo de presentes. */
export async function getGroupSessions(groupId: string): Promise<Array<{ id: string; date: string; topic: string | null; present: number; total: number }>> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('study_sessions')
    .select('id, session_date, topic, study_attendance(present)')
    .eq('group_id', groupId)
    .order('session_date', { ascending: true })
  if (error) throw error
  const rows = (data ?? []) as unknown as Array<{ id: string; session_date: string; topic: string | null; study_attendance: Array<{ present: boolean }> }>
  return rows.map(r => ({
    id: r.id, date: r.session_date, topic: r.topic,
    present: r.study_attendance.filter(a => a.present).length,
    total: r.study_attendance.length,
  }))
}

/** Registra la asistencia de una sesión: crea la sesión y las filas de presencia. */
export async function saveGroupAttendance(
  groupId: string,
  input: { session_date: string; topic?: string | null; notes?: string | null; attendance: { member_id: string; present: boolean }[] },
): Promise<{ session_id: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('study_sessions')
    .insert({ group_id: groupId, session_date: input.session_date, topic: input.topic ?? null, notes: input.notes ?? null })
    .select('id')
    .single()
  if (error) throw error
  const sessionId = (data as { id: string }).id

  if (input.attendance.length > 0) {
    const rows = input.attendance.map(a => ({ session_id: sessionId, member_id: a.member_id, present: a.present }))
    const { error: aErr } = await supabase.from('study_attendance').insert(rows)
    if (aErr) throw aErr
  }
  return { session_id: sessionId }
}

/** Dirigentes de estudio con miembro y evaluaciones. */
export async function getStudyLeaders(): Promise<DbLeaderEnriched[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('study_leaders')
    .select(`
      id, member_id, zone_preference, availability_status, is_active, qualified_study_codes,
      member:members(first_name, last_name, is_donor),
      evaluations:leader_evaluations(id, group_id, score, evaluation_date, comments)
    `)
  if (error) throw error
  return (data ?? []) as unknown as DbLeaderEnriched[]
}

/** Dirigentes ACTIVOS = servidores activos del comité "Comité de Dirigentes".
 *  Fuente de verdad para el estado "activo" de un dirigente. */
export async function getActiveDirigentes(): Promise<Array<{ member_id: string; member_name: string }>> {
  const supabase = createAdminClient()
  const { data: area, error: aErr } = await supabase
    .from('areas')
    .select('id')
    .eq('area_type', 'committee')
    .ilike('name', 'Comité de Dirigentes')
    .maybeSingle()
  if (aErr) throw aErr
  if (!area) return []

  const { data, error } = await supabase
    .from('volunteers')
    .select('member_id, member:members(first_name, last_name), service_positions!inner(area_id)')
    .eq('status', 'active')
    .eq('service_positions.area_id', (area as { id: string }).id)
  if (error) throw error

  const seen = new Map<string, string>()
  for (const v of (data ?? []) as unknown as Array<{ member_id: string; member: { first_name: string; last_name: string } | null }>) {
    if (!seen.has(v.member_id)) {
      seen.set(v.member_id, v.member ? `${v.member.first_name} ${v.member.last_name}`.trim() : '')
    }
  }
  return [...seen].map(([member_id, member_name]) => ({ member_id, member_name }))
}

/** Marca a un miembro como dirigente. Crea la designación (study_leaders).
 *  Si `active`, además lo agrega como servidor activo al Comité de Dirigentes
 *  (puesto "Dirigente"). Inactivo = solo designación, sin comité. */
export async function addDirigente(memberId: string, active: boolean): Promise<void> {
  const supabase = createAdminClient()
  const { error: lErr } = await supabase.from('study_leaders').upsert(
    {
      member_id: memberId,
      is_active: active,
      availability_status: active ? 'available' : 'inactive',
      zone_preference: [],
      qualified_study_codes: [],
    },
    { onConflict: 'member_id' },
  )
  if (lErr) throw lErr

  if (active) {
    const { data: area } = await supabase
      .from('areas').select('id').eq('area_type', 'committee').ilike('name', 'Comité de Dirigentes').maybeSingle()
    if (area) {
      const { data: pos } = await supabase
        .from('service_positions').select('id').eq('area_id', (area as { id: string }).id).eq('is_active', true).limit(1).maybeSingle()
      if (pos) {
        const { error: vErr } = await supabase.from('volunteers').upsert(
          { member_id: memberId, position_id: (pos as { id: string }).id, status: 'active' },
          { onConflict: 'member_id,position_id' },
        )
        if (vErr) throw vErr
      }
    }
  }
}

// ── Mutaciones ─────────────────────────────────────────────

export type PlanWriteInput = {
  name: string
  code?: string | null
  description?: string | null
  level: DbStudyPlan['level']
  cost?: number
  duration_weeks?: number | null
  max_students?: number | null
  requires_donor?: boolean
  requires_attendance?: boolean
  requires_payment?: boolean
  requires_grade?: boolean
  requires_server?: boolean
  requires_invitation?: boolean
  auto_promote?: boolean
  prerequisite_code?: string | null
  next_study_code?: string | null
  min_attendance_pct?: number
  is_active?: boolean
  difficulty?: string | null
  commitments?: string | null
  mentor_id?: string | null
}

export type GroupWriteInput = {
  plan_id?: string
  name: string
  leader_id?: string | null
  co_leader_id?: string | null
  zone?: string | null
  schedule_days?: string[] | null
  schedule_time?: string | null
  location?: string | null
  sede?: string | null
  max_students?: number | null
  starts_at?: string | null
  ends_at?: string | null
  status?: DbGroupEnriched['status']
  current_week?: number
  whatsapp_group_url?: string | null
}

/** Resuelve el UUID de un plan a partir de su `code` (el frontend usa code). */
export async function getPlanIdByCode(code: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('study_plans').select('id').eq('code', code).maybeSingle()
  if (error) throw error
  return data ? (data as { id: string }).id : null
}

// Planes
export async function createPlan(input: PlanWriteInput): Promise<DbStudyPlan> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('study_plans').insert(input).select('*').single()
  if (error) throw error
  return data as DbStudyPlan
}

export async function updatePlan(id: string, patch: Partial<PlanWriteInput>): Promise<DbStudyPlan> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('study_plans').update(patch).eq('id', id).select('*').single()
  if (error) throw error
  return data as DbStudyPlan
}

// Grupos
export async function createGroup(input: GroupWriteInput): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('study_groups').insert(input).select('id').single()
  if (error) throw error
  return data as { id: string }
}

export async function updateGroup(id: string, patch: Partial<GroupWriteInput>): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('study_groups').update(patch).eq('id', id)
  if (error) throw error
}

/** Agrega un estudio al historial de un miembro SIN grupo (ej. estudios viejos,
 *  cuando el sistema no existía). group_id queda nulo; el plan va directo. */
export async function addMemberStudy(input: {
  member_id: string
  plan_id: string
  completed_at: string | null
  status?: string
}): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('study_enrollments').insert({
    member_id: input.member_id,
    plan_id: input.plan_id,
    group_id: null,
    status: input.status ?? 'completed',
    completed_at: input.completed_at,
  })
  if (error) throw error
}

export type CloseResult = {
  member_id: string
  status_result: 'aprobado' | 'reprobado' | 'retirado'
  grade?: number | null
}

/**
 * Cierra un grupo: finaliza cada matrícula según su resultado y marca el grupo
 * como 'finished'. aprobado/reprobado → 'completed' (la nota distingue el
 * resultado; se guarda la etiqueta en notes). retirado → 'dropped'.
 */
export async function closeGroup(groupId: string, results: CloseResult[]): Promise<void> {
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  for (const r of results) {
    if (r.status_result === 'retirado') {
      const { error } = await supabase
        .from('study_enrollments')
        .update({ status: 'dropped', dropped_at: now, drop_reason: 'Retirado en cierre' })
        .eq('group_id', groupId)
        .eq('member_id', r.member_id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('study_enrollments')
        .update({
          status: 'completed',
          completed_at: now,
          grade: r.grade ?? null,
          notes: r.status_result,
        })
        .eq('group_id', groupId)
        .eq('member_id', r.member_id)
      if (error) throw error
    }
  }

  const { error: gErr } = await supabase
    .from('study_groups')
    .update({ status: 'finished' })
    .eq('id', groupId)
  if (gErr) throw gErr
}

// Inscripciones
export async function enrollMember(groupId: string, memberId: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('study_enrollments')
    .upsert({ group_id: groupId, member_id: memberId, status: 'enrolled' }, { onConflict: 'group_id,member_id' })
  if (error) throw error
}

export async function withdrawMember(groupId: string, memberId: string, reason?: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('study_enrollments')
    .update({ status: 'dropped', dropped_at: new Date().toISOString(), drop_reason: reason ?? null })
    .eq('group_id', groupId)
    .eq('member_id', memberId)
  if (error) throw error
}

export async function setEnrollmentGrade(groupId: string, memberId: string, grade: number): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('study_enrollments')
    .update({ grade })
    .eq('group_id', groupId)
    .eq('member_id', memberId)
  if (error) throw error
}

// Líderes
export type LeaderWriteInput = {
  member_id: string
  zone_preference?: string[]
  availability_status?: DbLeaderEnriched['availability_status']
  is_active?: boolean
  qualified_study_codes?: string[]
}

export async function createLeader(input: LeaderWriteInput): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('study_leaders').insert(input).select('id').single()
  if (error) throw error
  return data as { id: string }
}

/** Actualiza (o crea) la configuración de un dirigente por member_id: estudios
 *  que imparte (qualified_study_codes) y zonas dispuesto (zone_preference). */
export async function updateDirigenteConfig(
  memberId: string,
  patch: { qualified_study_codes?: string[]; zone_preference?: string[] },
): Promise<void> {
  const supabase = createAdminClient()
  const { data: existing } = await supabase
    .from('study_leaders').select('id').eq('member_id', memberId).maybeSingle()
  if (existing) {
    const { error } = await supabase.from('study_leaders').update(patch).eq('member_id', memberId)
    if (error) throw error
  } else {
    const { error } = await supabase.from('study_leaders').insert({
      member_id: memberId,
      is_active: false,
      availability_status: 'inactive',
      zone_preference: patch.zone_preference ?? [],
      qualified_study_codes: patch.qualified_study_codes ?? [],
    })
    if (error) throw error
  }
}

export async function updateLeader(id: string, patch: Partial<LeaderWriteInput>): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('study_leaders').update(patch).eq('id', id)
  if (error) throw error
}
