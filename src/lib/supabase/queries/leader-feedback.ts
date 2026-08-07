// Retroalimentación al dirigente contra la base. La REGLA es pura y vive en
// @/lib/studies/leader-feedback; acá solo se leen y escriben filas.
import { createAdminClient } from '@/lib/supabase/admin'
import { canEvaluate, summarize, type FeedbackRow, type FeedbackSummary } from '@/lib/studies/leader-feedback'
import { responseAverage, perQuestionSummary, type RespuestaCerrada } from '@/lib/studies/study-survey'
import { currentSurveyFormId } from '@/lib/email/leader-feedback-notify'
import type { SupabaseClient } from '@supabase/supabase-js'

type GrupoRef = {
  id: string
  name: string | null
  status: string | null
  leader_id: string | null
  co_leader_id: string | null
  plan_name: string | null
  leader_name: string | null
  /** Cuándo la coordinación compartió la retroalimentación con el dirigente. */
  feedback_released_at: string | null
}

/** Datos del grupo que necesita la evaluación (dirigente, estado, nombres). */
export async function feedbackGroupRef(groupId: string): Promise<GrupoRef | null> {
  const sb = createAdminClient() as unknown as SupabaseClient
  const { data } = await sb
    .from('study_groups')
    .select('id, name, status, leader_id, co_leader_id, feedback_released_at, plan:study_plans(name), leader:members!study_groups_leader_id_fkey(first_name, last_name)')
    .eq('id', groupId)
    .maybeSingle()
  if (!data) return null
  const g = data as unknown as {
    id: string; name: string | null; status: string | null
    leader_id: string | null; co_leader_id: string | null
    feedback_released_at: string | null
    plan: { name: string | null } | null
    leader: { first_name: string; last_name: string } | null
  }
  return {
    id: g.id,
    name: g.name,
    status: g.status,
    leader_id: g.leader_id,
    co_leader_id: g.co_leader_id,
    plan_name: g.plan?.name ?? null,
    leader_name: g.leader ? `${g.leader.first_name} ${g.leader.last_name}`.trim() : null,
    feedback_released_at: g.feedback_released_at,
  }
}

/** ¿Puede esta persona evaluar este grupo? Resuelve las señales y delega la
 *  decisión en la regla pura. */
export async function memberCanEvaluate(groupId: string, memberId: string) {
  const sb = createAdminClient() as unknown as SupabaseClient
  const grupo = await feedbackGroupRef(groupId)
  if (!grupo) return { grupo: null, decision: { allowed: false as const, reason: 'Grupo no encontrado.' } }

  const [{ data: enr }, { data: yaResp }] = await Promise.all([
    sb.from('study_enrollments').select('status').eq('group_id', groupId).eq('member_id', memberId).maybeSingle(),
    sb.from('leader_evaluations').select('id').eq('group_id', groupId).eq('member_id', memberId).limit(1),
  ])

  return {
    grupo,
    decision: canEvaluate({
      enrollmentStatus: (enr as { status: string } | null)?.status ?? null,
      groupClosed: grupo.status === 'finalizado',
      alreadyAnswered: ((yaResp ?? []) as unknown[]).length > 0,
      isLeader: memberId === grupo.leader_id || memberId === grupo.co_leader_id,
    }),
  }
}

/** Las preguntas del cuestionario que le tocó a este grupo. */
export async function surveyQuestions(groupId: string): Promise<{
  formId: string | null
  fields: Array<{ id: string; label: string; help_text: string | null; description: string | null; field_type: string; options: string[]; is_required: boolean }>
}> {
  const sb = createAdminClient() as unknown as SupabaseClient
  const { data: g } = await sb.from('study_groups').select('survey_form_id').eq('id', groupId).maybeSingle()
  let formId = (g as { survey_form_id: string | null } | null)?.survey_form_id ?? null
  // Grupos cerrados ANTES de EST-12 no tienen cuestionario fijado: se usa el vigente.
  if (!formId) formId = await currentSurveyFormId(sb)
  if (!formId) return { formId: null, fields: [] }

  const { data } = await sb.from('form_fields')
    .select('id, label, help_text, description, field_type, options, is_required')
    .eq('form_id', formId).order('sort_order')
  const fields = ((data ?? []) as Array<{ id: string; label: string; help_text: string | null; description: string | null; field_type: string; options: unknown; is_required: boolean | null }>)
    .map(f => ({
      id: f.id, label: f.label, help_text: f.help_text, description: f.description,
      field_type: f.field_type,
      options: Array.isArray(f.options) ? (f.options as string[]) : [],
      is_required: !!f.is_required,
    }))
  return { formId, fields }
}

