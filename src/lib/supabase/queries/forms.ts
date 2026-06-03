import { createAdminClient } from '@/lib/supabase/admin'

// NOTA: createAdminClient (service role) porque la app corre con mock auth.

export type DbFormField = {
  id: string
  field_type: string
  label: string
  placeholder: string | null
  help_text: string | null
  description: string | null
  is_required: boolean
  options: unknown
  conditions: unknown
  sort_order: number
  scale_min: number | null
  scale_max: number | null
  scale_min_label: string | null
  scale_max_label: string | null
}

export type DbFormTemplate = {
  id: string
  title: string
  description: string | null
  category: string | null
  entity_type: 'event' | 'study_group' | 'general' | null
  entity_id: string | null
  is_active: boolean
  created_at: string
  created_by: string | null
  fields: DbFormField[]
  responses: Array<{ submitted_at: string }>
}

export type DbFormResponse = {
  id: string
  form_id: string
  member_id: string | null
  member: { first_name: string; last_name: string } | null
  guest_name: string | null
  submitted_at: string
  values: Array<{ field_id: string; value_text: string | null; value_json: unknown }>
}

const FORM_SELECT = `
  id, title, description, category, entity_type, entity_id, is_active, created_at, created_by,
  fields:form_fields(
    id, field_type, label, placeholder, help_text, description, is_required,
    options, conditions, sort_order, scale_min, scale_max, scale_min_label, scale_max_label
  ),
  responses:form_responses(submitted_at)
`

export async function getForms(): Promise<DbFormTemplate[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('forms')
    .select(FORM_SELECT)
    .order('created_at', { ascending: false })
  if (error) throw error
  // Ordenamos los campos por sort_order (Supabase no garantiza orden en embeds).
  const rows = (data ?? []) as unknown as DbFormTemplate[]
  for (const f of rows) f.fields.sort((a, b) => a.sort_order - b.sort_order)
  return rows
}

export async function getFormById(id: string): Promise<DbFormTemplate | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('forms').select(FORM_SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as unknown as DbFormTemplate
  row.fields.sort((a, b) => a.sort_order - b.sort_order)
  return row
}

export async function getFormResponses(formId: string): Promise<DbFormResponse[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('form_responses')
    .select(`
      id, form_id, member_id, guest_name, submitted_at,
      member:members(first_name, last_name),
      values:form_response_values(field_id, value_text, value_json)
    `)
    .eq('form_id', formId)
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as DbFormResponse[]
}
