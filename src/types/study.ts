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
  mentor_name?: string | null
  stage: 'niveles' | 'inicial' | 'intermedia' | 'avanzada' | 'campaña'
  weeks: number
  prerequisite: string | null
  requires_payment: boolean
  requires_invitation?: boolean
  cost: number
  /** INT-2: moneda del costo (CRC/USD/EUR). */
  currency: string
  requires_grade: boolean
  auto_promote: boolean
  next_study_id: string | null
  req_donor: boolean
  req_server: boolean
  req_attendee: boolean
  /** Compromiso: haber asistido a la charla del Bus (ícono bus + tooltip). */
  req_bus?: boolean
  is_archived: boolean
  /** FALSE = charla introductoria (ej. BUS); fuera de análisis/matrícula/plan. */
  is_curricular?: boolean
}

// 'en_matricula' reemplaza a open/pending_opening; "sin dirigente" ya no es
// estado guardado sino flag derivado (leader_id IS NULL). Migración 052.
export type GroupStatus =
  | 'en_matricula'
  | 'en_curso'
  | 'finalizado'

export type GroupParticipant = {
  member_id: string
  member_name: string
  status: 'enrolled' | 'pending' | 'withdrawn'
  /** Resultado del cierre (solo en grupos finalizados): derivado de notes. */
  result?: 'aprobado' | 'reprobado' | null
  grade: number | null
  attendance_pct: number
}

export type StudyGroup = {
  /** SEC-1: alcance del que consulta, calculado server-side por el GET del
   *  grupo — 'member'/'none' ⇒ vista de solo lectura sin roster ajeno. */
  viewer_scope?: 'admin' | 'leader' | 'member' | 'none'
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
  /** Rango de edad del grupo (opcional). En matrícula filtra por edad del miembro. */
  age_min: number | null
  age_max: number | null
  start_date: string
  end_date: string | null
  /** GRU-1: ventana de matrícula (null = sin ventana, modo manual). */
  enrollment_start_date?: string | null
  enrollment_end_date?: string | null
  status: GroupStatus
  current_week: number
  participants: GroupParticipant[]
  whatsapp_group_url: string | null
  is_leader_training?: boolean
  training_modality?: string | null
  /** Grupo virtual: solo visible/matriculable para miembros autorizados
   *  (member_admin_data.authorized_virtual_studies). */
  is_virtual?: boolean
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
  /** Disponibilidad: estudios que está dispuesto a dar ahora (qualified_study_codes). */
  qualified_studies: string[]
  /** Formación: estudios para los que está capacitado (formation_study_codes). */
  formation_studies: string[]
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

// 'study_interest' consolida los viejos 'new_group'/'join_group' (migración 050).
export type StudyRequestType = 'relocation' | 'study_interest'
export type StudyRequestStatus = 'open' | 'in_review' | 'resolved' | 'rejected'

export type StudyRequestHistoryEntry = {
  from_status: StudyRequestStatus | null
  to_status: StudyRequestStatus
  notes: string | null
  changed_by_name: string | null
  created_at: string
}

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
  reason: string | null
  status: StudyRequestStatus
  /** Día(s), horario y elegibilidad capturada. REU-1: la reubicación guarda
   *  día(s) y ZONAS múltiples (las solicitudes viejas tenían 1 zona en
   *  proposed_location — el domain la mapea a proposed_zones). */
  proposed_days: string[]
  proposed_time: string | null
  proposed_zones: string[]
  was_eligible: boolean | null
  eligibility_note: string | null
  reviewed_by: string | null
  reviewed_by_name: string | null
  reviewed_at: string | null
  review_notes: string | null
  created_at: string
  updated_at: string
  history: StudyRequestHistoryEntry[]
  /** Campos propios de reubicación (request_type = 'relocation'). */
  needed_study_code: string | null
  last_class_attended: string | null
  last_leader_name: string | null
  wants_folleto: boolean
  /** Resolución real: grupo elegido por el encargado + lo que generó. */
  resolved_group_id: string | null
  resolved_group_name: string | null
  resulting_enrollment_id: string | null
  resulting_folleto_request_id: string | null
}

export type StudyRequestWriteInput = {
  member_id: string
  request_type: StudyRequestType
  plan_id?: string | null
  existing_group_id?: string | null
  current_group_id?: string | null
  proposed_location?: string | null
  proposed_schedule?: string | null
  /** Razón: obligatoria en reubicación; en interés de estudio ya no se pide. */
  reason?: string | null
  needed_study_code?: string | null
  last_class_attended?: string | null
  last_leader_name?: string | null
  wants_folleto?: boolean
  /** Día(s) (interés: hasta 2; reubicación: libres), horario, zonas múltiples
   *  (REU-1) y elegibilidad capturada. */
  proposed_days?: string[]
  proposed_time?: string | null
  proposed_zones?: string[]
  was_eligible?: boolean | null
  eligibility_note?: string | null
}