/** Guarda la respuesta COMPLETA del cuestionario (EST-12 parte 2):
 *  la respuesta detallada va a form_responses/values y la PROYECCIÓN a
 *  leader_evaluations, que es lo que permite promediar por dirigente. */
export async function saveSurveyResponse(input: {
  groupId: string
  memberId: string
  formId: string
  answers: Record<string, string>
}): Promise<void> {
  const sb = createAdminClient() as unknown as SupabaseClient
  const grupo = await feedbackGroupRef(input.groupId)
  if (!grupo?.leader_id) throw new Error('GRUPO_SIN_DIRIGENTE')
  const { data: sl } = await sb
    .from('study_leaders').select('id').eq('member_id', grupo.leader_id).limit(1).maybeSingle()
  const leaderId = (sl as { id: string } | null)?.id
  if (!leaderId) throw new Error('DIRIGENTE_SIN_FICHA')

  // ANTES de escribir nada: si ya respondió, se corta. El endpoint ya lo valida,
  // pero si el choque saliera recién en la proyección quedaría una respuesta
  // huérfana en form_responses — pasó al probar esto de punta a punta.
  const { data: yaResp } = await sb.from('leader_evaluations')
    .select('id').eq('group_id', input.groupId).eq('member_id', input.memberId).limit(1)
  if (((yaResp ?? []) as unknown[]).length > 0) throw new Error('YA_RESPONDIO')

  // La respuesta detallada, por el mismo RPC transaccional del módulo de forms.
  const { data: rpcId, error } = await sb.rpc('submit_form_response', {
    p_form_id: input.formId,
    p_member_id: input.memberId,
    p_guest_name: null,
    p_guest_email: null,
    p_answers: input.answers,
  } as never)
  if (error) throw error
  const responseId = rpcId as unknown as string

  // La proyección: promedio de las cerradas + el comentario abierto principal.
  const { fields } = await surveyQuestions(input.groupId)
  const cerradas = fields.filter(f => f.field_type === 'radio').map(f => ({
    fieldId: f.id, label: f.label, options: f.options, answer: input.answers[f.id] ?? null,
  }))
  const promedio = responseAverage(cerradas)
  const abierto = fields
    .filter(f => f.field_type === 'textarea' && !/folleto/i.test(f.label))
    .map(f => input.answers[f.id])
    .find(v => (v ?? '').trim()) ?? null

  const { error: projErr } = await sb.from('leader_evaluations').insert({
    leader_id: leaderId,
    co_leader_id: grupo.co_leader_id,
    group_id: input.groupId,
    member_id: input.memberId,
    response_id: responseId,
    // Sin ninguna pregunta puntuada (todo "No aplica") igual queda la fila, con
    // el mínimo: la respuesta existe y sus comentarios cuentan.
    score: promedio ?? 3,
    comments: abierto,
    evaluation_date: new Date().toISOString().slice(0, 10),
  })
  if (projErr) {
    // La proyección es lo que hace útil la respuesta: sin ella no se puede
    // promediar por dirigente. Si falla, se deshace la respuesta en vez de
    // dejarla colgando.
    await sb.from('form_responses').delete().eq('id', responseId)
    throw projErr
  }
}

/** Guarda la evaluación. El `leader_id` de la tabla apunta a study_leaders, no a
 *  members: se resuelve desde el dirigente del grupo. */
export async function saveLeaderFeedback(input: {
  groupId: string
  memberId: string
  score: number
  comments: string | null
}): Promise<void> {
  const sb = createAdminClient() as unknown as SupabaseClient
  const grupo = await feedbackGroupRef(input.groupId)
  if (!grupo?.leader_id) throw new Error('GRUPO_SIN_DIRIGENTE')

  const { data: sl } = await sb
    .from('study_leaders').select('id').eq('member_id', grupo.leader_id).limit(1).maybeSingle()
  const leaderId = (sl as { id: string } | null)?.id
  if (!leaderId) throw new Error('DIRIGENTE_SIN_FICHA')

  const { error } = await sb.from('leader_evaluations').insert({
    leader_id: leaderId,
    group_id: input.groupId,
    member_id: input.memberId,
    score: input.score,
    comments: input.comments,
    evaluation_date: new Date().toISOString().slice(0, 10),
  })
  // 23505 = el índice único: ya había respondido (carrera con doble clic).
  if (error && (error as { code?: string }).code !== '23505') throw error
}

