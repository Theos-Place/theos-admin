// Studies / groups / leaders domain types.

export type StudyType = {
  id: string
  plan_id?: string
  code: string
  name: string
  description?: string | null
  difficulty?: string | null
  commitments?: string | null
  mentor_id?: string | null
  stage: 'niveles' | 'inicial' | 'intermedia' | 'campaña'
  weeks: number
  prerequisite: string | null
  requires_payment: boolean
  requires_invitation?: boolean
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
  name?: string
  study_type_id: string
  leader_id: string | null
  co_leader_id?: string | null
  leader_name: string | null
  co_leader_name?: string | null
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

// ── Solicitudes de estudios (tabla study_requests, migración 041) ───────────

export type StudyRequestType = 'new_group' | 'join_group' | 'relocation'
export type StudyRequestStatus = 'open' | 'in_review' | 'resolved' | 'rejected'

export type StudyRequest = {
  id: string
  member_id: string
  member_name: string
  request_type: StudyRequestType
  plan_id: string | null
  plan_name: string | null
  existing_group_id: string | null
  existing_group_name: string | null
  current_group_id: string | null
  current_group_name: string | null
  proposed_location: string | null
  proposed_schedule: string | null
  reason: string
  status: StudyRequestStatus
  reviewed_by: string | null
  reviewed_by_name: string | null
  reviewed_at: string | null
  review_notes: string | null
  created_at: string
  updated_at: string
}

export type StudyRequestWriteInput = {
  member_id: string
  request_type: StudyRequestType
  plan_id?: string | null
  existing_group_id?: string | null
  current_group_id?: string | null
  proposed_location?: string | null
  proposed_schedule?: string | null
  reason: string
}

export type NotificationRecipient = {
  id: string
  member_id: string
  member_name: string
  created_at: string
}
