/**
 * Solicitudes de estudios + destinatarios de notificaciones + notificaciones
 * internas. SQL en supabase/migrations/041_study_requests.sql y el historial
 * de estados en 047_request_status_history.sql (correr con
 * `npx supabase db push` o en el SQL Editor):
 *
 *   CREATE TABLE study_request_status_history (
 *     id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     request_id  UUID NOT NULL REFERENCES study_requests(id) ON DELETE CASCADE,
 *     from_status TEXT,
 *     to_status   TEXT NOT NULL,
 *     changed_by  UUID REFERENCES members(id) ON DELETE SET NULL,
 *     notes       TEXT,
 *     created_at  TIMESTAMPTZ DEFAULT NOW()
 *   );
 *
 * Como el resto de queries, corre server-side con service role; la
 * autorización vive en requireRoles() de cada ruta API.
 */
import { createAdminClient, type Insertable, type Updatable } from '@/lib/supabase/admin'
import type {
  StudyRequest, StudyRequestWriteInput, StudyRequestStatus, StudyRequestType,
  NotificationRecipient,
} from '@/types/study'
import type { InternalNotification, InternalNotificationType } from '@/types/notification'

// ── Solicitudes ──────────────────────────────────────────────────────────────

const REQUEST_SELECT = `
  id, member_id, request_type, plan_id, existing_group_id, current_group_id,
  proposed_location, proposed_schedule, reason, status,
  reviewed_by, reviewed_at, review_notes, created_at, updated_at,
  member:members!study_requests_member_id_fkey(first_name, last_name),
  reviewer:members!study_requests_reviewed_by_fkey(first_name, last_name),
  plan:study_plans(name),
  existing_group:study_groups!study_requests_existing_group_id_fkey(name),
  current_group:study_groups!study_requests_current_group_id_fkey(name),
  history:study_request_status_history(from_status, to_status, notes, created_at, actor:members(first_name, last_name))
`

type DbRequestRow = {
  id: string
  member_id: string
  request_type: StudyRequestType
  plan_id: string | null
  existing_group_id: string | null
  current_group_id: string | null
  proposed_location: string | null
  proposed_schedule: string | null
  reason: string
  status: StudyRequestStatus
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  created_at: string
  updated_at: string
  member: { first_name: string | null; last_name: string | null } | null
  reviewer: { first_name: string | null; last_name: string | null } | null
  plan: { name: string | null } | null
  existing_group: { name: string | null } | null
  current_group: { name: string | null } | null
  history: Array<{
    from_status: string | null
    to_status: string
    notes: string | null
    created_at: string
    actor: { first_name: string | null; last_name: string | null } | null
  }> | null
}

function fullName(p: { first_name: string | null; last_name: string | null } | null): string {
  return [p?.first_name, p?.last_name].filter(Boolean).join(' ') || '—'
}

