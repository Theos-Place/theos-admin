// Form builder / template domain types.
// Imported by src/data/form-config.ts and form components.

/** Legacy field shape used by the old MockForm type */
export type FormField = {
  key: string
  label: string
  type: 'select' | 'radio' | 'text' | 'scale' | 'textarea' | 'yes_no'
}

/** Legacy form shape (pre-builder) */
export type MockForm = {
  id: string
  name: string
  category: 'event_registration' | 'study_registration' | 'survey' | 'registration'
  fields: FormField[]
}

export type FieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'scale'
  | 'yes_no'
  | 'date'
  | 'number'
  | 'section'
  /** EST-10: bloque de texto informativo, sin input (contexto, declaraciones). */
  | 'info'
  | 'page_break'
  | 'personal_data'
  /** Imagen adjunta a la respuesta (pensado para comprobantes). El valor que se
   *  guarda es el PATH del bucket privado, no una URL — ver lib/forms/attachment. */
  | 'image'
  /** CALCULADO por el servidor: los estudios aprobados de quien responde. No se
   *  le muestra a la persona; sale en el export. Ver lib/forms/computed-fields. */
  | 'studies_done'

export type ConditionOperator =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'not_contains'
  | 'is_empty'
  | 'is_not_empty'
  | 'gt'
  | 'lt'

export interface LogicCondition {
  id: string
  field_id: string
  operator: ConditionOperator
  value: string
}

export interface LogicRule {
  id: string
  condition_operator: 'AND' | 'OR'
  conditions: LogicCondition[]
  action: 'show' | 'hide'
}

export interface FormFieldNew {
  id: string
  type: FieldType
  label: string
  placeholder?: string
  helper_text?: string
  description?: string
  is_required: boolean
  sort_order: number
  options?: string[]
  /** EST-10: opciones resueltas en el servidor (grupos abiertos de un plan).
   *  Cuando viene, `options` llega ya poblado por el API. */
  options_source?: 'study_groups_open' | null
  options_source_param?: string | null
  scale_min?: number
  scale_max?: number
  scale_min_label?: string
  scale_max_label?: string
  logic_rules?: LogicRule[]
}

export interface FormTemplate {
  id: string
  name: string
  description: string
  category: 'event_registration' | 'study_registration' | 'survey' | 'registration' | 'other'
  entity_type: 'event' | 'study_group' | 'general' | null
  entity_id: string | null
  entity_name: string | null
  is_active: boolean
  /** Ventana de vigencia (opcional): fuera de ella no acepta respuestas y el
   *  estado mostrado se deriva (programado/activo/vencido) sin cron. */
  starts_at: string | null
  ends_at: string | null
  is_public: boolean
  requires_auth: boolean
  /** EST-10: si es false, una respuesta por persona (el llenado lo verifica). */
  allow_multiple_responses: boolean
  created_at: string
  created_by: string
  /** FRM-2 · Encabezado opcional: flyer + título + bienvenida. No es una
   *  pregunta, es la portada del formulario (por eso vive en `forms`). */
  hero_image_url: string | null
  hero_title: string | null
  hero_subtitle: string | null
  fields: FormFieldNew[]
  responses_count: number
  last_response_at: string | null
}

export interface FormResponse {
  id: string
  form_id: string
  member_id: string
  member_name: string
  submitted_at: string
  answers: Record<string, string | string[] | number>
  /** FRM-4: nombre de quien la DIGITÓ, si no fue la propia persona. Vacío en el
   *  caso normal — así "tiene valor" significa "la registró el staff", sin
   *  comparar con member_name. */
  recorded_by_name: string
}
