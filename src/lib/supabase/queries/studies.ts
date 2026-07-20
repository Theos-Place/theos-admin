import { createAdminClient, type Insertable, type Updatable } from '@/lib/supabase/admin'
import { applyMemberSearch } from '@/lib/supabase/queries/members'
import { REQUIRES_CEDULA_CODES } from '@/lib/cedula'
import { ymdCR } from '@/lib/format'
import type { Json } from '@/types/database'

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
  requires_bus_talk: boolean
  auto_promote: boolean
  prerequisite_code: string | null
  next_study_code: string | null
  min_attendance_pct: number
  is_active: boolean
  difficulty: string | null
  commitments: string | null
  mentor_id: string | null
  /** Mentor (dirigente referente) resuelto por join — para mostrar su nombre
   *  sin cargar toda la maquinaria de dirigentes. Solo lo trae getStudyPlans. */
  mentor?: { first_name: string; last_name: string } | null
  /** FALSE = charla introductoria (ej. BUS), fuera de análisis/matrícula/plan. */
  is_curricular: boolean
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
  status: 'en_matricula' | 'en_curso' | 'finalizado'
  current_week: number
  whatsapp_group_url: string | null
  is_leader_training: boolean | null
  training_modality: string | null
  is_virtual: boolean | null
  age_min: number | null
  age_max: number | null
  enrollments: Array<{
    member_id: string
    status: 'enrolled' | 'waitlist' | 'completed' | 'dropped' | 'transferred' | 'pendiente_de_pago' | 'expirada'
    grade: number | null
    /** Resultado del cierre: 'aprobado' o 'reprobado: <motivo>'. */
    notes: string | null
    member: { first_name: string; last_name: string } | null
  }>
}

// ── Queries ────────────────────────────────────────────────