function toDomain(r: DbRequestRow): StudyRequest {
  return {
    id: r.id,
    member_id: r.member_id,
    member_name: fullName(r.member),
    request_type: r.request_type,
    plan_id: r.plan_id,
    plan_name: r.plan?.name ?? null,
    existing_group_id: r.existing_group_id,
    existing_group_name: r.existing_group?.name ?? null,
    current_group_id: r.current_group_id,
    current_group_name: r.current_group?.name ?? null,
    proposed_location: r.proposed_location,
    proposed_schedule: r.proposed_schedule,
    reason: r.reason,
    status: r.status,
    reviewed_by: r.reviewed_by,
    reviewed_by_name: r.reviewer ? fullName(r.reviewer) : null,
    reviewed_at: r.reviewed_at,
    review_notes: r.review_notes,
    created_at: r.created_at,
    updated_at: r.updated_at,
    history: (r.history ?? [])
      .map(h => ({
        from_status: h.from_status as StudyRequestStatus | null,
        to_status: h.to_status as StudyRequestStatus,
        notes: h.notes,
        changed_by_name: h.actor ? fullName(h.actor) : null,
        created_at: h.created_at,
      }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
  }
}

export async function getStudyRequests(filters?: {
  status?: StudyRequestStatus
  type?: StudyRequestType
  member_id?: string
}): Promise<StudyRequest[]> {
  const supabase = createAdminClient()
  let q = supabase
    .from('study_requests')
    .select(REQUEST_SELECT)
    .order('created_at', { ascending: false })
    .limit(500)
  if (filters?.status) q = q.eq('status', filters.status)
  if (filters?.type) q = q.eq('request_type', filters.type)
  if (filters?.member_id) q = q.eq('member_id', filters.member_id)
  const { data, error } = await q
  if (error) throw error
  return ((data ?? []) as DbRequestRow[]).map(toDomain)
}

export async function countOpenStudyRequests(): Promise<number> {
  const supabase = createAdminClient()
  const { count, error } = await supabase
    .from('study_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open')
  if (error) throw error
  return count ?? 0
}

export async function createStudyRequest(input: StudyRequestWriteInput): Promise<StudyRequest> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('study_requests')
    .insert({
      member_id: input.member_id,
      request_type: input.request_type,
      plan_id: input.plan_id ?? null,
      existing_group_id: input.existing_group_id ?? null,
      current_group_id: input.current_group_id ?? null,
      proposed_location: input.proposed_location ?? null,
      proposed_schedule: input.proposed_schedule ?? null,
      reason: input.reason,
    })
    .select(REQUEST_SELECT)
    .single()
  if (error) throw error
  return toDomain(data as DbRequestRow)
}

export async function updateStudyRequestStatus(
  id: string,
  status: StudyRequestStatus,
  reviewedBy: string,
  reviewNotes?: string | null,
): Promise<StudyRequest> {
  const supabase = createAdminClient()

  // Estado anterior, para el historial.
  const { data: before } = await supabase
    .from('study_requests').select('status').eq('id', id).maybeSingle()
  const fromStatus = (before as { status: StudyRequestStatus } | null)?.status ?? null

  const patch: Record<string, unknown> = {
    status,
    reviewed_by: reviewedBy,
    updated_at: new Date().toISOString(),
  }
  // "Tomar" (in_review) no es resolución: marca quién la tiene, sin sellar fecha.
  if (status === 'resolved' || status === 'rejected') {
    patch.reviewed_at = new Date().toISOString()
    patch.review_notes = reviewNotes ?? null
  }
  const { data, error } = await supabase
    .from('study_requests')
    .update(patch as Updatable<'study_requests'>)
    .eq('id', id)
    .select(REQUEST_SELECT)
    .single()
  if (error) throw error

  // Historial de cambios (best-effort: no bloquea la acción si falla).
  const { error: hErr } = await supabase.from('study_request_status_history').insert({
    request_id: id,
    from_status: fromStatus,
    to_status: status,
    changed_by: reviewedBy,
    notes: reviewNotes ?? null,
  })
  if (hErr) console.warn('updateStudyRequestStatus: historial falló:', hErr.message)

  const result = toDomain(data as DbRequestRow)
  // El select corrió antes del insert del historial: reflejarlo en la respuesta.
  result.history = [...result.history, {
    from_status: fromStatus,
    to_status: status,
    notes: reviewNotes ?? null,
    changed_by_name: result.reviewed_by_name,
    created_at: new Date().toISOString(),
  }]
  return result
}

const TYPE_LABEL_NOTIF: Record<StudyRequestType, string> = {
  relocation: 'reubicación',
  study_interest: 'interés en estudio',
}

/** Asigna la solicitud a un coordinador de dirigentes: pasa a in_review con
 *  reviewed_by = el ASIGNADO (no quien asigna); el historial registra quién
 *  asignó, y el asignado recibe una notificación interna. */
export async function assignStudyRequest(
  id: string,
  assigneeMemberId: string,
  assignedByMemberId: string,
): Promise<StudyRequest> {
  const supabase = createAdminClient()

  // El asignado debe tener rol coordinador_dirigentes activo.
  const { data: roleRow, error: roleErr } = await supabase
    .from('member_roles')
    .select('member_id, member:members!member_roles_member_id_fkey(first_name, last_name)')
    .eq('member_id', assigneeMemberId)
    .eq('role', 'coordinador_dirigentes')
    .eq('is_active', true)
    .maybeSingle()
  if (roleErr) throw roleErr
  if (!roleRow) throw new Error('La persona asignada no tiene rol activo de coordinador de dirigentes')
  const assigneeName = fullName((roleRow as { member: { first_name: string | null; last_name: string | null } | null }).member)

  // Estado anterior, para el historial.
  const { data: before } = await supabase
    .from('study_requests').select('status').eq('id', id).maybeSingle()
  const fromStatus = (before as { status: StudyRequestStatus } | null)?.status ?? null

  const { data, error } = await supabase
    .from('study_requests')
    .update({ status: 'in_review', reviewed_by: assigneeMemberId, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(REQUEST_SELECT)
    .single()
  if (error) throw error

  // Historial (best-effort): "Abierta → En revisión · por [asignador] — Asignada a [nombre]".
  const { error: hErr } = await supabase.from('study_request_status_history').insert({
    request_id: id,
    from_status: fromStatus,
    to_status: 'in_review',
    changed_by: assignedByMemberId,
    notes: `Asignada a ${assigneeName}`,
  })
  if (hErr) console.warn('assignStudyRequest: historial falló:', hErr.message)

  const result = toDomain(data as DbRequestRow)

  // Notificación interna al coordinador asignado (best-effort).
  const { error: nErr } = await supabase.from('internal_notifications').insert({
    recipient_member_id: assigneeMemberId,
    type: 'study_request_assigned',
    title: 'Te asignaron una solicitud',
    body: `Te asignaron una solicitud de ${TYPE_LABEL_NOTIF[result.request_type]} de ${result.member_name}`,
    link: `/estudios/solicitudes?request=${result.id}`,
  })
  if (nErr) console.warn('assignStudyRequest: notificación falló:', nErr.message)

  // El select corrió antes del insert del historial: reflejarlo en la respuesta.
  result.history = [...result.history, {
    from_status: fromStatus,
    to_status: 'in_review',
    notes: `Asignada a ${assigneeName}`,
    changed_by_name: null,
    created_at: new Date().toISOString(),
  }]
  return result
}

// ── Destinatarios de notificaciones ─────────────────────────────────────────

export async function getNotificationRecipients(): Promise<NotificationRecipient[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('study_notification_recipients')
    .select('id, member_id, created_at, member:members(first_name, last_name)')
    .order('created_at')
  if (error) throw error
  return ((data ?? []) as Array<{
    id: string; member_id: string; created_at: string
    member: { first_name: string | null; last_name: string | null } | null
  }>).map(r => ({
    id: r.id,
    member_id: r.member_id,
    member_name: fullName(r.member),
    created_at: r.created_at,
  }))
}

export async function addNotificationRecipient(memberId: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('study_notification_recipients')
    .upsert({ member_id: memberId }, { onConflict: 'member_id' })
  if (error) throw error
}

export async function removeNotificationRecipient(memberId: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('study_notification_recipients')
    .delete()
    .eq('member_id', memberId)
  if (error) throw error
}

/** Miembros elegibles como destinatarios: con rol activo de coordinación/admin. */
export async function getEligibleCoordinators(): Promise<Array<{ member_id: string; member_name: string; roles: string[] }>> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('member_roles')
    .select('member_id, role, member:members!member_roles_member_id_fkey(first_name, last_name, is_active)')
    .in('role', ['admin', 'coordinador_estudios', 'coordinador_dirigentes'])
    .eq('is_active', true)
  if (error) throw error
  const byMember = new Map<string, { member_id: string; member_name: string; roles: string[] }>()
  for (const r of (data ?? []) as Array<{
    member_id: string; role: string
    member: { first_name: string | null; last_name: string | null; is_active: boolean } | null
  }>) {
    if (!r.member?.is_active) continue
    const cur = byMember.get(r.member_id)
    if (cur) cur.roles.push(r.role)
    else byMember.set(r.member_id, { member_id: r.member_id, member_name: fullName(r.member), roles: [r.role] })
  }
  return Array.from(byMember.values()).sort((a, b) => a.member_name.localeCompare(b.member_name))
}

// ── Notificaciones internas ──────────────────────────────────────────────────

const NOTIF_META: Record<StudyRequestType, { type: InternalNotificationType; title: string }> = {
  relocation: { type: 'study_relocation_request', title: 'Nueva solicitud de reubicación' },
  study_interest: { type: 'study_interest_request', title: 'Nuevo interés en estudio' },
}

/** Crea una notificación por cada destinatario. Decisión 2026-06-11: las
 *  solicitudes notifican a TODOS los coordinadores de estudios activos, además
 *  de la lista configurable (study_notification_recipients). Best-effort. */
export async function notifyRecipientsOfRequest(req: StudyRequest): Promise<void> {
  const supabase = createAdminClient()
  const configured = await getNotificationRecipients()

  const { data: coordRows, error: cErr } = await supabase
    .from('member_roles')
    .select('member_id, member:members!member_roles_member_id_fkey(is_active)')
    .eq('role', 'coordinador_estudios')
    .eq('is_active', true)
  if (cErr) console.warn('notifyRecipientsOfRequest (coordinadores):', cErr.message)
  const coordinators = ((coordRows ?? []) as Array<{
    member_id: string; member: { is_active: boolean } | null
  }>).filter(r => r.member?.is_active).map(r => r.member_id)

  const memberIds = Array.from(new Set([...configured.map(r => r.member_id), ...coordinators]))
  if (memberIds.length === 0) return
  const meta = NOTIF_META[req.request_type]
  const rows = memberIds.map(memberId => ({
    recipient_member_id: memberId,
    type: meta.type,
    title: meta.title,
    body: `${req.member_name} envió una solicitud. Motivo: ${req.reason.slice(0, 140)}`,
    link: `/estudios/solicitudes?request=${req.id}`,
  }))
  const { error } = await supabase.from('internal_notifications').insert(rows)
  if (error) console.warn('notifyRecipientsOfRequest:', error.message)
}

export async function getInternalNotifications(memberId: string): Promise<InternalNotification[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('internal_notifications')
    .select('*')
    .eq('recipient_member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as InternalNotification[]
}

/** Marca como leída, verificando que pertenece al miembro. */
export async function markNotificationRead(id: string, memberId: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('internal_notifications')
    .update({ read: true })
    .eq('id', id)
    .eq('recipient_member_id', memberId)
  if (error) throw error
}

/** Marca un conjunto de notificaciones (por id) del miembro como leídas. */
export async function markNotificationsRead(ids: string[], memberId: string): Promise<void> {
  if (ids.length === 0) return
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('internal_notifications')
    .update({ read: true })
    .in('id', ids)
    .eq('recipient_member_id', memberId)
  if (error) throw error
}

/** Marca TODAS las notificaciones no leídas del miembro como leídas. */
export async function markAllNotificationsRead(memberId: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('internal_notifications')
    .update({ read: true })
    .eq('recipient_member_id', memberId)
    .eq('read', false)
  if (error) throw error
}

// ── Alerta: dirigente inasistente ────────────────────────────────────────────

const ABSENCE_WEEKS = 4

/** Dirigentes con grupo activo (en_matricula/en_curso) y más de ABSENCE_WEEKS
 *  semanas sin check-in de charla → notificación interna a los coordinadores
 *  de dirigentes. Anti-duplicado: máximo una notificación por dirigente por
 *  semana (se identifica por el link, que lleva el member_id del dirigente).
 *  Pensada para correrse a diario desde la edge function process-email-queue. */
export async function notifyAbsentLeaders(): Promise<{ checked: number; notified: number }> {
  const supabase = createAdminClient()

  // 1. Dirigentes y co-dirigentes de grupos activos.
  const { data: groups, error: gErr } = await supabase
    .from('study_groups')
    .select('leader_id, co_leader_id')
    .in('status', ['en_matricula', 'en_curso'])
  if (gErr) throw gErr
  const leaderIds = Array.from(new Set(
    (groups ?? []).flatMap(g => [g.leader_id, g.co_leader_id]).filter(Boolean) as string[],
  ))
  if (leaderIds.length === 0) return { checked: 0, notified: 0 }

  // 2. Último check-in de CHARLA de cada dirigente en la ventana.
  const cutoff = new Date(Date.now() - ABSENCE_WEEKS * 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recent, error: cErr } = await supabase
    .from('event_checkins')
    .select('member_id, events!inner(event_type)')
    .in('member_id', leaderIds)
    .eq('events.event_type', 'charla')
    .gte('checked_in_at', cutoff)
  if (cErr) throw cErr
  const activeSet = new Set((recent ?? []).map(r => (r as { member_id: string }).member_id))
  const absentIds = leaderIds.filter(id => !activeSet.has(id))
  if (absentIds.length === 0) return { checked: leaderIds.length, notified: 0 }

  // 3. Destinatarios: coordinadores de dirigentes con rol activo.
  const { data: coordRoles, error: rErr } = await supabase
    .from('member_roles')
    .select('member_id')
    .eq('role', 'coordinador_dirigentes')
    .eq('is_active', true)
  if (rErr) throw rErr
  const recipientIds = Array.from(new Set((coordRoles ?? []).map(r => r.member_id as string)))
  if (recipientIds.length === 0) return { checked: leaderIds.length, notified: 0 }

  // 4. Anti-duplicado: notificaciones de este tipo en los últimos 7 días.
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recentNotifs, error: nErr } = await supabase
    .from('internal_notifications')
    .select('link')
    .eq('type', 'leader_absent_alert')
    .gte('created_at', weekAgo)
  if (nErr) throw nErr
  const alreadyNotified = new Set((recentNotifs ?? []).map(n => n.link as string | null))

  // 5. Nombres de los dirigentes ausentes.
  const { data: memberRows, error: mErr } = await supabase
    .from('members')
    .select('id, first_name, last_name')
    .in('id', absentIds)
  if (mErr) throw mErr
  const nameOf = new Map((memberRows ?? []).map(m => [
    m.id as string,
    [m.first_name, m.last_name].filter(Boolean).join(' '),
  ]))

  const rows = absentIds
    .map(id => ({ id, link: `/estudios/dirigentes?dirigente=${id}` }))
    .filter(({ link }) => !alreadyNotified.has(link))
    .flatMap(({ id, link }) => recipientIds.map(recipientId => ({
      recipient_member_id: recipientId,
      type: 'leader_absent_alert',
      title: 'Dirigente sin asistencia a charlas',
      body: `${nameOf.get(id) ?? 'Un dirigente'} tiene un grupo activo y lleva más de ${ABSENCE_WEEKS} semanas sin asistir a charla`,
      link,
    })))
  if (rows.length === 0) return { checked: leaderIds.length, notified: 0 }

  const { error: insErr } = await supabase.from('internal_notifications').insert(rows)
  if (insErr) throw insErr
  return { checked: leaderIds.length, notified: rows.length }
}
