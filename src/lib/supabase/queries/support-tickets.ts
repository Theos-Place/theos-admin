/**
 * SOP-1 · Tiquetes de soporte: lectura y escritura.
 *
 * Mismo molde que `evaluation-tickets.ts`: la fila se convierte a la forma
 * que `RequestBoard` ya sabe pintar (BaseRequest + history), así la página
 * de soporte es el tablero de siempre y no una lista nueva que haya que
 * mantener aparte.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { EstadoDeTiquete } from '@/lib/support/tiquete'
import { TIPO_DE_TIQUETE } from '@/lib/support/tiquete'

// Tablas nuevas que database.ts todavía no conoce.
const sinTipos = (): SupabaseClient => createAdminClient() as unknown as SupabaseClient

type Persona = { first_name: string | null; last_name: string | null }

type DbRow = {
  id: string
  created_by: string
  member_id: string | null
  event_id: string | null
  details: string
  status: EstadoDeTiquete
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  created_at: string
  updated_at: string
  author: Persona | Persona[] | null
  subject: Persona | Persona[] | null
  reviewer: Persona | Persona[] | null
  event: { title: string | null } | { title: string | null }[] | null
  history: Array<{
    from_status: string | null
    to_status: string
    notes: string | null
    created_at: string
    actor: Persona | Persona[] | null
  }> | null
}

const SELECT = `
  id, created_by, member_id, event_id, details, status,
  reviewed_by, reviewed_at, review_notes, created_at, updated_at,
  author:members!support_tickets_created_by_fkey(first_name, last_name),
  subject:members!support_tickets_member_id_fkey(first_name, last_name),
  reviewer:members!support_tickets_reviewed_by_fkey(first_name, last_name),
  event:events!support_tickets_event_id_fkey(title),
  history:support_ticket_status_history(
    from_status, to_status, notes, created_at,
    actor:members!support_ticket_status_history_changed_by_fkey(first_name, last_name)
  )
`

/** La forma que consume la página (es un BaseRequest de RequestBoard + lo propio). */
export type SupportTicket = {
  id: string
  /** Para RequestBoard: el «miembro» de la solicitud es quien la LEVANTÓ. */
  member_id: string
  member_name: string
  request_type: string
  reason: string | null
  status: EstadoDeTiquete
  review_notes: string | null
  reviewed_by: string | null
  reviewed_by_name: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  history: Array<{
    from_status: string | null
    to_status: string
    notes: string | null
    changed_by_name: string | null
    created_at: string
  }>
  // Lo propio del tiquete
  details: string
  subject_member_id: string | null
  subject_name: string | null
  event_id: string | null
  event_name: string | null
}

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
}
function fullName(p: Persona | null): string {
  if (!p) return '—'
  return `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || '—'
}

function toDomain(r: DbRow): SupportTicket {
  return {
    id: r.id,
    member_id: r.created_by,
    member_name: fullName(one(r.author)),
    request_type: TIPO_DE_TIQUETE,
    // El texto va en `details` y lo pinta la página; si también fuera
    // `reason`, RequestBoard lo mostraría dos veces (visto en staging).
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
        from_status: h.from_status,
        to_status: h.to_status,
        notes: h.notes,
        changed_by_name: h.actor ? fullName(one(h.actor)) : null,
        created_at: h.created_at,
      }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    details: r.details,
    subject_member_id: r.member_id,
    subject_name: r.subject ? fullName(one(r.subject)) : null,
    event_id: r.event_id,
    event_name: one(r.event)?.title ?? null,
  }
}

export async function listSupportTickets(): Promise<SupportTicket[]> {
  const { data, error } = await sinTipos()
    .from('support_tickets').select(SELECT).order('created_at', { ascending: false }).limit(500)
  if (error) throw error
  return ((data ?? []) as unknown as DbRow[]).map(toDomain)
}

export async function getSupportTicket(id: string): Promise<SupportTicket | null> {
  const { data, error } = await sinTipos()
    .from('support_tickets').select(SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toDomain(data as unknown as DbRow) : null
}

export async function createSupportTicket(input: {
  createdBy: string
  details: string
  memberId?: string | null
  eventId?: string | null
}): Promise<SupportTicket> {
  const sb = sinTipos()
  const { data, error } = await sb
    .from('support_tickets')
    .insert({
      created_by: input.createdBy,
      details: input.details.trim(),
      member_id: input.memberId ?? null,
      event_id: input.eventId ?? null,
    })
    .select('id')
    .single()
  if (error) throw error
  const id = (data as { id: string }).id
  // La primera fila del historial: «abierto por». Así el tablero muestra
  // quién lo levantó sin mirar otra columna.
  await sb.from('support_ticket_status_history').insert({
    ticket_id: id, from_status: null, to_status: 'open', changed_by: input.createdBy, notes: null,
  })
  const creado = await getSupportTicket(id)
  if (!creado) throw new Error('El tiquete desapareció al crearlo')
  return creado
}

export async function updateSupportTicketStatus(
  id: string,
  status: EstadoDeTiquete,
  changedBy: string,
  reviewNotes?: string | null,
): Promise<SupportTicket> {
  const sb = sinTipos()
  const { data: before } = await sb.from('support_tickets').select('status').eq('id', id).maybeSingle()
  const fromStatus = (before as { status: EstadoDeTiquete } | null)?.status ?? null

  const patch: Record<string, unknown> = {
    status, reviewed_by: changedBy, updated_at: new Date().toISOString(),
  }
  if (status === 'resolved' || status === 'rejected') {
    patch.reviewed_at = new Date().toISOString()
    patch.review_notes = reviewNotes ?? null
  }
  const { error } = await sb.from('support_tickets').update(patch).eq('id', id)
  if (error) throw error

  const { error: hErr } = await sb.from('support_ticket_status_history').insert({
    ticket_id: id, from_status: fromStatus, to_status: status, changed_by: changedBy, notes: reviewNotes ?? null,
  })
  if (hErr) console.warn('updateSupportTicketStatus: historial falló:', hErr.message)

  const result = await getSupportTicket(id)
  if (!result) throw new Error('El tiquete desapareció al actualizarlo')
  return result
}

// ── SOP-3 · Aviso interno al nacer un tiquete ───────────────────────────────

/**
 * Una notificación interna (campana) por cada admin y soporte técnico activo,
 * salvo quien lo levantó. Best-effort: si falla, el tiquete ya existe y la
 * cola lo muestra igual; perder el tiquete por el aviso sería peor.
 */
export async function notificarNuevoTiquete(ticket: SupportTicket): Promise<void> {
  const { destinatariosDeTiquete, notificacionDeTiquete } = await import('@/lib/support/notificacion-de-tiquete')
  const { SOPORTE_ROLES } = await import('@/lib/support/tiquete')
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('member_roles')
    .select('member_id, role, is_active, member:members!member_roles_member_id_fkey(is_active)')
    .in('role', SOPORTE_ROLES as unknown as string[])
    .eq('is_active', true)
  if (error) { console.warn('notificarNuevoTiquete:', error.message); return }
  const filas = ((data ?? []) as Array<{
    member_id: string; role: string; is_active: boolean; member: { is_active: boolean } | { is_active: boolean }[] | null
  }>).map(r => ({
    member_id: r.member_id,
    role: r.role,
    role_active: r.is_active !== false,
    member_active: one(r.member)?.is_active === true,
  }))
  const ids = destinatariosDeTiquete(filas, { excludeMemberId: ticket.member_id })
  if (ids.length === 0) return
  // El texto del tiquete vive en `details` (`reason` es el campo genérico del tablero y va vacío).
  const aviso = notificacionDeTiquete({ member_name: ticket.member_name, reason: ticket.details, event_title: ticket.event_name })
  const { error: eIns } = await sb.from('internal_notifications')
    .insert(ids.map(recipient_member_id => ({ recipient_member_id, ...aviso })))
  if (eIns) console.warn('notificarNuevoTiquete:', eIns.message)
}
