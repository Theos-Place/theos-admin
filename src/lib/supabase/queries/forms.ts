import { randomUUID } from 'crypto'
import { createAdminClient, type Insertable } from '@/lib/supabase/admin'
import { sendSystemEmail } from '@/lib/email/system-templates'

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
  allow_multiple_responses: boolean | null
  created_at: string
  created_by: string | null
  /** FRM-2 · Encabezado del formulario. */
  hero_image_url: string | null
  hero_title: string | null
  hero_subtitle: string | null
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
  id, title, description, category, entity_type, entity_id, is_active, is_public, requires_auth, allow_multiple_responses, created_at, created_by,
  hero_image_url, hero_title, hero_subtitle,
  fields:form_fields(
    id, field_type, label, placeholder, help_text, description, is_required,
    options, options_source, options_source_param, conditions, sort_order, scale_min, scale_max, scale_min_label, scale_max_label
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
  /** EST-10: fuente dinámica de opciones (se resuelve al abrir el formulario). */
  options_source?: string | null
  options_source_param?: string | null
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
 *  persistidos). Los campos cuyo id ya existe en la BD (`existingIds`)
 *  conservan su UUID: las form_response_values que los referencian
 *  sobreviven a la edición. */
function buildFieldRows(formId: string, fields: FieldInput[], existingIds?: Set<string>) {
  const idMap = new Map<string, string>()
  const uuids = fields.map(f => {
    const uuid = f.id && existingIds?.has(f.id) ? f.id : randomUUID()
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
    options_source: f.options_source ?? null,
    options_source_param: f.options_source_param ?? null,
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
  /** Abierto a cualquiera con el link (escapatoria del guard de llenado). */
  is_public?: boolean
  /** FRM-2 · Encabezado. null limpia el campo (quitar el flyer). */
  hero_image_url?: string | null
  hero_title?: string | null
  hero_subtitle?: string | null
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

/** Actualiza el form. Si se pasan `fields`, sincroniza el set: los campos
 *  existentes conservan su UUID (upsert) y solo se borran los eliminados en
 *  el builder — borrar un form_field elimina en cascada sus
 *  form_response_values, así que un delete+reinsert total destruiría las
 *  respuestas históricas. */
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
    const { data: existing, error: exErr } = await supabase
      .from('form_fields').select('id').eq('form_id', id)
    if (exErr) throw exErr
    const existingIds = new Set((existing ?? []).map(r => (r as { id: string }).id))

    const rows = buildFieldRows(id, fields, existingIds)
    const keepIds = new Set(rows.map(r => r.id))
    const toDelete = [...existingIds].filter(fid => !keepIds.has(fid))
    if (toDelete.length > 0) {
      const { error: delErr } = await supabase.from('form_fields').delete().in('id', toDelete)
      if (delErr) throw delErr
    }
    if (rows.length > 0) {
      const { error: upErr } = await supabase
        .from('form_fields')
        .upsert(rows as Insertable<'form_fields'>[], { onConflict: 'id' })
      if (upErr) throw upErr
    }
  }
}

export async function deleteForm(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('forms').delete().eq('id', id)
  if (error) throw error
}

/** Registra una respuesta: crea form_response y sus form_response_values.
 *  `answers` viene keyed por field_id. */
/** EST-10: ¿este miembro ya respondió el formulario? (dedupe del llenado). */
/**
 * EST-10: resuelve las opciones DINÁMICAS de los campos que las declaran.
 * Hoy la única fuente es 'study_groups_open': grupos en matrícula del plan
 * indicado, etiquetados con dirigente, día y hora + "No me sirve" al final.
 * Se llama al servir el formulario, así la lista siempre está al día.
 */
export async function resolveDynamicOptions(form: DbFormTemplate): Promise<DbFormTemplate> {
  const dynamic = form.fields.filter(f => (f as { options_source?: string | null }).options_source === 'study_groups_open')
  if (dynamic.length === 0) return form
  const supabase = createAdminClient()
  const byPlan = new Map<string, string[]>()
  for (const f of dynamic) {
    const planCode = ((f as { options_source_param?: string | null }).options_source_param ?? '').trim().toUpperCase()
    if (!planCode || byPlan.has(planCode)) continue
    const { data } = await supabase
      .from('study_groups')
      .select('name, zone, schedule_days, schedule_time, status, plan:study_plans!inner(code), leader:members!study_groups_leader_id_fkey(first_name, last_name)')
      .eq('status', 'en_matricula')
      .eq('study_plans.code', planCode)
    type Row = {
      name: string | null; zone: string | null; schedule_days: string[] | null; schedule_time: string | null
      leader: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
    }
    const DAY: Record<string, string> = { L: 'Lun', M: 'Mar', X: 'Mié', J: 'Jue', V: 'Vie', S: 'Sáb', D: 'Dom' }
    const opts = ((data ?? []) as unknown as Row[]).map(g => {
      const l = Array.isArray(g.leader) ? g.leader[0] : g.leader
      const leader = l ? `${l.first_name} ${l.last_name}`.trim() : 'Sin dirigente'
      const days = (g.schedule_days ?? []).map(d => DAY[d] ?? d).join('/')
      return [g.name ?? planCode, leader, g.zone, days, g.schedule_time].filter(Boolean).join(' · ')
    })
    byPlan.set(planCode, [...opts, 'No me sirve'])
  }
  return {
    ...form,
    fields: form.fields.map(f => {
      const src = (f as { options_source?: string | null }).options_source
      if (src !== 'study_groups_open') return f
      const planCode = ((f as { options_source_param?: string | null }).options_source_param ?? '').trim().toUpperCase()
      return { ...f, options: byPlan.get(planCode) ?? ['No me sirve'] }
    }),
  }
}

export async function hasMemberResponded(formId: string, memberId: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('form_responses').select('id')
    .eq('form_id', formId).eq('member_id', memberId).limit(1)
  if (error) throw error
  return (data ?? []).length > 0
}

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
  // RPC TRANSACCIONAL (migración 119, auditoría A14): antes eran 2 inserts
  // sueltos y un fallo entre ambos dejaba una respuesta fantasma (contaba en
  // los totales, vacía al abrirla).
  const { data: rpcId, error } = await supabase.rpc('submit_form_response', {
    p_form_id: formId,
    // null explícito (sin DEFAULT en la función, undefined omitiría la key).
    p_member_id: (input.member_id ?? null) as unknown as string,
    p_guest_name: (input.guest_name ?? null) as unknown as string,
    p_guest_email: (input.guest_email ?? null) as unknown as string,
    p_answers: input.answers,
  })
  if (error) throw error
  const responseId = rpcId as unknown as string

  // Confirmación "form_completado" al remitente (best-effort, transaccional).
  try {
    let email = input.guest_email ?? null
    let nombre = input.guest_name ?? ''
    if (input.member_id) {
      const { data: mem } = await supabase.from('members').select('first_name, last_name, email').eq('id', input.member_id).maybeSingle()
      if (mem) { email = mem.email; nombre = `${mem.first_name ?? ''} ${mem.last_name ?? ''}`.trim() }
    }
    if (email) {
      const { data: form } = await supabase.from('forms').select('title').eq('id', formId).maybeSingle()
      await sendSystemEmail({
        systemKey: 'form_completado',
        to: { email, name: nombre },
        data: {
          nombre,
          nombre_form: form?.title ?? 'el formulario',
          id_respuesta: responseId,
          fecha_envio: new Date().toLocaleDateString('es-CR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Costa_Rica' }),
          link_respuestas: process.env.NEXT_PUBLIC_SITE_URL ?? '',
        },
      })
    }
  } catch (e) {
    console.warn('submitResponse form_completado email:', e)
  }

  // EVE-4 · Si este formulario es el de INSCRIPCIÓN de un evento, la respuesta
  // se enlaza a la inscripción de esa persona. La inscripción sigue siendo la
  // verdad (cupo, pago, check-in); esto es información adicional.
  //
  // Se hace acá, no en el endpoint, para que valga por cualquier camino: el
  // botón del evento, el link directo al formulario o el staff respondiendo por
  // alguien. Best-effort: si falla, la respuesta y la inscripción existen igual.
  if (input.member_id) {
    try {
      await linkResponseToRegistration(supabase, formId, input.member_id, responseId)
    } catch (e) {
      console.warn('submitResponse enlace con inscripción:', e)
    }
  }

  return { id: responseId }
}

