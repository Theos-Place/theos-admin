// Member-related domain types.
// Imported by src/data/mock-members.ts and any component that needs them.

/** Legacy form response shape stored on a member record */
export type FormResponse = {
  formId: string
  submittedAt: string
  answers: Record<string, string>
}

export type Member = {
  id: string
  cedula: string | null
  first_name: string
  last_name: string
  email: string
  phone: string
  status: 'active' | 'inactive'
  is_donor: boolean
  is_server: boolean
  roles: Array<'miembro' | 'servidor' | 'dirigente' | 'admin'>
  completed_studies: string[]
  current_study: string | null
  sede: string
  age: number
  tipos_evento: string[]
  comites: string[]
  es_dirigente: boolean
  estado_dirigente: 'activo' | 'en_descanso' | 'disponible' | null
  join_date: string
  birth_date: string
  gender: 'masculino' | 'femenino' | 'no_indica'
  marital_status: string
  profession: string
  workplace: string
  address: string
  alergias: string | null
  medicamentos: string | null
  allergies?: string | null
  attendance_history: AttendanceRecord[]
  service_history: ServiceRecord[]
  family_members: FamilyEntry[]
  donations: DonationRecord[]
  form_responses: FormResponse[]
  wallet_pass_status: 'active' | 'not_generated'
  emergency_contact_name?: string
  emergency_contact_phone?: string
}

export type AttendanceRecord = {
  name: string
  date: string
  type: 'Charla semanal' | 'Charla mensual' | 'Campamento' | 'Ayuda social' | 'Estudio' | 'Actividad servidores' | 'Worship'
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
