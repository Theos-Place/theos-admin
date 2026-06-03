import { createAdminClient } from '@/lib/supabase/admin'

// NOTA: createAdminClient (service role) porque la app corre con mock auth.

// ── Tipos crudos ───────────────────────────────────────────

export type DbCommittee = {
  id: string
  name: string
  ideal_capacity: number | null
  parent: { id: string; name: string } | null
  leader: { first_name: string; last_name: string } | null
  leader_id: string | null
  positions: Array<{
    id: string
    title: string
    volunteers: Array<{
      member_id: string
      status: 'active' | 'inactive' | 'on_leave' | 'pending'
      start_date: string | null
      member: { first_name: string; last_name: string } | null
    }>
  }>
}

export type DbVacancy = {
  id: string
  committee_id: string
  committee: { name: string; parent: { name: string } | null } | null
  title: string
  position: string | null
  description: string | null
  functions: string[] | null
  schedule: string | null
  commitment: string | null
  slots_total: number
  slots_filled: number
  status: 'draft' | 'published' | 'filled' | 'closed'
  published_at: string | null
  created_at: string
}

export type DbApplication = {
  id: string
  vacancy_id: string
  vacancy: { title: string; position: string | null; committee: { id: string; name: string; parent: { name: string } | null } | null } | null
  applicant_id: string
  applicant: { first_name: string; last_name: string } | null
  status: 'pending' | 'reviewing' | 'approved' | 'rejected'
  notes: string | null
  applied_at: string
}

export type DbCommitteeGoal = {
  id: string
  committee_id: string
  description: string
  status: 'in_progress' | 'completed'
  due_date: string | null
}

// ── Queries ────────────────────────────────────────────────

/** Comités (areas con area_type='committee') con líder y servidores. */
export async function getCommittees(): Promise<DbCommittee[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('areas')
    .select(`
      id, name, ideal_capacity, leader_id,
      parent:areas!parent_id(id, name),
      leader:members!areas_leader_id_fkey(first_name, last_name),
      positions:service_positions(
        id, title,
        volunteers(
          member_id, status, start_date,
          member:members(first_name, last_name)
        )
      )
    `)
    .eq('area_type', 'committee')
    .eq('is_active', true)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as DbCommittee[]
}

export async function getVacancies(): Promise<DbVacancy[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('vacancies')
    .select(`
      id, committee_id, title, position, description, functions, schedule, commitment,
      slots_total, slots_filled, status, published_at, created_at,
      committee:areas!vacancies_committee_id_fkey(name, parent:areas!parent_id(name))
    `)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as DbVacancy[]
}

export async function getApplications(): Promise<DbApplication[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('applications')
    .select(`
      id, vacancy_id, applicant_id, status, notes, applied_at,
      vacancy:vacancies(title, position, committee:areas!vacancies_committee_id_fkey(id, name, parent:areas!parent_id(name))),
      applicant:members(first_name, last_name)
    `)
    .order('applied_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as DbApplication[]
}

export async function getCommitteeGoals(): Promise<DbCommitteeGoal[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('committee_goals')
    .select('id, committee_id, description, status, due_date')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DbCommitteeGoal[]
}
