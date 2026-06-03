import { createAdminClient } from '@/lib/supabase/admin'
import type { EventType, EventStatus, EventPaymentStatus, AttendanceType } from '@/types/event'

// NOTA: usamos createAdminClient (service role key) porque la app todavía
// corre con mock auth — sin JWT de Supabase, RLS bloquearía todas las reads.
// Cuando migremos a Supabase Auth real, cambiar a createClient de server.ts.

// ── Tipos ──────────────────────────────────────────────────

/** Fila cruda de `events` + relaciones, tal como las devuelve Supabase.
 *  Convertir a `MockEvent` con `toDomainEvent()` en `@/lib/events/adapter`. */
export type DbEventEnriched = {
  id: string
  title: string
  description: string | null
  event_type: string
  location: string | null
  location_url: string | null
  starts_at: string
  ends_at: string | null
  is_recurring: boolean
  recurrence_rule: string | null
  recurrence_end: string | null
  parent_event_id: string | null
  max_capacity: number | null
  flyer_url: string | null
  committee_id: string | null
  is_virtual: boolean
  requires_registration: boolean
  requires_payment: boolean
  payment_amount: number | null
  requires_survey: boolean
  status: EventStatus
  cancellation_reason: string | null
  created_at: string
  updated_at: string
  sub_events: Array<{ id: string; name: string; max_capacity: number }>
  registrations: Array<{
    member_id: string
    payment_status: EventPaymentStatus
    registered_at: string
    member: { first_name: string; last_name: string } | null
  }>
  checkins: Array<{
    member_id: string | null
    sub_event_id: string | null
    checked_in_at: string
    member: { first_name: string; last_name: string } | null
    is_volunteer: boolean
  }>
  volunteers: Array<{
    member_id: string
    role: string | null
    status: 'confirmed' | 'pending' | 'cancelled'
    member: { first_name: string; last_name: string } | null
  }>
}

export type EventFilters = {
  search?: string
  event_type?: EventType
  status?: EventStatus
  is_active?: boolean
  page?: number
  pageSize?: number
}

const SELECT = `
  *,
  sub_events(id, name, max_capacity),
  registrations:event_registrations(
    member_id,
    payment_status,
    registered_at,
    member:members(first_name, last_name)
  ),
  checkins:event_checkins(
    member_id,
    sub_event_id,
    checked_in_at,
    member:members(first_name, last_name)
  ),
  volunteers:event_volunteers(
    member_id,
    role,
    status,
    member:members(first_name, last_name)
  )
`

/** Normaliza una fila cruda de Supabase a `DbEventEnriched`, marcando qué
 *  checkins corresponden a voluntarios del mismo evento (no hay FK directa). */
function normalize(row: Record<string, unknown>): DbEventEnriched {
  const volunteers = (row.volunteers ?? []) as DbEventEnriched['volunteers']
  const volunteerIds = new Set(volunteers.map((v) => v.member_id))

  const checkins = ((row.checkins ?? []) as Array<Record<string, unknown>>).map((c) => ({
    member_id: (c.member_id as string) ?? null,
    sub_event_id: (c.sub_event_id as string) ?? null,
    checked_in_at: c.checked_in_at as string,
    member: (c.member as { first_name: string; last_name: string } | null) ?? null,
    is_volunteer: c.member_id ? volunteerIds.has(c.member_id as string) : false,
  }))

  return {
    ...(row as unknown as DbEventEnriched),
    sub_events: (row.sub_events ?? []) as DbEventEnriched['sub_events'],
    registrations: (row.registrations ?? []) as DbEventEnriched['registrations'],
    volunteers,
    checkins,
  }
}

// ── Queries ────────────────────────────────────────────────

/** Lista de eventos con sus relaciones (sub-eventos, inscripciones, checkins, voluntarios). */
export async function getEvents(filters: EventFilters = {}): Promise<{ events: DbEventEnriched[]; total: number }> {
  const supabase = createAdminClient()
  const {
    search,
    event_type,
    status,
    is_active = true,
    page = 1,
    pageSize = 100,
  } = filters

  let query = supabase
    .from('events')
    .select(SELECT, { count: 'exact' })
    .eq('is_active', is_active)
    .order('starts_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (search) query = query.ilike('title', `%${search}%`)
  if (event_type) query = query.eq('event_type', event_type)
  if (status) query = query.eq('status', status)

  const { data, error, count } = await query
  if (error) throw error

  return {
    events: (data ?? []).map((row) => normalize(row as Record<string, unknown>)),
    total: count ?? 0,
  }
}

/** Un evento por id, con todas sus relaciones. */
export async function getEventById(id: string): Promise<DbEventEnriched | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('events')
    .select(SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return normalize(data as Record<string, unknown>)
}

// ── Mutaciones ─────────────────────────────────────────────

/** Campos escribibles de un evento (nombres de columna DB). */
export type EventWriteInput = {
  title: string
  description?: string | null
  event_type: string
  location?: string | null
  location_url?: string | null
  starts_at: string
  ends_at?: string | null
  is_recurring?: boolean
  recurrence_rule?: string | null
  recurrence_end?: string | null
  max_capacity?: number | null
  flyer_url?: string | null
  committee_id?: string | null
  is_virtual?: boolean
  requires_registration?: boolean
  requires_payment?: boolean
  payment_amount?: number | null
  requires_survey?: boolean
  status?: EventStatus
  cancellation_reason?: string | null
}

type SubEventInput = { name: string; max_capacity: number }

/** Crea un evento y sus sub-eventos. Devuelve el evento enriquecido. */
export async function createEvent(
  input: EventWriteInput,
  subEvents: SubEventInput[] = [],
): Promise<DbEventEnriched> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('events')
    .insert(input)
    .select('id')
    .single()
  if (error) throw error

  const eventId = (data as { id: string }).id

  if (subEvents.length > 0) {
    const { error: subErr } = await supabase
      .from('sub_events')
      .insert(subEvents.map((s) => ({ ...s, event_id: eventId })))
    if (subErr) throw subErr
  }

  const created = await getEventById(eventId)
  if (!created) throw new Error('No se pudo cargar el evento recién creado')
  return created
}

/** Actualiza los campos de un evento. Si se pasa `subEvents`, reemplaza el set
 *  completo de sub-eventos (borra los existentes e inserta los nuevos). */
export async function updateEvent(
  id: string,
  input: Partial<EventWriteInput>,
  subEvents?: SubEventInput[],
): Promise<DbEventEnriched> {
  const supabase = createAdminClient()

  const { error } = await supabase.from('events').update(input).eq('id', id)
  if (error) throw error

  if (subEvents) {
    const { error: delErr } = await supabase.from('sub_events').delete().eq('event_id', id)
    if (delErr) throw delErr
    if (subEvents.length > 0) {
      const { error: insErr } = await supabase
        .from('sub_events')
        .insert(subEvents.map((s) => ({ ...s, event_id: id })))
      if (insErr) throw insErr
    }
  }

  const updated = await getEventById(id)
  if (!updated) throw new Error('Evento no encontrado tras actualizar')
  return updated
}

/** Borrado lógico: marca is_active=false. El borrado duro lo hace el cascade. */
export async function deleteEvent(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('events').update({ is_active: false }).eq('id', id)
  if (error) throw error
}

// Re-exportamos tipos de dominio usados por el adapter
export type { AttendanceType }