/** Enlaza la respuesta con la inscripción del miembro al evento cuyo formulario
 *  de inscripción es `formId`. No pisa un enlace ya existente: la primera
 *  respuesta es la que queda. */
async function linkResponseToRegistration(
  supabase: ReturnType<typeof createAdminClient>,
  formId: string,
  memberId: string,
  responseId: string,
): Promise<void> {
  const { data: eventos } = await supabase
    .from('events').select('id').eq('registration_form_id', formId)
  const ids = ((eventos ?? []) as Array<{ id: string }>).map(e => e.id)
  if (ids.length === 0) return
  await supabase
    .from('event_registrations')
    .update({ form_response_id: responseId })
    .in('event_id', ids)
    .eq('member_id', memberId)
    .is('form_response_id', null)
}

// ── Accesos puntuales por formulario (2026-08-04) ───────────────────────────
// Tabla form_access_grants: dar a una persona la LECTURA y EXPORTACIÓN de las
// respuestas de UN formulario. La decisión de autorización vive en
// src/lib/auth/forms-scope.ts (pura); acá solo se leen y escriben las filas.

export type FormAccessGrant = {
  id: string
  form_id: string
  member_id: string
  member_name: string
  member_email: string | null
  granted_by_name: string | null
  granted_at: string
}

/** ¿Esta persona tiene acceso puntual a ESTE formulario? */
export async function hasFormAccessGrant(formId: string, memberId: string | null): Promise<boolean> {
  if (!memberId) return false
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('form_access_grants')
    .select('id')
    .eq('form_id', formId)
    .eq('member_id', memberId)
    .maybeSingle()
  if (error) { console.warn('hasFormAccessGrant:', error.message); return false }
  return !!data
}

