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
  // La edad de arriba es un cálculo y no se edita; esta es el dato de verdad.
  { key: 'birth_date',              label: 'Fecha de nacimiento',    group: 'Identificación' },
  { key: 'gender',                  label: 'Género',                 group: 'Identificación' },
  { key: 'marital_status',          label: 'Estado civil',           group: 'Identificación' },
  { key: 'phone',                   label: 'Teléfono',               group: 'Contacto'       },
  { key: 'email',                   label: 'Correo',                 group: 'Contacto'       },
  { key: 'address',                 label: 'Dirección',              group: 'Contacto'       },
  // UNA sola opción que trae nombre Y número (2026-09-10): un contacto de
  // emergencia sin teléfono no sirve para nada, y tener que acordarse de marcar
  // las dos casillas garantizaba que a veces faltara la mitad. Las claves
  // sueltas siguen leyéndose para los formularios ya guardados con ellas.
  { key: 'emergency_contact',       label: 'Contacto de emergencia', group: 'Emergencia'     },
  { key: 'occupation',              label: 'Profesión',              group: 'Trabajo'        },
  { key: 'workplace',               label: 'Lugar de trabajo',       group: 'Trabajo'        },
  { key: 'allergies',               label: 'Alergias',               group: 'Salud'          },
  { key: 'medications',             label: 'Medicamentos',           group: 'Salud'          },
  { key: 'dietary_restrictions',    label: 'Restricción alimenticia', group: 'Salud'         },
]
