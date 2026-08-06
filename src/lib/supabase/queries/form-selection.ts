import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getFormById, getFormResponses } from '@/lib/supabase/queries/forms'
import { createInvitation } from '@/lib/supabase/queries/study-invitations'
import { createBroadcast, sendBroadcast } from '@/lib/supabase/queries/communications'
import {
  selectionPlanCode, selectionFieldIds, toYesNo, canInvite, inviteBlockReason,
  type SelectionRow, type SelectionStatus, type SelectionField,
} from '@/lib/forms/selection-rules'

// EST-10: datos de la pantalla de selección del comité. La tabla
// form_response_reviews tiene RLS sin policies (solo service role): el gate de
// rol (SELECTION_REVIEW_ROLES) lo pone cada endpoint.
const loose = () => createAdminClient() as unknown as SupabaseClient

type ReviewRow = {
  id: string
  response_id: string
  status: SelectionStatus
  notes: string | null
  invited_at: string | null
  reviewed_by: string | null
  reviewed_at: string | null
}

/** La fila lleva las respuestas completas: la pantalla del comité es el ÚNICO
 *  lugar gateado que las muestra, así no hay que abrir /api/forms/[id]/responses
 *  (que pide el módulo 'formularios' y tiene otra audiencia). */
export type SelectionRowFull = SelectionRow & {
  answers: Array<{ label: string; value: string }>
}

export type SelectionData = {
  form: { id: string; title: string; plan_code: string | null }
  /** Etiquetas de las preguntas que alimentan los filtros (para la UI). */
  labels: { doctrine: string | null; availability: string | null; group: string | null }
  rows: SelectionRowFull[]
  /** Plantillas de correo activas para la invitación. Van en esta respuesta
   *  porque /api/communications/templates pide el módulo comunicaciones y el
   *  comité de dirigentes no lo tiene. */
  templates: Array<{ id: string; name: string; subject: string | null }>
  /** Plantilla sugerida: la de invitación que menciona el code del plan. */
  suggested_template_id: string | null
  /** Etapa 1: a quién se puede convocar (recomendados en EST-9 que todavía no
   *  se han preinscrito en este formulario). */
  convocation: Array<{ member_id: string; member_name: string }>
}

const fullName = (m: { first_name: string; last_name: string } | null) =>
  m ? `${m.first_name} ${m.last_name}`.trim() : ''

/** Respuestas + decisión del comité + recomendación de EST-9, en una sola carga. */
export async function getSelectionData(formId: string): Promise<SelectionData | null> {
  const form = await getFormById(formId)
  if (!form) return null

  const fields = form.fields as unknown as SelectionField[]
  const planCode = selectionPlanCode(fields)
  const ids = selectionFieldIds(fields)
  const labelOf = (fieldId: string | null) => fields.find(f => f.id === fieldId)?.label ?? null

  const responses = await getFormResponses(formId)
  const sb = loose()

  const { data: reviewData, error: revErr } = await sb
    .from('form_response_reviews')
    .select('id, response_id, status, notes, invited_at, reviewed_by, reviewed_at')
    .eq('form_id', formId)
  if (revErr) throw revErr
  const reviewByResponse = new Map(
    ((reviewData ?? []) as ReviewRow[]).map(r => [r.response_id, r]),
  )

  // Recomendación a CDEB del cierre de su estudio previo (EST-9), solo ENVIADAS:
  // un borrador ajeno no es información del comité. La más reciente por miembro.
  const memberIds = [...new Set(responses.map(r => r.member_id).filter((id): id is string => !!id))]
  const recByMember = new Map<string, string>()
  for (let i = 0; i < memberIds.length; i += 300) {
    const { data, error } = await sb
      .from('cdeb_recommendations')
      .select('member_id, recommendation, created_at')
      .in('member_id', memberIds.slice(i, i + 300))
      .eq('status', 'enviada')
      .order('created_at', { ascending: false })
    if (error) throw error
    for (const r of (data ?? []) as Array<{ member_id: string; recommendation: string | null }>) {
      if (!recByMember.has(r.member_id) && r.recommendation) recByMember.set(r.member_id, r.recommendation)
    }
  }

  // Campos con respuesta (los informativos y los separadores no se muestran).
  const dataFields = fields.filter(f => !['info', 'section', 'section_header', 'page_break'].includes(f.type))

  const rows: SelectionRowFull[] = responses.map(resp => {
    const answer = (fieldId: string | null) => {
      if (!fieldId) return undefined
      const v = resp.values.find(v => v.field_id === fieldId)
      if (!v) return undefined
      return v.value_json != null && typeof v.value_json !== 'string' ? v.value_json : v.value_text
    }
    const review = reviewByResponse.get(resp.id)
    const group = answer(ids.group)
    return {
      response_id: resp.id,
      member_id: resp.member_id,
      member_name: fullName(resp.member) || resp.guest_name || 'Sin nombre',
      submitted_at: resp.submitted_at,
      status: review?.status ?? 'pendiente',
      notes: review?.notes ?? null,
      invited_at: review?.invited_at ?? null,
      agrees_doctrine: toYesNo(answer(ids.doctrine)),
      available: toYesNo(answer(ids.availability)),
      chosen_group: typeof group === 'string' && group ? group : null,
      recommendation: (resp.member_id && recByMember.get(resp.member_id)) || null,
      answers: dataFields.map(f => {
        const a = answer(f.id)
        return { label: f.label, value: Array.isArray(a) ? a.map(String).join(', ') : a == null ? '' : String(a) }
      }),
    }
  })

  const { data: tplData, error: tplErr } = await sb
    .from('message_templates')
    .select('id, name, subject')
    .eq('channel', 'email')
    .eq('is_active', true)
    .order('name')
  if (tplErr) throw tplErr
  const templates = (tplData ?? []) as SelectionData['templates']
  const suggested = planCode
    ? templates.find(t => /invitaci/i.test(t.name) && t.name.toUpperCase().includes(planCode))
    : undefined

  const convocation = await convocationCandidates(sb, responses.map(r => r.member_id))

  return {
    form: { id: form.id, title: form.title, plan_code: planCode },
    labels: { doctrine: labelOf(ids.doctrine), availability: labelOf(ids.availability), group: labelOf(ids.group) },
    rows,
    templates,
    suggested_template_id: suggested?.id ?? null,
    convocation,
  }
}