/** Las respuestas crudas de un grupo, con su estado de moderación. */
export async function groupFeedbackRows(groupId: string): Promise<FeedbackRow[]> {
  const sb = createAdminClient() as unknown as SupabaseClient
  const { data } = await sb
    .from('leader_evaluations')
    .select('id, score, comments, hidden_at, hidden_reason')
    .eq('group_id', groupId)
    .order('created_at')
  return ((data ?? []) as Array<{ id: string; score: number; comments: string | null; hidden_at: string | null }>)
    .map(r => ({ id: r.id, score: r.score, comments: r.comments, hidden: !!r.hidden_at }))
}

/** Promedio POR PREGUNTA de un grupo. Es lo que dice DÓNDE mejorar: un promedio
 *  general de 4.2 no distingue "explica bien" de "no fomenta la participación". */
export async function groupPerQuestion(groupId: string) {
  const sb = createAdminClient() as unknown as SupabaseClient
  const { data: evals } = await sb.from('leader_evaluations')
    .select('response_id').eq('group_id', groupId).not('response_id', 'is', null)
  const ids = ((evals ?? []) as Array<{ response_id: string }>).map(e => e.response_id)
  if (ids.length === 0) return []

  const { data } = await sb.from('form_response_values')
    .select('response_id, value_text, field:form_fields(id, label, field_type, options)')
    .in('response_id', ids)
  const rows = (data ?? []) as unknown as Array<{
    response_id: string; value_text: string | null
    field: { id: string; label: string; field_type: string; options: unknown } | null
  }>
  const porRespuesta = new Map<string, RespuestaCerrada[]>()
  for (const r of rows) {
    if (r.field?.field_type !== 'radio') continue
    const lista = porRespuesta.get(r.response_id) ?? []
    lista.push({
      fieldId: r.field.id,
      label: r.field.label,
      options: Array.isArray(r.field.options) ? (r.field.options as string[]) : [],
      answer: r.value_text,
    })
    porRespuesta.set(r.response_id, lista)
  }
  return perQuestionSummary([...porRespuesta.values()])
}

/** Resumen de UN grupo (para la coordinación: incluye todo). */
export async function groupFeedbackSummary(groupId: string): Promise<FeedbackSummary> {
  return summarize(await groupFeedbackRows(groupId))
}

/** La coordinación comparte la retroalimentación con el dirigente. Idempotente:
 *  compartir dos veces no cambia quién ni cuándo fue la primera. */
export async function releaseGroupFeedback(groupId: string, actorMemberId: string | null): Promise<void> {
  const sb = createAdminClient() as unknown as SupabaseClient
  const { error } = await sb
    .from('study_groups')
    .update({ feedback_released_at: new Date().toISOString(), feedback_released_by: actorMemberId })
    .eq('id', groupId)
    .is('feedback_released_at', null)
  if (error) throw error
}

/** Oculta (o vuelve a mostrar) un comentario. La NOTA sigue contando siempre. */
export async function setFeedbackHidden(input: {
  evaluationId: string
  groupId: string
  hidden: boolean
  reason?: string | null
  actorMemberId: string | null
}): Promise<void> {
  const sb = createAdminClient() as unknown as SupabaseClient
  const { error } = await sb
    .from('leader_evaluations')
    .update(input.hidden
      ? { hidden_at: new Date().toISOString(), hidden_by: input.actorMemberId, hidden_reason: input.reason ?? null }
      : { hidden_at: null, hidden_by: null, hidden_reason: null })
    .eq('id', input.evaluationId)
    .eq('group_id', input.groupId)   // el id solo vale dentro de SU grupo
  if (error) throw error
}

/** Resumen acumulado de un DIRIGENTE (todos sus grupos). Es lo que sirve para
 *  ver una tendencia; una sola cohorte dice poco. */
export async function leaderFeedbackSummary(leaderMemberId: string): Promise<FeedbackSummary> {
  const sb = createAdminClient() as unknown as SupabaseClient
  const { data: sl } = await sb
    .from('study_leaders').select('id').eq('member_id', leaderMemberId).limit(1).maybeSingle()
  const leaderId = (sl as { id: string } | null)?.id
  if (!leaderId) return summarize([])
  const { data } = await sb.from('leader_evaluations').select('score, comments').eq('leader_id', leaderId)
  return summarize((data ?? []) as Array<{ score: number; comments: string | null }>)
}
