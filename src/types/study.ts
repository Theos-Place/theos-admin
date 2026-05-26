// Studies / groups / leaders domain types.

export type StudyType = {
  id: string
  code: string
  name: string
  stage: 'niveles' | 'inicial' | 'intermedia' | 'campaña'
  weeks: number
  prerequisite: string | null
  requires_payment: boolean
  cost: number
  requires_grade: boolean
  auto_promote: boolean
  next_study_id: string | null
  req_donor: boolean
  req_server: boolean
  req_attendee: boolean
  is_archived: boolean
}

export type GroupStatus =
  | 'pending_leader'
  | 'pending_opening'
  | 'open'
  | 'in_progress'
  | 'finished'

export type GroupParticipant = {
  member_id: string
  member_name: string
  status: 'enrolled' | 'pending' | 'withdrawn'
  grade: number | null
  attendance_pct: number
}

export type StudyGroup = {
  id: string
  study_type_id: string
  leader_id: string | null
  leader_name: string | null
  zone: string
  schedule_days: string[]
  schedule_time: string
  location: string
  max_capacity: number
  start_date: string
  end_date: string | null
  status: GroupStatus
  current_week: number
  participants: GroupParticipant[]
  whatsapp_group_url: string | null
}

export type LeaderEvaluation = {
  id: string
  group_id: string
  group_name: string
  score: number
  date: string
  comments: string
}

export type StudyLeader = {
  id: string
  member_id: string
  member_name: string
  zone_preference: string[]
  availability_status: 'available' | 'assigned' | 'resting' | 'inactive'
  is_active: boolean
  qualified_studies: string[]
  stats: {
    groups_led: number
    avg_rating: number
    current_participants: number
  }
  commitments: {
    is_donor: boolean
    attends_charlas: boolean
    is_server: boolean
  }
  evaluations: LeaderEvaluation[]
}

export type WaitListEntry = {
  id: string
  member_id: string
  member_name: string
  age: number
  zone_preference: string
  horario_preference: string
  requested_at: string
  type: 'N1' | 'campaign'
  campaign_code?: string
}

export type RelocationRequest = {
  id: string
  member_id: string
  member_name: string
  from_group_id: string
  study_type: string
  reason: string
  status: 'pending' | 'resolved'
  requested_at: string
}
