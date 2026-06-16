// Types live in @/types/forms — imported here for internal use, re-exported for consumers.
import type { FormField, MockForm, FieldType, ConditionOperator, LogicCondition, LogicRule, FormFieldNew, FormTemplate, FormResponse } from '@/types/forms'
export type { FormField, MockForm, FieldType, ConditionOperator, LogicCondition, LogicRule, FormFieldNew, FormTemplate, FormResponse }

export const FORM_CATEGORY_LABEL: Record<MockForm['category'], string> = {
  event_registration: 'Inscripción eventos',
  study_registration: 'Inscripción estudios',
  survey: 'Encuestas',
  registration: 'Registro',
}

// ─── Form builder data ────────────────────────────────────────────────────────

export const PERSONAL_DATA_FIELDS: { key: string; label: string; group: string }[] = [
  { key: 'full_name',               label: 'Nombre completo',        group: 'Identificación' },
  { key: 'cedula',                  label: 'Cédula',                 group: 'Identificación' },
  { key: 'age',                     label: 'Edad',                   group: 'Identificación' },
  { key: 'gender',                  label: 'Género',                 group: 'Identificación' },
  { key: 'marital_status',          label: 'Estado civil',           group: 'Identificación' },
  { key: 'phone',                   label: 'Teléfono',               group: 'Contacto'       },
  { key: 'email',                   label: 'Correo',                 group: 'Contacto'       },
  { key: 'address',                 label: 'Dirección',              group: 'Contacto'       },
  { key: 'emergency_contact_name',  label: 'Contacto de emergencia', group: 'Emergencia'     },
  { key: 'emergency_contact_phone', label: 'Teléfono de emergencia', group: 'Emergencia'     },
  { key: 'occupation',              label: 'Profesión',              group: 'Trabajo'        },
  { key: 'workplace',               label: 'Lugar de trabajo',       group: 'Trabajo'        },
  { key: 'allergies',               label: 'Alergias',               group: 'Salud'          },
]
