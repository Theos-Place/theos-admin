// Adapta filas de Supabase a los tipos de dominio de formularios.

import type { DbFormTemplate, DbFormField, DbFormResponse } from '@/lib/supabase/queries/forms'
import type { FormTemplate, FormFieldNew, FormResponse, FieldType, LogicRule } from '@/types/forms'

// Mapea field_type de la BD al FieldType del builder (algunos tipos no existen
// en el builder y se aproximan).
const FIELD_TYPE_MAP: Record<string, FieldType> = {
  text: 'text', textarea: 'textarea', number: 'number', date: 'date',
  select: 'select', radio: 'radio', checkbox: 'checkbox', scale: 'scale',
  yes_no: 'yes_no', personal_data: 'personal_data', page_break: 'page_break',
  section: 'section', section_header: 'section',
  // aproximaciones de tipos que el builder no tiene:
  email: 'text', phone: 'text', multiselect: 'select', file: 'text',
}

function toOptions(raw: unknown): string[] | undefined {
  if (Array.isArray(raw)) return raw.map(String)
  return undefined
}

function toLogicRules(raw: unknown): LogicRule[] | undefined {
  return Array.isArray(raw) ? (raw as LogicRule[]) : undefined
}

function toDomainField(db: DbFormField): FormFieldNew {
  return {
    id: db.id,
    type: FIELD_TYPE_MAP[db.field_type] ?? 'text',
    label: db.label,
    placeholder: db.placeholder ?? undefined,
    helper_text: db.help_text ?? undefined,
    description: db.description ?? undefined,
    is_required: db.is_required,
    sort_order: db.sort_order,
    options: toOptions(db.options),
    scale_min: db.scale_min ?? undefined,
    scale_max: db.scale_max ?? undefined,
    scale_min_label: db.scale_min_label ?? undefined,
    scale_max_label: db.scale_max_label ?? undefined,
    logic_rules: toLogicRules(db.conditions),
  }
}

export function toDomainFormTemplate(db: DbFormTemplate): FormTemplate {
  const dates = db.responses.map((r) => r.submitted_at).sort()
  return {
    id: db.id,
    name: db.title,
    description: db.description ?? '',
    category: (db.category as FormTemplate['category']) ?? 'other',
    entity_type: db.entity_type,
    entity_id: db.entity_id,
    entity_name: null, // se resuelve en la vista de detalle si hace falta (Fase 2b)
    is_active: db.is_active,
    created_at: db.created_at,
    created_by: db.created_by ?? '',
    fields: db.fields.map(toDomainField),
    responses_count: db.responses.length,
    last_response_at: dates.length ? dates[dates.length - 1] : null,
  }
}

export function toDomainFormResponse(db: DbFormResponse): FormResponse {
  const answers: Record<string, string | string[] | number> = {}
  for (const v of db.values) {
    if (v.value_json != null && typeof v.value_json !== 'string') {
      answers[v.field_id] = v.value_json as string[] | number
    } else {
      answers[v.field_id] = v.value_text ?? ''
    }
  }
  const memberName = db.member
    ? `${db.member.first_name} ${db.member.last_name}`.trim()
    : db.guest_name ?? ''

  return {
    id: db.id,
    form_id: db.form_id,
    member_id: db.member_id ?? '',
    member_name: memberName,
    submitted_at: db.submitted_at,
    answers,
  }
}