/** Audiencia de la convocatoria: quienes tienen una recomendación ENVIADA de
 *  EST-9 que dice "sí" (con o sin reservas), y que todavía NO se preinscribieron.
 *  Los "no lo recomiendo" quedan fuera: convocarlos sería sembrar expectativa. */
/** Criterio ÚNICO de "está convocado a la preinscripción": una recomendación de
 *  EST-9 ya ENVIADA que dice que sí. Lo usan la lista de convocatoria (acá) y el
 *  guard de llenado (form-fill-access) — si se separan, alguien queda afuera del
 *  formulario al que sí lo invitamos, o entra alguien que no. */
export const CONVOKED_STATUS = 'enviada'
export const CONVOKED_RECOMMENDATION_PREFIX = 'si%'

async function convocationCandidates(
  sb: SupabaseClient,
  respondedMemberIds: Array<string | null>,
): Promise<Array<{ member_id: string; member_name: string }>> {
  const already = new Set(respondedMemberIds.filter((id): id is string => !!id))
  const { data, error } = await sb
    .from('cdeb_recommendations')
    .select(`member_id, recommendation,
             member:members!cdeb_recommendations_member_id_fkey(first_name, last_name, is_active, email)`)
    .eq('status', CONVOKED_STATUS)
    .like('recommendation', CONVOKED_RECOMMENDATION_PREFIX)
  if (error) throw error
  const rows = (data ?? []) as unknown as Array<{
    member_id: string
    member: { first_name: string; last_name: string; is_active: boolean; email: string | null } | null
  }>
  const out = new Map<string, string>()
  for (const r of rows) {
    if (already.has(r.member_id) || out.has(r.member_id)) continue
    if (!r.member?.is_active || !r.member.email) continue
    out.set(r.member_id, fullName(r.member))
  }
  return [...out].map(([member_id, member_name]) => ({ member_id, member_name }))
    .sort((a, b) => a.member_name.localeCompare(b.member_name, 'es'))
}

/** Token que la plantilla de convocatoria usa para el link al formulario. */
export const FORM_LINK_TOKEN = '{link_formulario}'

/** Etapa 1: manda el link del formulario de preinscripción a los recomendados.
 *  Transaccional: es una invitación personal a preinscribirse, no una campaña. */
export async function convokeSelection(input: {
  formId: string
  templateId: string
  memberIds: string[]
}): Promise<{ queued: number; broadcast_id: string | null }> {
  const data = await getSelectionData(input.formId)
  if (!data) throw new Error('FORM_NO_ENCONTRADO')

  const eligible = new Set(data.convocation.map(c => c.member_id))
  const recipients = input.memberIds.filter(id => eligible.has(id))
  if (recipients.length === 0) return { queued: 0, broadcast_id: null }

  const sb = loose()
  const { data: tpl, error: tplErr } = await sb
    .from('message_templates').select('id, subject, body, body_format')
    .eq('id', input.templateId).maybeSingle()
  if (tplErr) throw tplErr
  if (!tpl) throw new Error('PLANTILLA_NO_ENCONTRADA')
  const template = tpl as { id: string; subject: string | null; body: string; body_format: string | null }

  // El link al formulario se inyecta acá: la plantilla queda reutilizable para
  // cualquier convocatoria (si no trae el token, se envía tal cual — puede que
  // el link ya esté escrito en el cuerpo).
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://admin.theosplace.org'
  const link = `${siteUrl}/formularios/${input.formId}/responder`
  const body = template.body.split(FORM_LINK_TOKEN).join(link)

  const broadcast = await createBroadcast({
    template_id: template.id,
    channel: 'email',
    kind: 'transactional',
    subject: template.subject,
    body,
    body_format: (template.body_format as 'text' | 'html' | null) ?? 'html',
    segment_label: `Convocatoria · ${data.form.title}`,
    total_recipients: recipients.length,
  })
  await sendBroadcast(broadcast.id, recipients.map(member_id => ({
    member_id, channel: 'email' as const, recipient: '',
  })))
  return { queued: recipients.length, broadcast_id: broadcast.id }
}

