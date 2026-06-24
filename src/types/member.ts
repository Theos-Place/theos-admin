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
  /** Estado de la cuenta de acceso (Supabase Auth): sin cuenta / sin activar / activada. */
  account_state: 'none' | 'unconfirmed' | 'active'
  deactivation_reason: string | null
  deactivated_at: string | null
  created_at: string
  updated_at: string
  /** Última edición por campo (ISO date string), p.ej. { email: '2026-05-01T…' }. */
  field_updated_at: {
    email?: string
    phone?: string
    phone_whatsapp?: string
    birth_date?: string
    cedula?: string
    first_name?: string
    last_name?: string
    province?: string
    canton?: string
    occupation?: string
    photo_url?: string
    [key: string]: string | undefined
  } | null

  // ── Campos derivados / pendientes de migrar a tablas relacionadas (Fase 2) ──
  is_server: boolean
  roles: MemberRole[]
  completed_studies: string[]
  study_history?: Array<{ group_id: string | null; code: string; name: string; date: string | null; year: number | null; weeks: number | null; status: string }>
  current_study: string | null
  current_study_week?: number | null
  sede: string
  /** Sede calculada por asistencia a charlas (últimos 12 meses). null = sin sede. */
  attendance_sede?: { name: string; count: number } | null
  age: number
  tipos_evento: string[]
  comites: string[]
  /** Dirigente activo (servidor activo en el comité Dirigentes). */
  es_dirigente: boolean
  /** Tiene registro de dirigente (activo o inactivo) → mostrar indicador + link. */
  is_dirigente: boolean
  estado_dirigente: 'activo' | 'en_descanso' | 'disponible' | null
  join_date: string
  medicamentos: string | null
  attendance_history: AttendanceRecord[]
  /** Meses (YYYY-MM) con al menos una asistencia. Liviano, viene del listado. */
  attendance_months?: string[]
  /** Asistencia activa según el criterio único (charlas, últimos 6 meses completos).
   *  Solo viene del detalle (getMemberFullById). */
  attendance_active?: boolean
  /** Fecha del último check-in de charla. Solo viene del detalle. */
  last_charla_checkin?: string | null
  /** Grupos activos donde es dirigente o co-dirigente. Solo viene del detalle. */
  led_groups?: Array<{ group_id: string; group_name: string; plan_code: string | null; plan_name: string | null }>
  /** Todos los estudios dados como dirigente (cualquier estado) — D10. */
  led_studies?: Array<{ group_id: string; group_name: string; plan_code: string | null; plan_name: string | null; role: 'Dirigente' | 'Co-dirigente'; status: string; date: string | null }>
  service_history: ServiceRecord[]
  family_members: FamilyEntry[]
  donations: DonationRecord[]
  form_responses: FormResponse[]
  wallet_pass_status: 'active' | 'not_generated'
}

export type AttendanceRecord = {
  name: string
  date: string
  /** Tipo del evento. FK al catálogo event_types: 'charla'|'campamento'|'social'|'capacitacion'.
   *  Relajado a string porque el catálogo es editable desde /eventos/tipos. */
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
  /** null = monto restringido (solo rol finanzas lo recibe del API). */
  amount: number | null
  description: string
}

// ─── SQL para ejecutar manualmente en Supabase (Cambio: field_updated_at) ──────
// ALTER TABLE members ADD COLUMN IF NOT EXISTS field_updated_at JSONB DEFAULT '{}';
// (Ya aplicado vía supabase/migrations/038_merge_fields_and_field_updated_at.sql)
