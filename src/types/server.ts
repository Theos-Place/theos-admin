// Servers / committees domain types.

export type ServerStatus = 'active' | 'inactive'

export type CommitteeServer = {
  member_id: string
  name: string
  initials: string
  position: string
  position_id?: string
  start_date: string
  status: ServerStatus
  email?: string | null
  phone?: string | null
  birth_date?: string | null
}

export type CommitteeLeader = {
  member_id: string
  name: string
  initials: string
}

export type CommitteePosition = {
  id: string
  title: string
  /** Servidores con status active u on_leave en este puesto. */
  active_count?: number
}

export type CommitteeData = {
  id: string
  name: string
  area: string
  area_code: string
  leader: CommitteeLeader
  ideal_capacity: number
  members: CommitteeServer[]
  positions?: CommitteePosition[]
  open_vacancies: number
}

export type VacancyStatus = 'draft' | 'published' | 'filled' | 'closed'

export type Vacancy = {
  id: string
  committee_id: string
  committee_name: string
  area: string
  title: string
  position: string
  description: string
  functions: string[]
  schedule: string
  commitment: string
  slots_total: number
  slots_filled: number
  status: VacancyStatus
  published_at: string | null
  created_at: string
}

export type ApplicationStatus = 'pending' | 'reviewing' | 'approved' | 'rejected'

export type Application = {
  id: string
  vacancy_id: string
  vacancy_title: string
  committee_id: string
  committee_name: string
  area: string
  position: string
  applicant_id: string
  applicant_name: string
  applicant_initials: string
  applied_at: string
  status: ApplicationStatus
  notes: string
  service_history: Array<{ committee: string; position: string; period: string }>
}

export type CommitteeGoal = {
  id: string
  description: string
  status: 'in_progress' | 'completed'
  due_date: string | null
}
