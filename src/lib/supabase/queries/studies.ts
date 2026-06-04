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
  leader: { first_name: string; last_name: string } | null
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

export type DbWaitlistEntry = {
  id: string
  member_id: string
  zone_preference: string | null
  schedule_preference: string | null
  type: 'N1' | 'campaign'
  campaign_code: string | null
  requested_at: string
  member: { first_name: string; last_name: string; birth_date: string | null } | null
}

export type DbRelocation = {
  id: string
  member_id: string
  from_group_id: string | null
  study_plan_code: string | null
  reason: string | null
  status: 'pending' | 'resolved'
  requested_at: string
  member: { first_name: string; last_name: string } | null
}

/** Grupos de estudio con líder y participantes (enrollments + nombre del miembro). */
export async function getStudyGroups(): Promise<DbGroupEnriched[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('study_groups')
    .select(`
      id, name, leader_id, zone, schedule_days, schedule_time, location,
      max_students, starts_at, ends_at, status, current_week, whatsapp_group_url,
      plan:study_plans(code),
      leader:members!study_groups_leader_id_fkey(first_name, last_name),
      enrollments:study_enrollments!study_enrollments_group_id_fkey(
        member_id, status, grade,
        member:members(first_name, last_name)
      )
    `)
    .order('starts_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as DbGroupEnriched[]
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

/** Lista de espera de estudios. */
export async function getWaitlist(): Promise<DbWaitlistEntry[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('study_waitlist')
    .select(`
      id, member_id, zone_preference, schedule_preference, type, campaign_code, requested_at,
      member:members(first_name, last_name, birth_date)
    `)
    .order('requested_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as DbWaitlistEntry[]
}

/** Solicitudes de reubicación de grupo. */
export async function getRelocations(): Promise<DbRelocation[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('relocation_requests')
    .select(`
      id, member_id, from_group_id, study_plan_code, reason, status, requested_at,
      member:members(first_name, last_name)
    `)
    .order('requested_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as DbRelocation[]
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

// Waitlist
export async function addToWaitlist(input: {
  member_id: string
  zone_preference?: string | null
  schedule_preference?: string | null
  type?: 'N1' | 'campaign'
  campaign_code?: string | null
}): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('study_waitlist').insert(input)
  if (error) throw error
}

export async function removeFromWaitlist(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('study_waitlist').delete().eq('id', id)
  if (error) throw error
}

/** Promueve una entrada de waitlist a un grupo: inscribe al miembro y borra la entrada. */
export async function promoteFromWaitlist(waitlistId: string, groupId: string): Promise<void> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('study_waitlist').select('member_id').eq('id', waitlistId).single()
  if (error) throw error
  await enrollMember(groupId, (data as { member_id: string }).member_id)
  await removeFromWaitlist(waitlistId)
}

// Reubicaciones
export async function createRelocation(input: {
  member_id: string
  from_group_id?: string | null
  study_plan_code?: string | null
  reason?: string | null
}): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('relocation_requests').insert(input)
  if (error) throw error
}

export async function resolveRelocation(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('relocation_requests').update({ status: 'resolved' }).eq('id', id)
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

export async function updateLeader(id: string, patch: Partial<LeaderWriteInput>): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('study_leaders').update(patch).eq('id', id)
  if (error) throw error
}