/** Guarda la decisión y/o las notas internas de una respuesta (upsert por respuesta). */
export async function saveSelectionReview(input: {
  formId: string
  responseId: string
  status?: SelectionStatus
  notes?: string | null
  reviewedBy: string | null
}): Promise<void> {
  const sb = loose()
  // La respuesta debe pertenecer al formulario: sin esto, un response_id de otro
  // formulario quedaría revisado bajo este form_id.
  const { data: resp, error: respErr } = await sb
    .from('form_responses').select('id').eq('id', input.responseId).eq('form_id', input.formId).maybeSingle()
  if (respErr) throw respErr
  if (!resp) throw new Error('RESPUESTA_NO_ENCONTRADA')

  const patch: Record<string, unknown> = {
    response_id: input.responseId,
    form_id: input.formId,
    reviewed_by: input.reviewedBy,
    reviewed_at: new Date().toISOString(),
  }
  if (input.status) patch.status = input.status
  if (input.notes !== undefined) patch.notes = input.notes

  const { error } = await sb.from('form_response_reviews')
    .upsert(patch, { onConflict: 'response_id' })
  if (error) throw error
}

export type InviteResult = {
  invited: number
  skipped: Array<{ response_id: string; reason: string }>
  broadcast_id: string | null
}

/** Invita a los aprobados: crea la invitación al plan y manda la plantilla de
 *  correo elegida como broadcast transaccional (queda en Comunicaciones, con
 *  su cola y sus contadores). Marca la revisión para no invitar dos veces. */
export async function inviteSelected(input: {
  formId: string
  responseIds: string[]
  templateId: string
  invitedBy: string | null
}): Promise<InviteResult> {
  const data = await getSelectionData(input.formId)
  if (!data) throw new Error('FORM_NO_ENCONTRADO')
  if (!data.form.plan_code) throw new Error('FORM_SIN_PLAN')

  const sb = loose()
  const { data: plan, error: planErr } = await sb
    .from('study_plans').select('id').eq('code', data.form.plan_code).maybeSingle()
  if (planErr) throw planErr
  if (!plan) throw new Error('PLAN_NO_ENCONTRADO')

  const { data: tpl, error: tplErr } = await sb
    .from('message_templates').select('id, subject, body, body_format')
    .eq('id', input.templateId).maybeSingle()
  if (tplErr) throw tplErr
  if (!tpl) throw new Error('PLANTILLA_NO_ENCONTRADA')
  const template = tpl as { id: string; subject: string | null; body: string; body_format: string | null }

  const wanted = new Set(input.responseIds)
  const skipped: InviteResult['skipped'] = []
  const ready: SelectionRow[] = []
  for (const row of data.rows) {
    if (!wanted.has(row.response_id)) continue
    if (!canInvite(row)) {
      skipped.push({ response_id: row.response_id, reason: inviteBlockReason(row) ?? 'No se puede invitar.' })
      continue
    }
    ready.push(row)
  }

  const invitedRows: Array<{ row: SelectionRow; invitationId: string }> = []
  for (const row of ready) {
    try {
      const inv = await createInvitation({
        member_id: row.member_id!,
        plan_id: (plan as { id: string }).id,
        invited_by: input.invitedBy,
        notes: `Seleccionado en "${data.form.title}"`,
      })
      invitedRows.push({ row, invitationId: inv.id })
    } catch (e) {
      const reason = e instanceof Error && e.message === 'MIEMBRO_NO_RECOMENDADO'
        ? 'Está marcado como no recomendado para dar estudios.'
        : 'No se pudo crear la invitación.'
      skipped.push({ response_id: row.response_id, reason })
    }
  }

  if (invitedRows.length === 0) return { invited: 0, skipped, broadcast_id: null }

  // Transaccional: es el aviso de una decisión personal, no una campaña — no
  // respeta opt-out de marketing ni lleva pie de baja.
  const broadcast = await createBroadcast({
    template_id: template.id,
    channel: 'email',
    kind: 'transactional',
    subject: template.subject,
    body: template.body,
    body_format: (template.body_format as 'text' | 'html' | null) ?? 'html',
    segment_label: `Seleccionados · ${data.form.title}`,
    total_recipients: invitedRows.length,
  })
  await sendBroadcast(broadcast.id, invitedRows.map(({ row }) => ({
    member_id: row.member_id, channel: 'email' as const, recipient: '',
  })))

  const now = new Date().toISOString()
  for (const { row, invitationId } of invitedRows) {
    const { error } = await sb.from('form_response_reviews').update({
      invited_at: now, invitation_id: invitationId, broadcast_id: broadcast.id,
    }).eq('response_id', row.response_id)
    if (error) throw error
  }

  return { invited: invitedRows.length, skipped, broadcast_id: broadcast.id }
}