/** Catálogo de planes de estudio (StudyType). */
export async function getStudyPlans(): Promise<DbStudyPlan[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('study_plans')
    .select('*, mentor:members!study_plans_mentor_id_fkey(first_name, last_name)')
    .order('code', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as DbStudyPlan[]
}

/** Métricas del resumen de estudios, calculadas en la BD (no client-side).
 *  Categorías por study_plans.level:
 *    niveles        = N1–N4
 *    capacitaciones = etapa_inicial + etapa_intermedia
 *  Campañas (campanas) quedan FUERA de ambos boxes (se reportan aparte si hace falta).
 *  Estudiantes:
 *    activos (en_curso)   → inscripciones 'enrolled'  (los que cursan hoy)
 *    histórico (finalizado) → inscripciones 'completed' (los que pasaron por el grupo) */
/** Conteo de un box: grupos, inscripciones (participaciones) y estudiantes únicos
 *  (personas distintas). Todos EXCLUYEN a los dirigentes (líder/co-líder). */
export type StudyCount = { grupos: number; inscripciones: number; unicos: number }
export type StudyDashboardStats = {
  activos:   { niveles: StudyCount; capacitaciones: StudyCount }
  historico: { niveles: StudyCount; capacitaciones: StudyCount }
  campanas: StudyCount
}

export async function getStudyDashboardStats(): Promise<StudyDashboardStats> {
  const supabase = createAdminClient()
  // Vía RPC: por estado+categoría → grupos, inscripciones y únicos, excluyendo
  // dirigentes (study_dashboard_stats_v2). Campañas con su propio RPC.
  const [{ data, error }, { data: campRows }] = await Promise.all([
    supabase.rpc('study_dashboard_stats_v2'),
    supabase.rpc('campaign_student_counts'),
  ])
  if (error) throw error

  const c = (campRows?.[0] ?? {}) as Partial<StudyCount>
  const empty: StudyCount = { grupos: 0, inscripciones: 0, unicos: 0 }
  const stats: StudyDashboardStats = {
    activos:   { niveles: { ...empty }, capacitaciones: { ...empty } },
    historico: { niveles: { ...empty }, capacitaciones: { ...empty } },
    campanas: { grupos: Number(c.grupos ?? 0), inscripciones: Number(c.inscripciones ?? 0), unicos: Number(c.unicos ?? 0) },
  }
  for (const r of (data ?? []) as Array<{ estado: string; categoria: string; grupos: number; inscripciones: number; unicos: number }>) {
    const bucket = r.estado === 'en_curso' ? stats.activos : r.estado === 'finalizado' ? stats.historico : null
    if (!bucket) continue
    const val: StudyCount = { grupos: Number(r.grupos), inscripciones: Number(r.inscripciones), unicos: Number(r.unicos) }
    if (r.categoria === 'niveles') bucket.niveles = val
    else if (r.categoria === 'capacitaciones') bucket.capacitaciones = val
  }
  return stats
}

export type DbLeaderEnriched = {
  id: string
  member_id: string
  zone_preference: string[] | null
  availability_status: 'available' | 'assigned' | 'resting' | 'inactive'
  is_active: boolean
  qualified_study_codes: string[] | null
  formation_study_codes: string[] | null
  member: { first_name: string; last_name: string; is_donor: boolean } | null
  evaluations: Array<{
    id: string
    group_id: string | null
    score: number
    evaluation_date: string
    comments: string | null
  }>
}

/** Item del LISTADO de grupos: en vez de enrollments embebidos lleva solo
 *  CONTEOS por estado de dominio (C5 auditoría 2026-06-11: el listado pesaba
 *  varios MB y los consumidores solo cuentan). Los enrollments completos se
 *  cargan en el detalle (getGroupById) o vía getStudyGroupsWithEnrollments. */
export type DbGroupListItem = Omit<DbGroupEnriched, 'enrollments'> & {
  enrollment_counts: { enrolled: number; pending: number; withdrawn: number }
}

type RawListGroup = Omit<DbGroupEnriched, 'enrollments'> & {
  enrollments: Array<{ member_id: string; status: DbGroupEnriched['enrollments'][number]['status'] }>
}

// Misma agrupación que mapParticipantStatus del adapter de dominio.
function toListItem(g: RawListGroup): DbGroupListItem {
  const counts = { enrolled: 0, pending: 0, withdrawn: 0 }
  for (const e of g.enrollments) {
    // La capacidad es de ESTUDIANTES: el dirigente/co-dirigente no cuenta aunque
    // tenga inscripción en su propio grupo.
    if (e.member_id === g.leader_id || e.member_id === g.co_leader_id) continue
    if (e.status === 'enrolled' || e.status === 'completed') counts.enrolled++
    else if (e.status === 'waitlist' || e.status === 'pendiente_de_pago') counts.pending++
    else counts.withdrawn++ // dropped | transferred | expirada
  }
  const { enrollments: _omit, ...rest } = g
  return { ...rest, enrollment_counts: counts }
}

/** Grupos de estudio con líder y conteos de participantes.
 *  Sin opts devuelve TODOS (comportamiento histórico, total = data.length);
 *  con page/pageSize devuelve esa página + total exacto. */
/** Filtros del listado de grupos — viajan al servidor (no se filtra en memoria). */
export type GroupFilters = {
  statuses?: string[]
  planCode?: string | null
  zone?: string | null
  /** Día de la semana abreviado (L/M/X/J/V/S/D); match contra schedule_days. */
  day?: string | null
  /** Búsqueda por nombre de grupo o de dirigente/co-dirigente. */
  search?: string | null
  /** Solo grupos sin dirigente asignado (leader_id null). */
  noLeader?: boolean
  /** Solo grupos "prontos a cerrar": ends_at entre hoy y +30 días (mismo criterio
   *  que el conteo del dashboard `closing_soon`). */
  closingSoon?: boolean
}

/** Resuelve las partes de los filtros que viven en tablas relacionadas:
 *  el plan (code → id) y los dirigentes que matchean la búsqueda (nombre → ids).
 *  Devuelve la cláusula `or` de búsqueda ya armada y el plan_id a igualar. */
async function resolveGroupFilters(
  supabase: ReturnType<typeof createAdminClient>,
  f: GroupFilters,
): Promise<{ planId: string | null; searchOr: string | null }> {
  let planId: string | null = null
  if (f.planCode) {
    // Plan inexistente → id imposible para forzar resultado vacío.
    planId = (await getPlanIdByCode(f.planCode)) ?? '00000000-0000-0000-0000-000000000000'
  }

  let searchOr: string | null = null
  if (f.search && f.search.trim()) {
    // Sanitizar metacaracteres de PostgREST (.,()%*\) antes de interpolar en .or()
    // — mismo criterio que finance.ts y servers.ts (evita filter injection).
    const like = `%${f.search.trim().replace(/[%,().*\\]/g, '')}%`
    // search_text: normalizado (sin tildes) + índice GIN trgm (migración 083);
    // el .or por first/last no tenía soporte de índice.
    const { data: members } = await applyMemberSearch(
      supabase.from('members').select('id'), f.search,
    ).limit(500)
    const memberIds = ((members ?? []) as Array<{ id: string }>).map(m => m.id)
    const parts = [`name.ilike.${like}`]
    if (memberIds.length > 0) {
      parts.push(`leader_id.in.(${memberIds.join(',')})`, `co_leader_id.in.(${memberIds.join(',')})`)
    }
    searchOr = parts.join(',')
  }
  return { planId, searchOr }
}

export async function getStudyGroups(
  opts: { page?: number; pageSize?: number; filters?: GroupFilters } = {},
): Promise<{ data: DbGroupListItem[]; total: number }> {
  const supabase = createAdminClient()
  const f = opts.filters ?? {}
  const { planId, searchOr } = await resolveGroupFilters(supabase, f)
  // Ventana "prontos a cerrar": [hoy, hoy+30d] — idéntico al conteo del dashboard.
  // QA 2026-07-17: fechas en zona CR — con toISOString() (UTC) la ventana se
  // corría un día entre 6pm y medianoche hora CR.
  const closeFrom = ymdCR()
  const closeTo = ymdCR(new Date(Date.now() + 30 * 86400000))

  if (opts.page !== undefined || opts.pageSize !== undefined) {
    const page = Math.max(1, opts.page ?? 1)
    const pageSize = Math.max(1, opts.pageSize ?? 50)
    const from = (page - 1) * pageSize
    let query = supabase
      .from('study_groups')
      .select(LIST_GROUP_SELECT, { count: 'exact' })
      .order('ends_at', { ascending: false, nullsFirst: false })
    if (f.statuses?.length) query = query.in('status', f.statuses)
    if (f.zone)  query = query.eq('zone', f.zone)
    if (f.day)   query = query.contains('schedule_days', [f.day])
    if (f.noLeader) query = query.is('leader_id', null)
    if (f.closingSoon) query = query.not('ends_at', 'is', null).gte('ends_at', closeFrom).lte('ends_at', closeTo).neq('status', 'finalizado')
    if (planId)  query = query.eq('plan_id', planId)
    if (searchOr) query = query.or(searchOr)
    const { data, error, count } = await query.range(from, from + pageSize - 1)
    if (error) throw error
    return { data: ((data ?? []) as RawListGroup[]).map(toListItem), total: count ?? 0 }
  }

  // Sin page/pageSize: TODOS los grupos (con filtros) — usado por el export.
  // PostgREST corta en 1000 filas; hay >1000 grupos → paginar con range().
  const all: DbGroupListItem[] = []
  for (let from = 0; ; from += 1000) {
    let query = supabase
      .from('study_groups')
      .select(LIST_GROUP_SELECT)
      .order('ends_at', { ascending: false, nullsFirst: false })
    if (f.statuses?.length) query = query.in('status', f.statuses)
    if (f.zone)  query = query.eq('zone', f.zone)
    if (f.day)   query = query.contains('schedule_days', [f.day])
    if (f.noLeader) query = query.is('leader_id', null)
    if (f.closingSoon) query = query.not('ends_at', 'is', null).gte('ends_at', closeFrom).lte('ends_at', closeTo).neq('status', 'finalizado')
    if (planId)  query = query.eq('plan_id', planId)
    if (searchOr) query = query.or(searchOr)
    const { data, error } = await query.range(from, from + 999)
    if (error) throw error
    const batch = (data ?? []) as RawListGroup[]
    all.push(...batch.map(toListItem))
    if (batch.length < 1000) break
  }
  return { data: all, total: all.length }
}

/** Variante con enrollments embebidos (member_id + status) para consumidores
 *  que necesitan los IDs de los inscritos por grupo (ej. RecipientSelector de
 *  comunicaciones). Usar solo cuando los conteos no alcanzan. */
export async function getStudyGroupsWithEnrollments(): Promise<DbGroupEnriched[]> {
  const supabase = createAdminClient()
  const all: DbGroupEnriched[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('study_groups')
      .select(LIST_GROUP_MEMBERS_SELECT)
      .order('starts_at', { ascending: false })
      .range(from, from + 999)
    if (error) throw error
    const batch = (data ?? []) as DbGroupEnriched[]
    all.push(...batch)
    if (batch.length < 1000) break
  }
  return all
}

const GROUP_SELECT = `
  id, name, leader_id, co_leader_id, zone, schedule_days, schedule_time, location,
  max_students, starts_at, ends_at, status, current_week, whatsapp_group_url,
  is_leader_training, training_modality, is_virtual,
  age_min, age_max,
  plan:study_plans(code),
  leader:members!study_groups_leader_id_fkey(first_name, last_name),
  co_leader:members!study_groups_co_leader_id_fkey(first_name, last_name),
  enrollments:study_enrollments!study_enrollments_group_id_fkey(
    member_id, status, grade, notes,
    member:members(first_name, last_name)
  )
`

// Versión liviana para el LISTADO de grupos: enrollments con solo `status`
// (lo único necesario para CONTAR; los conteos se calculan en toListItem).
// Los nombres/notas se cargan en el detalle (getGroupById).
const LIST_GROUP_SELECT = `
  id, name, leader_id, co_leader_id, zone, schedule_days, schedule_time, location,
  max_students, starts_at, ends_at, status, current_week, whatsapp_group_url,
  is_leader_training, training_modality, is_virtual,
  age_min, age_max,
  plan:study_plans(code),
  leader:members!study_groups_leader_id_fkey(first_name, last_name),
  co_leader:members!study_groups_co_leader_id_fkey(first_name, last_name),
  enrollments:study_enrollments!study_enrollments_group_id_fkey(member_id, status)
`

// Igual al anterior pero con member_id, para getStudyGroupsWithEnrollments.
const LIST_GROUP_MEMBERS_SELECT = `
  id, name, leader_id, co_leader_id, zone, schedule_days, schedule_time, location,
  max_students, starts_at, ends_at, status, current_week, whatsapp_group_url,
  is_leader_training, training_modality, is_virtual,
  age_min, age_max,
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
  return (data as DbGroupEnriched) ?? null
}

// ── Análisis de demanda: extraído a ./studies-demand. Re-exportado acá. ────────
export { getStudyDemand } from '@/lib/supabase/queries/studies-demand'
export type { StudyDemandRow, StudyDemandResult } from '@/lib/supabase/queries/studies-demand'


// ── Perfil/elegibilidad: extraídos a ./studies-eligibility. Re-exportados acá. ─
export { getMemberStudyProfile, getEligibleStudiesForMember } from '@/lib/supabase/queries/studies-eligibility'
export type { MemberStudyEligibility } from '@/lib/supabase/queries/studies-eligibility'


/** Sesiones de asistencia de un grupo con conteo de presentes. */
export async function getGroupSessions(groupId: string): Promise<Array<{ id: string; date: string; topic: string | null; present: number; total: number }>> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('study_sessions')
    .select('id, session_date, topic, study_attendance(present)')
    .eq('group_id', groupId)
    .order('session_date', { ascending: true })
  if (error) throw error
  const rows = (data ?? []) as Array<{ id: string; session_date: string; topic: string | null; study_attendance: Array<{ present: boolean }> }>
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
      id, member_id, zone_preference, availability_status, is_active, qualified_study_codes, formation_study_codes,
      member:members(first_name, last_name, is_donor),
      evaluations:leader_evaluations(id, group_id, score, evaluation_date, comments)
    `)
  if (error) throw error
  // formation_study_codes (mig. 079) aún no está en los tipos generados.
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
  for (const v of (data ?? []) as Array<{ member_id: string; member: { first_name: string; last_name: string } | null }>) {
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

/** Ids (de `memberIds`) marcados como "no recomendado para dar estudios"
 *  (member_admin_data.not_recommended_to_lead_studies). Usado como guard antes
 *  de activar/asignar a alguien como dirigente. */
async function notRecommendedIds(
  supabase: ReturnType<typeof createAdminClient>,
  memberIds: string[],
): Promise<Set<string>> {
  if (memberIds.length === 0) return new Set()
  const { data, error } = await supabase
    .from('member_admin_data')
    .select('member_id')
    .in('member_id', memberIds)
    .eq('not_recommended_to_lead_studies', true)
  if (error) throw error
  return new Set(((data ?? []) as Array<{ member_id: string }>).map(r => r.member_id))
}

/** Activa/desactiva manualmente a un dirigente. Estado = servidor activo en el
 *  Comité de Dirigentes. ACTIVAR: study_leaders.is_active + voluntario activo del
 *  comité + rol 'dirigente'. DESACTIVAR: study_leaders inactivo + sale del comité
 *  (voluntariado inactive) + se revoca el rol 'dirigente'. No pisa su config.
 *  Guard: no se puede ACTIVAR a alguien marcado "no recomendado para dar
 *  estudios" (member_admin_data.not_recommended_to_lead_studies) — lanza
 *  'DIRIGENTE_NO_RECOMENDADO'. Desactivar siempre está permitido. */
export async function setDirigenteActive(memberId: string, active: boolean): Promise<void> {
  const supabase = createAdminClient()

  if (active) {
    const blocked = await notRecommendedIds(supabase, [memberId])
    if (blocked.has(memberId)) throw new Error('DIRIGENTE_NO_RECOMENDADO')
  }

  // study_leaders: actualizar estado sin tocar el resto (o crear si no existe).
  const { data: existing } = await supabase
    .from('study_leaders').select('member_id').eq('member_id', memberId).maybeSingle()
  if (existing) {
    const { error } = await supabase.from('study_leaders')
      .update({ is_active: active, availability_status: active ? 'available' : 'inactive' })
      .eq('member_id', memberId)
    if (error) throw error
  } else {
    const { error } = await supabase.from('study_leaders').insert({
      member_id: memberId, is_active: active,
      availability_status: active ? 'available' : 'inactive',
      zone_preference: [], qualified_study_codes: [],
    })
    if (error) throw error
  }

  const { data: area } = await supabase
    .from('areas').select('id').eq('area_type', 'committee').ilike('name', 'Comité de Dirigentes').maybeSingle()
  if (!area) return
  const areaId = (area as { id: string }).id
  const { data: positions } = await supabase
    .from('service_positions').select('id').eq('area_id', areaId)
  const posIds = ((positions ?? []) as Array<{ id: string }>).map(p => p.id)

  if (active) {
    const activePos = posIds[0]
    if (activePos) {
      const { error } = await supabase.from('volunteers').upsert(
        { member_id: memberId, position_id: activePos, status: 'active' },
        { onConflict: 'member_id,position_id' },
      )
      if (error) throw error
    }
  } else if (posIds.length > 0) {
    const { error } = await supabase.from('volunteers')
      .update({ status: 'inactive' })
      .eq('member_id', memberId).in('position_id', posIds)
    if (error) throw error
  }

  // Rol 'dirigente' en member_roles: se asigna al activar y se revoca al desactivar.
  const { assignMemberRole, revokeMemberRole } = await import('./members')
  if (active) await assignMemberRole(memberId, 'dirigente')
  else await revokeMemberRole(memberId, 'dirigente')
}

/** Cambio de estado masivo de dirigentes. Los marcados "no recomendado para dar
 *  estudios" se omiten (solo aplica al ACTIVAR) y se devuelven en `skipped`, sin
 *  abortar el resto del lote. */
export async function bulkSetDirigenteActive(
  memberIds: string[], active: boolean,
): Promise<{ updated: number; skipped: string[] }> {
  let updated = 0
  const skipped: string[] = []
  for (const id of memberIds) {
    try {
      await setDirigenteActive(id, active)
      updated++
    } catch (e) {
      if (e instanceof Error && e.message === 'DIRIGENTE_NO_RECOMENDADO') skipped.push(id)
      else throw e
    }
  }
  return { updated, skipped }
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
  requires_bus_talk?: boolean
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
  age_min?: number | null
  age_max?: number | null
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
/** D1 / Punto 1: al asignarle un grupo a un dirigente, pasa a ACTIVO. La regla:
 *  activo = voluntario activo del Comité de Dirigentes. Por eso, además de
 *  study_leaders.is_active, se agrega al comité (igual que setDirigenteActive).
 *  Nunca revierte a inactivo automáticamente. */
async function activateLeaders(
  _supabase: ReturnType<typeof createAdminClient>,
  memberIds: Array<string | null | undefined>,
): Promise<void> {
  const ids = Array.from(new Set(memberIds.filter((x): x is string => !!x)))
  for (const memberId of ids) await setDirigenteActive(memberId, true)
}

/** Guard previo a crear/editar un grupo con leader_id/co_leader_id: rechaza si
 *  alguno está marcado "no recomendado para dar estudios" — ANTES de escribir
 *  el grupo (evita dejarlo a medias con un dirigente bloqueado ya asignado). */
async function assertLeadersRecommended(
  supabase: ReturnType<typeof createAdminClient>,
  memberIds: Array<string | null | undefined>,
): Promise<void> {
  const ids = Array.from(new Set(memberIds.filter((x): x is string => !!x)))
  if (ids.length === 0) return
  const blocked = await notRecommendedIds(supabase, ids)
  if (blocked.size > 0) throw new Error('DIRIGENTE_NO_RECOMENDADO')
}

/** Miembros (de `ids`) que son leader o co-líder de un grupo en curso/abierto.
 *  Para bloquear su desactivación (punto 1). */
/** Contacto + sede de un conjunto de miembros (para enriquecer la exportación de
 *  dirigentes on-demand). PII → solo se llama desde el endpoint role-gated. */
export type DirigenteContact = { email: string | null; phone: string | null; sede: string | null }
export async function getDirigentesContact(ids: string[]): Promise<Record<string, DirigenteContact>> {
  const out: Record<string, DirigenteContact> = {}
  if (ids.length === 0) return out
  const supabase = createAdminClient()
  for (let i = 0; i < ids.length; i += 200) {
    const slice = ids.slice(i, i + 200)
    const { data, error } = await supabase
      .from('members')
      .select('id, email, phone, sede:sedes(code, name)')
      .in('id', slice)
    if (error) throw error
    for (const r of (data ?? []) as Array<{ id: string; email: string | null; phone: string | null; sede: { name: string } | null }>) {
      out[r.id] = { email: r.email, phone: r.phone, sede: r.sede?.name ?? null }
    }
  }
  return out
}

export async function membersWithActiveGroups(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('study_groups')
    .select('leader_id, co_leader_id')
    .in('status', ['en_matricula', 'en_curso'])
  if (error) throw error
  const idSet = new Set(ids)
  const out = new Set<string>()
  for (const g of (data ?? []) as Array<{ leader_id: string | null; co_leader_id: string | null }>) {
    if (g.leader_id && idSet.has(g.leader_id)) out.add(g.leader_id)
    if (g.co_leader_id && idSet.has(g.co_leader_id)) out.add(g.co_leader_id)
  }
  return out
}

/** Bulk: agrega/quita uno o varios códigos de estudio a la FORMACIÓN o la
 *  DISPONIBILIDAD de varios dirigentes (un grupo "Niveles"/"Discípulos" expande a
 *  sus códigos). Crea la fila study_leaders si falta. */
export async function bulkUpdateLeaderStudies(
  memberIds: string[],
  field: 'formation' | 'availability',
  codes: string[],
  action: 'add' | 'remove',
): Promise<number> {
  const supabase = createAdminClient()
  const col = field === 'formation' ? 'formation_study_codes' : 'qualified_study_codes'
  const codeSet = new Set(codes)
  let n = 0
  for (const memberId of memberIds) {
    const { data: row } = await supabase
      .from('study_leaders')
      .select('id, qualified_study_codes, formation_study_codes')
      .eq('member_id', memberId).maybeSingle()
    const current = (row?.[col] as string[] | null) ?? []
    const next = action === 'add'
      ? Array.from(new Set([...current, ...codes]))
      : current.filter((c: string) => !codeSet.has(c))
    if (row) {
      const patch = col === 'formation_study_codes'
        ? { formation_study_codes: next }
        : { qualified_study_codes: next }
      const { error } = await supabase.from('study_leaders').update(patch).eq('member_id', memberId)
      if (error) throw error
    } else if (action === 'add') {
      const base = {
        member_id: memberId, is_active: false, availability_status: 'inactive',
        zone_preference: [], qualified_study_codes: [] as string[], formation_study_codes: [] as string[],
      }
      const patch = col === 'formation_study_codes'
        ? { ...base, formation_study_codes: next }
        : { ...base, qualified_study_codes: next }
      const { error } = await supabase.from('study_leaders').insert(patch)
      if (error) throw error
    }
    n++
  }
  return n
}

export async function createGroup(input: GroupWriteInput): Promise<{ id: string }> {
  const supabase = createAdminClient()
  await assertLeadersRecommended(supabase, [input.leader_id, input.co_leader_id])
  const { data, error } = await supabase.from('study_groups').insert(input as Insertable<'study_groups'>).select('id').single()
  if (error) throw error
  await activateLeaders(supabase, [input.leader_id, input.co_leader_id])
  return data as { id: string }
}

export async function updateGroup(id: string, patch: Partial<GroupWriteInput>): Promise<void> {
  const supabase = createAdminClient()
  // Solo valida/activa si el patch trae una asignación de dirigente.
  if ('leader_id' in patch || 'co_leader_id' in patch) {
    await assertLeadersRecommended(supabase, [patch.leader_id, patch.co_leader_id])
  }
  const { error } = await supabase.from('study_groups').update(patch).eq('id', id)
  if (error) throw error
  if ('leader_id' in patch || 'co_leader_id' in patch) {
    await activateLeaders(supabase, [patch.leader_id, patch.co_leader_id])
  }
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
  /** Justificación obligatoria cuando status_result === 'reprobado'. */
  fail_reason?: string | null
  /** Recomendaciones opcionales del cierre (tabla member_recommendations). */
  recommendations?: {
    oracion?: boolean
    servicio?: boolean
    dirigente?: boolean
    justification?: string | null
  } | null
}

/**
 * Cierre de estudio: finaliza cada matrícula según su resultado y marca el
 * grupo como 'finalizado'. aprobado/reprobado → 'completed' (la nota distingue
 * el resultado; en notes va la etiqueta y, para reprobados, la justificación).
 * retirado → 'dropped'. Las recomendaciones se insertan en
 * member_recommendations con recommended_by = quien cierra.
 */
export async function closeGroup(groupId: string, results: CloseResult[], closedBy: string | null = null): Promise<void> {
  const supabase = createAdminClient()
  // RPC TRANSACCIONAL (migración 113): claim 'finalizado' + updates de las
  // inscripciones + recomendaciones en una sola transacción. Antes eran N
  // pasos sueltos: un fallo a mitad dejaba el grupo cerrado con inscripciones
  // a medias y el retry rebotaba con YA_CERRADO sin camino de reparación.
  // Los tipos generados marcan p_closed_by como requerido (se generaron antes
  // del DEFAULT NULL); omitirlo cuando es null aplica el default en la BD.
  const args: { p_group_id: string; p_results: Json; p_closed_by?: string } = {
    p_group_id: groupId,
    p_results: results as unknown as Json,
  }
  if (closedBy) args.p_closed_by = closedBy
  const { data, error } = await supabase.rpc('close_group', args as unknown as { p_group_id: string; p_results: Json; p_closed_by: string })
  if (error) throw error
  if (!data) throw new Error('YA_CERRADO')
}

export type MemberRecommendation = {
  id: string
  recommended_for: 'oracion' | 'servicio' | 'dirigente'
  justification: string | null
  recommended_by_name: string | null
  group_name: string | null
  created_at: string
}

/** Recomendaciones de un miembro (cierres de estudio). Solo para roles de
 *  estudios/admin — el guard vive en la ruta API. */
/** ¿El dirigente (dirigenteMemberId) dirige —actual o históricamente— un grupo
 *  donde el miembro (targetMemberId) es/fue estudiante? Cubre grupos de cualquier
 *  estado (histórico): leadership por leader_id o co_leader_id. Se usa para que un
 *  dirigente solo vea recomendaciones de SUS miembros. */
export async function dirigenteLeadsMember(dirigenteMemberId: string, targetMemberId: string): Promise<boolean> {
  const supabase = createAdminClient()
  // Grupos que dirige (leader o co-leader), cualquier estado.
  const { data: groups, error: gErr } = await supabase
    .from('study_groups')
    .select('id')
    .or(`leader_id.eq.${dirigenteMemberId},co_leader_id.eq.${dirigenteMemberId}`)
  if (gErr) throw gErr
  const groupIds = (groups ?? []).map(g => (g as { id: string }).id)
  if (groupIds.length === 0) return false
  // ¿El miembro es/fue estudiante de alguno de esos grupos?
  const { data: enr, error: eErr } = await supabase
    .from('study_enrollments')
    .select('id')
    .eq('member_id', targetMemberId)
    .in('group_id', groupIds)
    .limit(1)
  if (eErr) throw eErr
  return (enr ?? []).length > 0
}

export async function getMemberRecommendations(memberId: string): Promise<MemberRecommendation[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('member_recommendations')
    .select('id, recommended_for, justification, created_at, recommender:members!member_recommendations_recommended_by_fkey(first_name, last_name), group:study_groups(name)')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as Array<{
    id: string
    recommended_for: 'oracion' | 'servicio' | 'dirigente'
    justification: string | null
    created_at: string
    recommender: { first_name: string | null; last_name: string | null } | null
    group: { name: string | null } | null
  }>).map(r => ({
    id: r.id,
    recommended_for: r.recommended_for,
    justification: r.justification,
    recommended_by_name: r.recommender
      ? [r.recommender.first_name, r.recommender.last_name].filter(Boolean).join(' ') || null
      : null,
    group_name: r.group?.name ?? null,
    created_at: r.created_at,
  }))
}

// Inscripciones
export async function enrollMember(
  groupId: string, memberId: string,
  scholarshipInput?: { scholarship_id?: string; coupon_code?: string },
): Promise<{ status: 'enrolled' | 'pendiente_de_pago'; enrollment_id: string; amount: number }> {
  const supabase = createAdminClient()
  const { data: g } = await supabase
    .from('study_groups')
    .select('is_virtual, plan:study_plans!study_groups_plan_id_fkey(id, code, requires_invitation, cost, requires_payment)')
    .eq('id', groupId).maybeSingle()
  const group = g as { is_virtual: boolean | null; plan: { id: string; code: string | null; requires_invitation: boolean | null; cost: number | null; requires_payment: boolean | null } | null } | null
  const plan = group?.plan

  // Guard: planes que EXIGEN cédula (ej. PREMAT). Bloqueante server-side: no se
  // puede matricular sin cédula registrada. La UI avisa antes (matrícula).
  if (plan?.code && REQUIRES_CEDULA_CODES.has(plan.code)) {
    const { data: mem } = await supabase.from('members').select('cedula').eq('id', memberId).maybeSingle()
    const ced = (mem as { cedula?: string | null } | null)?.cedula
    if (!ced || !String(ced).trim()) throw new Error('CEDULA_REQUERIDA')
  }
  // Guard: grupo virtual sin autorización del miembro — server-side, no
  // depende de que la UI ya lo haya filtrado (se puede saltar el fetch).
  if (group?.is_virtual) {
    const { data: adminData } = await supabase
      .from('member_admin_data')
      .select('authorized_virtual_studies')
      .eq('member_id', memberId)
      .maybeSingle()
    const authorized = !!(adminData as { authorized_virtual_studies?: boolean } | null)?.authorized_virtual_studies
    if (!authorized) throw new Error('GRUPO_VIRTUAL_NO_AUTORIZADO')
  }
  // Guard: si ya existe una matrícula 'pendiente_de_pago' para este plan
  // (auto-matrícula al cerrar el nivel anterior), inscribirse a un grupo la
  // saltaría creando una matrícula activa sin pagar. El camino correcto es
  // subir el comprobante.
  if (plan?.id) {
    const { data: pending } = await supabase
      .from('study_enrollments')
      .select('id')
      .eq('member_id', memberId)
      .eq('plan_id', plan.id)
      .eq('status', 'pendiente_de_pago')
      .limit(1)
    if ((pending ?? []).length > 0) throw new Error('PAGO_PENDIENTE')

    // A3 (auditoría BE): retirar la matrícula pendiente y re-inscribirse por
    // acá saltaba el cobro (el guard anterior solo ve 'pendiente_de_pago').
    // Si existe una inscripción RETIRADA de este plan con su pago de matrícula
    // aún sin pagar, la re-inscripción debe pasar por el comprobante.
    const { data: droppedDebt } = await supabase
      .from('study_enrollments')
      .select('id, payments!payments_enrollment_id_fkey(id, status, concept)')
      .eq('member_id', memberId)
      .eq('plan_id', plan.id)
      .eq('status', 'dropped')
    const hasUnpaidDebt = ((droppedDebt ?? []) as Array<{ payments: Array<{ status: string; concept: string | null }> | null }>)
      .some(e => (e.payments ?? []).some(pay => pay.concept === 'matricula' && pay.status !== 'paid'))
    if (hasUnpaidDebt) throw new Error('PAGO_PENDIENTE')
  }
  // El upsert re-activa una fila existente (group,member). Legítimo para
  // 'dropped' (reincorporación) y 'pendiente_de_pago' con pago del plan al
  // día, pero una inscripción 'completed' no debe resucitarse.
  const { data: existing } = await supabase
    .from('study_enrollments')
    .select('status')
    .eq('group_id', groupId)
    .eq('member_id', memberId)
    .maybeSingle()
  const existingStatus = (existing as { status: string } | null)?.status
  if (existingStatus === 'completed') throw new Error('YA_COMPLETADO')
  if (existingStatus === 'pendiente_de_pago') throw new Error('PAGO_PENDIENTE')

  // Costo real: sale siempre del plan (study_groups no tiene columnas propias
  // de costo). Cualquier matrícula con costo queda pendiente de comprobante,
  // sin importar si la hace el propio miembro o el staff.
  const amount = Number(plan?.cost ?? 0)
  const requiresPayment = !!plan?.requires_payment && amount > 0

  // Beca/cupón (opcional): recalcula el monto ANTES de decidir el estado. Se
  // resuelve incluso si el resultado queda en 0 — la matrícula gratis por beca
  // igual consume el uso (registrar que se usó, sin importar el residual).
  let finalAmount = amount
  let appliedScholarship: { id: string; kind: 'asignada' | 'generica' } | null = null
  if (requiresPayment && scholarshipInput && (scholarshipInput.scholarship_id || scholarshipInput.coupon_code) && plan?.id) {
    const { resolveScholarshipForApplication, computeDiscountedAmount } = await import('./scholarships')
    const resolved = await resolveScholarshipForApplication(memberId, 'study_plan', plan.id, scholarshipInput)
    finalAmount = computeDiscountedAmount(amount, resolved.discount_type, resolved.discount_value)
    appliedScholarship = { id: resolved.id, kind: resolved.kind }
  }
  const requiresPaymentFinal = requiresPayment && finalAmount > 0
  const status = requiresPaymentFinal ? 'pendiente_de_pago' : 'enrolled'

  const { data: enr, error } = await supabase
    .from('study_enrollments')
    .upsert({ group_id: groupId, member_id: memberId, status }, { onConflict: 'group_id,member_id' })
    .select('id').single()
  if (error) throw error
  const enrollmentId = (enr as { id: string }).id

  if (requiresPaymentFinal) {
    // Pago pendiente sin comprobante todavía (mismo patrón que
    // autoEnrollApprovedToNextLevel) — se completa cuando suba el comprobante.
    // QA 2026-07-17: si el pago no se pudo crear, revertir la inscripción —
    // una matrícula pendiente_de_pago sin fila en payments es invisible para
    // finanzas y la API habría respondido éxito igual.
    const { error: payErr } = await supabase.from('payments').insert({
      member_id: memberId, amount: finalAmount, currency: 'CRC', payment_method: 'comprobante',
      concept: 'matricula', enrollment_id: enrollmentId,
      study_group_id: groupId, entity_type: 'study_group', status: 'pending',
      scholarship_id: appliedScholarship?.id ?? null,
    })
    if (payErr) {
      if (existingStatus) {
        await supabase.from('study_enrollments').update({ status: existingStatus }).eq('id', enrollmentId)
      } else {
        await supabase.from('study_enrollments').delete().eq('id', enrollmentId)
      }
      throw payErr
    }
  }
  if (appliedScholarship) {
    const { consumeScholarship } = await import('./scholarships')
    await consumeScholarship(appliedScholarship, memberId, finalAmount, { enrollmentId })
  }

  // Consumir invitación/excepción activa del plan del grupo al matricularse.
  if (plan?.id) {
    if (plan.requires_invitation) {
      const { markInvitationUsed } = await import('./study-invitations')
      await markInvitationUsed(memberId, plan.id)
    }
    // Excepción de matrícula: marcarla usada (no-op si no hay activa).
    const { markExceptionUsed } = await import('./study-exceptions')
    await markExceptionUsed(memberId, plan.id)
  }

  return { status, enrollment_id: enrollmentId, amount: finalAmount }
}

/** Retira una inscripción ACTIVA (enrolled/pendiente_de_pago/waitlist).
 *  A11: 'completed' es terminal — un retiro accidental ya no borra registro
 *  académico. A3: al retirar una pendiente de pago, su pago de matrícula sin
 *  comprobante se cancela (status 'failed') para que no quede huérfano y
 *  aprobable en la cola. */
export async function withdrawMember(groupId: string, memberId: string, reason?: string): Promise<void> {
  const supabase = createAdminClient()
  const { data: updated, error } = await supabase
    .from('study_enrollments')
    .update({ status: 'dropped', dropped_at: new Date().toISOString(), drop_reason: reason ?? null })
    .eq('group_id', groupId)
    .eq('member_id', memberId)
    .in('status', ['enrolled', 'pendiente_de_pago', 'waitlist'])
    .select('id, status')
  if (error) throw error
  if ((updated ?? []).length === 0) throw new Error('NO_RETIRABLE')

  // Cancelar el pago de matrícula pendiente asociado (si existía y no estaba
  // en revisión ni pagado). Best-effort: un fallo acá no revierte el retiro.
  const enrollmentId = (updated as Array<{ id: string }>)[0].id
  const { error: payErr } = await supabase
    .from('payments')
    .update({ status: 'failed' })
    .eq('enrollment_id', enrollmentId)
    .eq('concept', 'matricula')
    .eq('status', 'pending')
    .is('review_status', null)
  if (payErr) console.warn('withdrawMember cancelar pago:', payErr.message)
}

export async function setEnrollmentGrade(groupId: string, memberId: string, grade: number): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('study_enrollments')
    .update({ grade })
    .eq('group_id', groupId)
    .eq('member_id', memberId)
    // A11: la nota solo aplica a inscripciones vivas o completadas — no a
    // retiradas/pendientes de pago.
    .in('status', ['enrolled', 'completed'])
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

/** Libera cupos "atascados": matrículas pendientes de pago con comprobante
 *  rechazado hace más de 72h que no resubieron. Para el cron de expiración
 *  (espejo de expirePendingEventRegistrations en events.ts). */
export async function expirePendingStudyEnrollments(): Promise<{ expired: number }> {
  const supabase = createAdminClient()
  const cutoff = new Date(Date.now() - 72 * 3600 * 1000).toISOString()

  const { data: candidates } = await supabase
    .from('payments')
    .select('enrollment_id')
    .eq('concept', 'matricula').eq('review_status', 'rechazado')
    .lt('reviewed_at', cutoff)
    .not('enrollment_id', 'is', null)
  const enrollmentIds = [...new Set(
    (candidates ?? [])
      .map((p: { enrollment_id: string | null }) => p.enrollment_id)
      .filter((eid): eid is string => !!eid),
  )]
  if (enrollmentIds.length === 0) return { expired: 0 }

  // Excluir las que ya tienen un comprobante MÁS NUEVO en revisión (resubieron a tiempo).
  const { data: reReviewed } = await supabase
    .from('payments').select('enrollment_id')
    .in('enrollment_id', enrollmentIds).eq('review_status', 'en_revision')
  const reReviewedIds = new Set(
    (reReviewed ?? [])
      .map((r: { enrollment_id: string | null }) => r.enrollment_id)
      .filter((eid): eid is string => !!eid),
  )
  const stillPending = enrollmentIds.filter(id => !reReviewedIds.has(id))
  if (stillPending.length === 0) return { expired: 0 }

  const { data, error } = await supabase
    .from('study_enrollments')
    .update({ status: 'expirada' })
    .in('id', stillPending)
    .eq('status', 'pendiente_de_pago')
    .select('id')
  if (error) throw error
  return { expired: (data ?? []).length }
}
