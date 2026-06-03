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
