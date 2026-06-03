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