/** Formularios a los que esta persona tiene acceso puntual (para acotar el
 *  listado de quien no tiene el módulo). */
export async function getGrantedFormIds(memberId: string | null): Promise<string[]> {
  if (!memberId) return []
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('form_access_grants').select('form_id').eq('member_id', memberId)
  if (error) { console.warn('getGrantedFormIds:', error.message); return [] }
  return (data ?? []).map(r => (r as { form_id: string }).form_id)
}

/** Personas con acceso puntual a un formulario (para la pantalla de config). */
export async function getFormAccessGrants(formId: string): Promise<FormAccessGrant[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('form_access_grants')
    .select(`
      id, form_id, member_id, granted_at,
      member:members!form_access_grants_member_id_fkey(first_name, last_name, email),
      granter:members!form_access_grants_granted_by_fkey(first_name, last_name)
    `)
    .eq('form_id', formId)
    .order('granted_at', { ascending: true })
  if (error) throw error
  type Row = {
    id: string; form_id: string; member_id: string; granted_at: string
    member: { first_name: string; last_name: string; email: string | null } | null
    granter: { first_name: string; last_name: string } | null
  }
  return ((data ?? []) as Row[]).map(r => ({
    id: r.id,
    form_id: r.form_id,
    member_id: r.member_id,
    member_name: [r.member?.first_name, r.member?.last_name].filter(Boolean).join(' ') || '—',
    member_email: r.member?.email ?? null,
    granted_by_name: r.granter ? [r.granter.first_name, r.granter.last_name].filter(Boolean).join(' ') : null,
    granted_at: r.granted_at,
  }))
}

/** Alta idempotente: repetir el mismo acceso no falla ni duplica (UNIQUE). */
export async function grantFormAccess(
  formId: string, memberId: string, grantedBy: string | null,
): Promise<{ created: boolean }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('form_access_grants')
    .upsert({ form_id: formId, member_id: memberId, granted_by: grantedBy },
      { onConflict: 'form_id,member_id', ignoreDuplicates: true })
  if (error) throw error
  return { created: true }
}

export async function revokeFormAccess(formId: string, memberId: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('form_access_grants').delete().eq('form_id', formId).eq('member_id', memberId)
  if (error) throw error
}
