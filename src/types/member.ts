// Member-related domain types.
// Alineados con la tabla `members` de Supabase (ver supabase/migrations/001_theos_schema.sql).
// Los campos compuestos (attendance_history, service_history, donations, etc.)
// son data derivada de otras tablas — se mantienen acá temporalmente con datos mock
// hasta que se conecten sus queries reales (Fase 2).

/** Roles que pueden tener los miembros. Refleja `member_roles.role` en Supabase
 *  (ver 001_theos_schema.sql). Nota: 'servidor' NO está acá — se deriva de
 *  tener registros en `volunteers` y se expone vía `is_server`. */
export type MemberRole =
  | 'admin'
  | 'direccion'
  | 'finanzas'
  | 'encargado_staff'
  | 'coordinador_estudios'
  | 'coordinador_dirigentes'
  | 'lider_comite'
  | 'comunicaciones'
  | 'dirigente'
  | 'editor_perfiles'
  | 'miembro'
  | 'solo_lectura'

/** Legacy form response shape stored on a member record */
export type FormResponse = {
  formId: string
  submittedAt: string
  answers: Record<string, string>
}

export type Member = {
  // ── Campos que existen en la tabla `members` de Supabase ──
  id: string
  cedula: string | null
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  birth_date: string | null
  gender: 'M' | 'F' | 'otro' | null
  marital_status: string | null
  occupation: string | null
  workplace: string | null
  province: string | null
  canton: string | null
  district: string | null
  address: string | null
  allergies: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  photo_url: string | null
  is_donor: boolean
  is_active: boolean
  deactivation_reason: string | null
  deactivated_at: string | null
  created_at: string
  updated_at: string

  // ── Campos derivados / pendientes de migrar a tablas relacionadas (Fase 2) ──
  is_server: boolean
  roles: MemberRole[]
  completed_studies: string[]
  current_study: string | null
  current_study_week?: number | null
  sede: string
  age: number
  tipos_evento: string[]
  comites: string[]
  es_dirigente: boolean
  estado_dirigente: 'activo' | 'en_descanso' | 'disponible' | null
  join_date: string
  medicamentos: string | null
  attendance_history: AttendanceRecord[]
  /** Meses (YYYY-MM) con al menos una asistencia. Liviano, viene del listado. */
  attendance_months?: string[]
  service_history: ServiceRecord[]
  family_members: FamilyEntry[]
  donations: DonationRecord[]
  form_responses: FormResponse[]
  wallet_pass_status: 'active' | 'not_generated'
}

export type AttendanceRecord = {
  name: string
  date: string
  /** Tipo del evento. Schema usa 'culto'|'estudio'|'actividad'|'campana'|'retiro'|'conferencia'|'otro'.
   *  El mock usa labels en español. Relajado a string hasta alinear vocabularios. */
  type: string
  attendance_type: 'participante' | 'servidor'
}

export type ServiceRecord = {
  position: string
  committee: string
  area: string
  from: string
  to: string | null
  status: 'activo' | 'finalizado'
}

export type FamilyEntry = {
  id: string
  name: string
  relation: string
  status: 'active' | 'inactive'
}

export type DonationRecord = {
  date: string
  amount: number
  description: string
}
