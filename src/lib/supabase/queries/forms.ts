import { randomUUID } from 'crypto'
import { createAdminClient, type Insertable, type Updatable } from '@/lib/supabase/admin'

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
  is_public: boolean
  requires_auth: boolean
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
  id, title, description, category, entity_type, entity_id, is_active, is_public, requires_auth, created_at, created_by,
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
  const rows = (data ?? []) as DbFormTemplate[]
  for (const f of rows) f.fields.sort((a, b) => a.sort_order - b.sort_order)
  return rows
}

export async function getFormById(id: string): Promise<DbFormTemplate | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('forms').select(FORM_SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as DbFormTemplate
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
  return (data ?? []) as DbFormResponse[]
}

// ── Mutaciones ─────────────────────────────────────────────

export type FieldInput = {
  /** ID del campo en el builder (temporal o UUID existente). Se usa SOLO para
   *  remapear las referencias field_id de las reglas de lógica al UUID final. */
  id?: string
  field_type: string
  label: string
  placeholder?: string | null
  help_text?: string | null
  description?: string | null
  is_required?: boolean
  options?: unknown
  conditions?: unknown
  scale_min?: number | null
  scale_max?: number | null
  scale_min_label?: string | null
  scale_max_label?: string | null
}

type LogicCondition = { field_id?: string; operator?: string; value?: unknown }
type LogicRule = { id?: string; condition_operator?: string; action?: string; conditions?: LogicCondition[] }

/** Remapea los field_id de las reglas de lógica de los ids del builder al UUID
 *  final del campo referenciado. Descarta condiciones que apunten a un campo
 *  inexistente (p. ej. borrado) y reglas que se queden sin condiciones. */
function remapConditions(raw: unknown, idMap: Map<string, string>): LogicRule[] | null {
  if (!Array.isArray(raw)) return null
  const rules: LogicRule[] = []
  for (const rule of raw as LogicRule[]) {
    const conds = (rule.conditions ?? [])
      .filter(c => c.field_id && idMap.has(c.field_id))
      .map(c => ({ ...c, field_id: idMap.get(c.field_id!)! }))
    if (conds.length > 0) rules.push({ ...rule, conditions: conds })
  }
  return rules.length > 0 ? rules : null
}

/** Construye las filas de form_fields con UUID asignado y reglas de lógica
 *  remapeadas (las referencias entre campos quedan consistentes con los UUID
 *  persistidos, sobreviviendo a create y a edit/delete+reinsert). */
function buildFieldRows(formId: string, fields: FieldInput[]) {
  const idMap = new Map<string, string>()
  const uuids = fields.map(f => {
    const uuid = randomUUID()
    if (f.id) idMap.set(f.id, uuid)
    return uuid
  })
  return fields.map((f, i) => ({
    id: uuids[i],
    form_id: formId,
    sort_order: i,
    field_type: f.field_type,
    label: f.label,
    placeholder: f.placeholder ?? null,
    help_text: f.help_text ?? null,
    description: f.description ?? null,
    is_required: Boolean(f.is_required),
    options: f.options ?? null,
    conditions: remapConditions(f.conditions, idMap),
    scale_min: f.scale_min ?? null,
    scale_max: f.scale_max ?? null,
    scale_min_label: f.scale_min_label ?? null,
    scale_max_label: f.scale_max_label ?? null,
  }))
}

export type FormWriteInput = {
  title: string
  description?: string | null
  category?: string | null
  entity_type?: 'event' | 'study_group' | 'general' | null
  entity_id?: string | null
  slug?: string | null
  is_active?: boolean
}

async function insertFields(supabase: ReturnType<typeof createAdminClient>, formId: string, fields: FieldInput[]) {
  if (fields.length === 0) return
  const rows = buildFieldRows(formId, fields)
  const { error } = await supabase.from('form_fields').insert(rows as Insertable<'form_fields'>[])
  if (error) throw error
}

export async function createForm(input: FormWriteInput, fields: FieldInput[] = []): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('forms').insert(input).select('id').single()
  if (error) throw error
  const id = (data as { id: string }).id
  await insertFields(supabase, id, fields)
  return { id }
}

/** Actualiza el form. Si se pasan `fields`, reemplaza el set completo. */
export async function updateForm(
  id: string,
  patch: Partial<FormWriteInput>,
  fields?: FieldInput[],
): Promise<void> {
  const supabase = createAdminClient()
  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from('forms').update(patch).eq('id', id)
    if (error) throw error
  }
  if (fields) {
    const { error: delErr } = await supabase.from('form_fields').delete().eq('form_id', id)
    if (delErr) throw delErr
    await insertFields(supabase, id, fields)
  }
}

export async function deleteForm(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('forms').delete().eq('id', id)
  if (error) throw error
}

/** Registra una respuesta: crea form_response y sus form_response_values.
 *  `answers` viene keyed por field_id. */
export async function submitResponse(
  formId: string,
  input: {
    member_id?: string | null
    guest_name?: string | null
    guest_email?: string | null
    answers: Record<string, string | string[] | number>
  },
): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('form_responses')
    .insert({
      form_id: formId,
      member_id: input.member_id ?? null,
      guest_name: input.guest_name ?? null,
      guest_email: input.guest_email ?? null,
    })
    .select('id')
    .single()
  if (error) throw error
  const responseId = (data as { id: string }).id

  const values = Object.entries(input.answers).map(([field_id, value]) => {
    const isComposite = Array.isArray(value) || typeof value === 'number'
    return {
      response_id: responseId,
      field_id,
      value_text: isComposite ? null : String(value),
      value_json: isComposite ? value : null,
    }
  })
  if (values.length > 0) {
    const { error: vErr } = await supabase.from('form_response_values').insert(values)
    if (vErr) throw vErr
  }
  return { id: responseId }
}
