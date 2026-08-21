/**
 * DIR-5 · Cola de evaluaciones del dirigente.
 *
 * Un tiquete por GRUPO: lo que la coordinación revisa es el compilado, no una
 * respuesta suelta. El tiquete nace cuando entra la primera evaluación de ese
 * grupo (ver `ensureEvaluationTicket`, que llama el POST de la encuesta) y se
 * cierra cuando la ventana venció y alguien lo dio por bueno.
 *
 * Espejo de finance-requests.ts: mismo REQUEST_SELECT con historial embebido,
 * mismo toDomain, misma escritura de historial best-effort. El RequestBoard
 * espera exactamente esa forma.
 *
 * ANONIMATO: ninguna consulta de acá devuelve una respuesta junto a un nombre.
 * `getEvaluationParticipants` dice QUIÉNES contestaron, y el compilado (en
 * leader-feedback.ts) dice QUÉ se contestó. Las dos cosas nunca viajan
 * cruzadas, y esa separación es el punto.
 */
import { createAdminClient, type Updatable } from '@/lib/supabase/admin'
import { evaluationWindowStatus, evaluationDaysLeft } from '@/lib/studies/evaluation-window'
import type {
  EvaluationTicket, EvaluationTicketStatus, EvaluationParticipant,
} from '@/types/evaluations'

/** Matrículas que contaban para la encuesta. Quien desertó no se le pide nada,
 *  así que tampoco cuenta contra la tasa de respuesta. */
const ENROLLMENT_ACTIVE = ['enrolled', 'completed', 'reprobado']

const TICKET_SELECT = `
  id, group_id, status, reviewed_by, reviewed_at, review_notes,
  sent_at, sent_by, created_at, updated_at,
  reviewer:members!evaluation_tickets_reviewed_by_fkey(first_name, last_name),
  sender:members!evaluation_tickets_sent_by_fkey(first_name, last_name),
  group:study_groups!evaluation_tickets_group_id_fkey(
    id, name, feedback_requested_at, feedback_released_at,
    plan:study_plans!study_groups_plan_id_fkey(name),
    leader:members!study_groups_leader_id_fkey(id, first_name, last_name),
    co_leader:members!study_groups_co_leader_id_fkey(first_name, last_name)
  ),
  history:evaluation_ticket_status_history(
    from_status, to_status, notes, created_at,
    actor:members!evaluation_ticket_status_history_changed_by_fkey(first_name, last_name)
  )
`

type Persona = { id?: string; first_name: string | null; last_name: string | null }

type DbRow = {
  id: string
  group_id: string
  status: EvaluationTicketStatus
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  sent_at: string | null
  sent_by: string | null
  created_at: string
  updated_at: string
  reviewer: Persona | Persona[] | null
  sender: Persona | Persona[] | null
  group: {
    id: string
    name: string | null
    feedback_requested_at: string | null
    feedback_released_at: string | null
    plan: { name: string | null } | { name: string | null }[] | null
    leader: Persona | Persona[] | null
    co_leader: Persona | Persona[] | null
  } | Array<{
    id: string
    name: string | null
    feedback_requested_at: string | null
    feedback_released_at: string | null
    plan: { name: string | null } | { name: string | null }[] | null
    leader: Persona | Persona[] | null
    co_leader: Persona | Persona[] | null
  }> | null
  history: Array<{
    from_status: string | null
    to_status: string
    notes: string | null
    created_at: string
    actor: Persona | Persona[] | null
  }> | null
}

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
}

