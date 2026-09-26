// Servers / committees domain types.

export type ServerStatus = 'active' | 'inactive'

export type CommitteeServer = {
  member_id: string
  name: string
  initials: string
  position: string
  position_id?: string
  /** Puede venir NULA: 46 servidores del Comité Dirigentes no la tienen, y
   *  decir `string` fue lo que dejó pasar el «NaN año» a la pantalla. */
  start_date: string | null
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
  /** Campos descriptivos (importados de puestos_mapa_2026). Funciones/perfil traen
   *  bullets • y saltos de línea — renderizar con white-space: pre-line. */
  description?: string | null
  functions?: string | null
  profile?: string | null
  skills?: string | null
  study_requirement?: string | null
  /** Dónde se sirve el puesto: una sede, un lugar escrito a mano, o nada.
   *  OPCIONAL de verdad — un puesto sin lugar fijo es un caso normal, no un
   *  dato faltante. Ver `lib/servers/ubicacion-de-puesto`. */
  location?: string | null
}

export type CommitteeData = {
  id: string
  name: string
  area: string
  area_code: string
  /** Quienes están a cargo. Derivado de los puestos "Encargado…" (SRV-5);
   *  pueden ser varios — Comité Matrimonios tiene 4. */
  encargados: CommitteeLeader[]
  ideal_capacity: number
  members: CommitteeServer[]
  positions?: CommitteePosition[]
  open_vacancies: number
}

export type VacancyStatus =
  | 'creado' | 'enviado_lider' | 'aprobado' | 'denegado' | 'cerrada'

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
  /** Conteo de aplicaciones de la vacante (embebido en la query, no se cargan
   *  todas las applications). Ausente en datos mock → tratar como 0. */
  application_count?: number
  /** Contenido del puesto enlazado (solo lectura; la publicación pública usa esto). */
  position_description?: string | null
  position_functions?: string | null
  position_profile?: string | null
  position_skills?: string | null
  position_study_requirement?: string | null
  /** Logística propia de la vacante. */
  expires_at?: string | null
  location?: string | null
  notes?: string | null
  is_featured?: boolean
}

/** SRV-14 · Los cinco estados. El vocabulario visible y las reglas de
 *  transición viven en `lib/servers/application-states`; acá solo el tipo. */
export type ApplicationStatus =
  'pending' | 'sent_to_leader' | 'reviewing' | 'approved' | 'rejected'

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