function fullName(p: Persona | null): string {
  if (!p) return '—'
  return `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || '—'
}

function toDomain(r: DbRow, counts: { responses: number; expected: number }): EvaluationTicket {
  const g = one(r.group)
  const leader = one(g?.leader ?? null)
  const requestedAt = g?.feedback_requested_at ?? null
  return {
    id: r.id,
    member_id: leader?.id ?? '',
    member_name: fullName(leader),
    request_type: 'leader_evaluation',
    reason: null,
    status: r.status,
    review_notes: r.review_notes,
    reviewed_by: r.reviewed_by,
    reviewed_by_name: r.reviewer ? fullName(one(r.reviewer)) : null,
    reviewed_at: r.reviewed_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
    history: (r.history ?? [])
      .map(h => ({
        from_status: h.from_status as EvaluationTicketStatus | null,
        to_status: h.to_status as EvaluationTicketStatus,
        notes: h.notes,
        changed_by_name: h.actor ? fullName(one(h.actor)) : null,
        created_at: h.created_at,
      }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),

    group_id: r.group_id,
    group_name: g?.name ?? null,
    plan_name: one(g?.plan ?? null)?.name ?? null,
    co_leader_name: g?.co_leader ? fullName(one(g.co_leader)) : null,

    responses: counts.responses,
    expected: counts.expected,

    feedback_requested_at: requestedAt,
    window_status: evaluationWindowStatus({ requestedAt }),
    days_left: evaluationDaysLeft(requestedAt),

    released_at: g?.feedback_released_at ?? null,
    sent_at: r.sent_at,
    sent_by_name: r.sender ? fullName(one(r.sender)) : null,
  }
}

/**
 * Conteos de respuestas y de matriculados para varios grupos de una.
 *
 * Dos consultas y no 2×N: la lista completa se arma con esto. Es el mismo
 * problema que se arregló en A16/A17 de la auditoría de julio.
 */
async function countsByGroup(
  supabase: ReturnType<typeof createAdminClient>,
  groupIds: string[],
): Promise<Map<string, { responses: number; expected: number }>> {
  const out = new Map<string, { responses: number; expected: number }>()
  for (const id of groupIds) out.set(id, { responses: 0, expected: 0 })
  if (groupIds.length === 0) return out

  const { data: evals } = await supabase
    .from('leader_evaluations').select('group_id').in('group_id', groupIds)
  for (const e of (evals ?? []) as Array<{ group_id: string | null }>) {
    if (!e.group_id) continue
    const c = out.get(e.group_id)
    if (c) c.responses++
  }

  const { data: enrolls } = await supabase
    .from('study_enrollments').select('group_id')
    .in('group_id', groupIds).in('status', ENROLLMENT_ACTIVE)
  for (const e of (enrolls ?? []) as Array<{ group_id: string | null }>) {
    if (!e.group_id) continue
    const c = out.get(e.group_id)
    if (c) c.expected++
  }

  return out
}

export async function getEvaluationTickets(filters?: {
  status?: EvaluationTicketStatus
}): Promise<EvaluationTicket[]> {
  const supabase = createAdminClient()
  let q = supabase.from('evaluation_tickets').select(TICKET_SELECT)
  if (filters?.status) q = q.eq('status', filters.status)
  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) throw error

  const rows = (data ?? []) as unknown as DbRow[]
  const counts = await countsByGroup(supabase, rows.map(r => r.group_id))
  return rows.map(r => toDomain(r, counts.get(r.group_id) ?? { responses: 0, expected: 0 }))
}

export async function getEvaluationTicket(id: string): Promise<EvaluationTicket | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('evaluation_tickets').select(TICKET_SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as unknown as DbRow
  const counts = await countsByGroup(supabase, [row.group_id])
  return toDomain(row, counts.get(row.group_id) ?? { responses: 0, expected: 0 })
}

/**
 * Abre el tiquete del grupo si todavía no existe.
 *
 * Idempotente por el UNIQUE de group_id: se puede llamar en cada respuesta que
 * entra sin preguntar antes. Best-effort — que falle no puede tumbar el envío
 * de la encuesta del estudiante, que es lo importante en ese momento.
 */
export async function ensureEvaluationTicket(groupId: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('evaluation_tickets')
    .upsert({ group_id: groupId }, { onConflict: 'group_id', ignoreDuplicates: true })
  if (error) console.warn('ensureEvaluationTicket:', error.message)
}

/** Quiénes contestaron y quiénes no. Sin respuestas: ver la nota del encabezado. */
export async function getEvaluationParticipants(groupId: string): Promise<EvaluationParticipant[]> {
  const supabase = createAdminClient()

  const { data: enrolls, error } = await supabase
    .from('study_enrollments')
    .select('member_id, member:members!study_enrollments_member_id_fkey(first_name, last_name)')
    .eq('group_id', groupId)
    .in('status', ENROLLMENT_ACTIVE)
  if (error) throw error

  const { data: evals } = await supabase
    .from('leader_evaluations').select('member_id').eq('group_id', groupId)
  const respondieron = new Set(
    ((evals ?? []) as Array<{ member_id: string | null }>)
      .map(e => e.member_id).filter((v): v is string => !!v),
  )

  return ((enrolls ?? []) as unknown as Array<{ member_id: string; member: Persona | Persona[] | null }>)
    .map(e => ({
      member_id: e.member_id,
      member_name: fullName(one(e.member)),
      responded: respondieron.has(e.member_id),
    }))
    .sort((a, b) => {
      // Primero los que faltan: son sobre los que hay algo que hacer.
      if (a.responded !== b.responded) return a.responded ? 1 : -1
      return a.member_name.localeCompare(b.member_name, 'es')
    })
}

export async function updateEvaluationTicketStatus(
  id: string,
  status: EvaluationTicketStatus,
  changedBy: string,
  reviewNotes?: string | null,
): Promise<EvaluationTicket> {
  const supabase = createAdminClient()

  const { data: before } = await supabase
    .from('evaluation_tickets').select('status').eq('id', id).maybeSingle()
  const fromStatus = (before as { status: EvaluationTicketStatus } | null)?.status ?? null

  const patch: Record<string, unknown> = {
    status, reviewed_by: changedBy, updated_at: new Date().toISOString(),
  }
  if (status === 'resolved' || status === 'rejected') {
    patch.reviewed_at = new Date().toISOString()
    patch.review_notes = reviewNotes ?? null
  }

  const { error } = await supabase
    .from('evaluation_tickets')
    .update(patch as Updatable<'evaluation_tickets'>)
    .eq('id', id)
  if (error) throw error

  const { error: hErr } = await supabase.from('evaluation_ticket_status_history').insert({
    ticket_id: id, from_status: fromStatus, to_status: status,
    changed_by: changedBy, notes: reviewNotes ?? null,
  })
  if (hErr) console.warn('updateEvaluationTicketStatus: historial falló:', hErr.message)

  const result = await getEvaluationTicket(id)
  if (!result) throw new Error('El tiquete desapareció al actualizarlo')
  return result
}

/** Asigna el tiquete a alguien del comité: pasa a in_review a su nombre. */
export async function assignEvaluationTicket(
  id: string,
  assigneeMemberId: string,
  assignedBy: string,
): Promise<EvaluationTicket> {
  const supabase = createAdminClient()
  const { data: before } = await supabase
    .from('evaluation_tickets').select('status').eq('id', id).maybeSingle()
  const fromStatus = (before as { status: EvaluationTicketStatus } | null)?.status ?? null

  const { error } = await supabase
    .from('evaluation_tickets')
    .update({
      status: 'in_review', reviewed_by: assigneeMemberId,
      updated_at: new Date().toISOString(),
    } as Updatable<'evaluation_tickets'>)
    .eq('id', id)
  if (error) throw error

  await supabase.from('evaluation_ticket_status_history').insert({
    ticket_id: id, from_status: fromStatus, to_status: 'in_review',
    changed_by: assignedBy, notes: 'Asignado',
  })

  const result = await getEvaluationTicket(id)
  if (!result) throw new Error('El tiquete desapareció al asignarlo')
  return result
}

/** A quién se le puede asignar un tiquete: los mismos roles que entran a la
 *  cola, y solo miembros activos. */
export async function getAssignableEvaluationMembers(): Promise<
  Array<{ member_id: string; member_name: string }>
> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('member_roles')
    .select('member_id, member:members!member_roles_member_id_fkey(first_name, last_name, is_active)')
    .in('role', ['evaluaciones', 'coordinador_dirigentes', 'admin'])
    .eq('is_active', true)
  if (error) throw error

  const vistos = new Set<string>()
  const out: Array<{ member_id: string; member_name: string }> = []
  for (const r of (data ?? []) as unknown as Array<{
    member_id: string
    member: (Persona & { is_active: boolean }) | Array<Persona & { is_active: boolean }> | null
  }>) {
    const m = one(r.member)
    if (!m?.is_active || vistos.has(r.member_id)) continue
    vistos.add(r.member_id)
    out.push({ member_id: r.member_id, member_name: fullName(m) })
  }
  return out.sort((a, b) => a.member_name.localeCompare(b.member_name, 'es'))
}

/** Sella el envío del resumen al dirigente. Se re-sella en cada envío: acá
 *  interesa el último, no el primero. */
export async function markEvaluationTicketSent(groupId: string, sentBy: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('evaluation_tickets')
    .update({ sent_at: new Date().toISOString(), sent_by: sentBy } as Updatable<'evaluation_tickets'>)
    .eq('group_id', groupId)
  if (error) console.warn('markEvaluationTicketSent:', error.message)
}
