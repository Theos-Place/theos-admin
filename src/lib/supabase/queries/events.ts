import { createAdminClient, type Insertable, type Updatable } from '@/lib/supabase/admin'
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
  virtual_url: string | null
  requires_registration: boolean
  requires_payment: boolean
  payment_amount: number | null
  requires_survey: boolean
  status: EventStatus
  cancellation_reason: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  exceptions: Array<{ exception_date: string; override_event_id: string | null }>
  sub_events: Array<{ id: string; name: string; max_capacity: number }>
  registrations: Array<{
    member_id: string
    payment_status: EventPaymentStatus
    registered_at: string
    member: { first_name: string; last_name: string } | null
  }>
  checkins: Array<{
    id: string
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
  /** 'all' = activos e inactivos (históricos importados). */
  is_active?: boolean | 'all'
  /** Sin relaciones (registrations/checkins/volunteers): para calendario y
   *  listados grandes — los ~840 históricos con 28k check-ins embebidos
   *  serían megas de payload. */
  light?: boolean
  page?: number
  pageSize?: number
}

const SELECT = `
  *,
  exceptions:event_exceptions!event_exceptions_parent_event_id_fkey(exception_date, override_event_id),
  sub_events(id, name, max_capacity),
  registrations:event_registrations(
    member_id,
    payment_status,
    registered_at,
    member:members(first_name, last_name)
  ),
  checkins:event_checkins(
    id,
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
    id: c.id as string,
    member_id: (c.member_id as string) ?? null,
    sub_event_id: (c.sub_event_id as string) ?? null,
    checked_in_at: c.checked_in_at as string,
    member: (c.member as { first_name: string; last_name: string } | null) ?? null,
    is_volunteer: c.member_id ? volunteerIds.has(c.member_id as string) : false,
  }))

  return {
    ...(row as DbEventEnriched),
    exceptions: (row.exceptions ?? []) as DbEventEnriched['exceptions'],
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

  // select como string plano: el parser de tipos de supabase-js no soporta el ternario
  const select: string = filters.light
    ? '*, exceptions:event_exceptions!event_exceptions_parent_event_id_fkey(exception_date, override_event_id), sub_events(id, name, max_capacity)'
    : SELECT
  let query = supabase
    .from('events')
    .select(select, { count: 'exact' })
    .order('starts_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (is_active !== 'all') query = query.eq('is_active', is_active)

  if (search) query = query.ilike('title', `%${search}%`)
  if (event_type) query = query.eq('event_type', event_type)
  if (status) query = query.eq('status', status)

  const { data, error, count } = await query
  if (error) throw error

  return {
    events: (data ?? []).map((row) => normalize(row as unknown as Record<string, unknown>)),
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
  parent_event_id?: string | null
  max_capacity?: number | null
  flyer_url?: string | null
  committee_id?: string | null
  is_virtual?: boolean
  virtual_url?: string | null
  requires_registration?: boolean
  requires_payment?: boolean
  payment_amount?: number | null
  requires_survey?: boolean
  status?: EventStatus
  cancellation_reason?: string | null
}

type SubEventInput = { name: string; max_capacity: number }

/** Crea un evento y sus sub-eventos. Devuelve el evento enriquecido.
 *  `createdBy` = id de auth del usuario (events.created_by → auth.users.id). */
export async function createEvent(
  input: EventWriteInput,
  subEvents: SubEventInput[] = [],
  createdBy?: string | null,
): Promise<DbEventEnriched> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('events')
    .insert({ ...input, is_active: true, created_by: createdBy ?? null } as Insertable<'events'>)
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

  const { error } = await supabase.from('events').update(input as Updatable<'events'>).eq('id', id)
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

type PaymentStatus = 'pending' | 'paid' | 'exempted'

/** Inscribe a un miembro en un evento. UNIQUE(event_id, member_id) evita duplicados. */
export async function createRegistration(
  eventId: string,
  input: { member_id: string; payment_status?: PaymentStatus },
): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('event_registrations')
    .insert({ event_id: eventId, member_id: input.member_id, payment_status: input.payment_status ?? 'pending' })
    .select('id')
    .single()
  if (error) throw error
  return data as { id: string }
}

/** Cambia el estado de pago de una inscripción. */
export async function updateRegistrationPayment(
  eventId: string,
  memberId: string,
  paymentStatus: PaymentStatus,
): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('event_registrations')
    .update({ payment_status: paymentStatus })
    .eq('event_id', eventId)
    .eq('member_id', memberId)
  if (error) throw error
}

/** Elimina la inscripción de un miembro en un evento. */
export async function deleteRegistration(eventId: string, memberId: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('event_registrations')
    .delete()
    .eq('event_id', eventId)
    .eq('member_id', memberId)
  if (error) throw error
}

// ── Tipos de evento (catálogo event_types) ─────────────────

export type DbEventType = {
  id: string
  name: string
  color: string
  icon: string
  description: string | null
  is_active: boolean
}

export async function getEventTypes(): Promise<DbEventType[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('event_types')
    .select('id, name, color, icon, description, is_active')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as DbEventType[]
}

export async function createEventType(input: {
  id: string; name: string; color?: string; icon?: string; description?: string | null; is_active?: boolean
}): Promise<DbEventType> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('event_types')
    .insert({
      id: input.id,
      name: input.name,
      color: input.color ?? '#161440',
      icon: input.icon ?? 'calendar',
      description: input.description ?? null,
      is_active: input.is_active ?? true,
    })
    .select('id, name, color, icon, description, is_active')
    .single()
  if (error) throw error
  return data as DbEventType
}

export async function updateEventType(
  id: string,
  patch: Partial<Omit<DbEventType, 'id'>>,
): Promise<DbEventType> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('event_types')
    .update(patch)
    .eq('id', id)
    .select('id, name, color, icon, description, is_active')
    .single()
  if (error) throw error
  return data as DbEventType
}

type VolunteerStatus = 'confirmed' | 'pending' | 'cancelled'

/** Asigna un servidor (voluntario) a un evento. UNIQUE(event_id, member_id). */
/**
 * ¿El miembro es servidor ACTIVO del comité (o de una sub-área del comité)?
 * `committee` es el NOMBRE del comité tal como se guarda en events.committee_id
 * (el form lo llena con el nombre del área, no con su UUID). Se resuelve el
 * nombre → área. Si el nombre no corresponde a ningún área no se puede validar
 * → se permite (regla permisiva).
 */
export async function memberServesCommittee(memberId: string, committee: string): Promise<boolean> {
  const supabase = createAdminClient()
  // events.committee_id ahora guarda el id del área-comité; históricos podrían
  // traer el nombre. Se resuelve a id de área en ambos casos.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(committee)
  let committeeAreaId: string | null = isUuid ? committee : null
  if (!committeeAreaId) {
    const { data: area } = await supabase.from('areas').select('id').eq('name', committee).maybeSingle()
    committeeAreaId = (area as { id: string } | null)?.id ?? null
  }
  if (!committeeAreaId) return true // no resoluble → no validable → permisivo

  const { data, error } = await supabase
    .from('volunteers')
    .select('id, position:service_positions!inner(area:areas!service_positions_area_id_fkey!inner(id, parent_id))')
    .eq('member_id', memberId)
    .eq('status', 'active')
  if (error) throw error
  return ((data ?? []) as Array<{ position: { area: { id: string; parent_id: string | null } | null } | null }>)
    .some(v => { const a = v.position?.area; return !!a && (a.id === committeeAreaId || a.parent_id === committeeAreaId) })
}

/** Error de validación: la persona no pertenece al comité organizador. */
export class NotCommitteeServerError extends Error {
  constructor(msg = 'La persona no es servidora activa del comité organizador del evento.') { super(msg); this.name = 'NotCommitteeServerError' }
}

export async function createVolunteer(
  eventId: string,
  input: { member_id: string; role?: string | null; status?: VolunteerStatus },
): Promise<{ id: string }> {
  const supabase = createAdminClient()
  // Validación 2: si el evento tiene comité organizador, solo se asignan
  // servidores activos de ese comité. Históricos sin comité (committee_id null)
  // → sin restricción (permisivo).
  const { data: ev } = await supabase.from('events').select('committee_id').eq('id', eventId).maybeSingle()
  const committeeId = (ev as { committee_id: string | null } | null)?.committee_id ?? null
  if (committeeId && !(await memberServesCommittee(input.member_id, committeeId))) {
    throw new NotCommitteeServerError()
  }
  const { data, error } = await supabase
    .from('event_volunteers')
    .insert({ event_id: eventId, member_id: input.member_id, role: input.role ?? null, status: input.status ?? 'pending' })
    .select('id')
    .single()
  if (error) throw error
  return data as { id: string }
}

/** Quita la asignación de un servidor en un evento. */
export async function deleteVolunteer(eventId: string, memberId: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('event_volunteers')
    .delete()
    .eq('event_id', eventId)
    .eq('member_id', memberId)
  if (error) throw error
}

/** Registra un check-in en un evento. attendance_type NO se persiste: se deriva
 *  al leer (es "server" si el miembro es voluntario del evento). */
export async function createCheckin(
  eventId: string,
  input: { member_id?: string | null; guest_name?: string | null; sub_event_id?: string | null; method?: 'manual' | 'qr' | 'smart_link' },
): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('event_checkins')
    .insert({
      event_id: eventId,
      member_id: input.member_id ?? null,
      guest_name: input.guest_name ?? null,
      sub_event_id: input.sub_event_id ?? null,
      method: input.method ?? 'manual',
    })
    .select('id')
    .single()
  if (error) throw error
  return data as { id: string }
}

/** Deshace un check-in: borra la fila de event_checkins. Borrado duro — el
 *  check-in no requiere auditoría (se puede volver a registrar). Acotado al
 *  evento para evitar borrar de otro evento por un id ajeno. */
export async function deleteCheckin(eventId: string, checkinId: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('event_checkins').delete().eq('id', checkinId).eq('event_id', eventId)
  if (error) throw error
}

/** Cancela un evento: status='cancelled' + motivo. No borra (conserva inscritos/check-ins). */
export async function cancelEvent(id: string, reason: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('events').update({ status: 'cancelled', cancellation_reason: reason || null }).eq('id', id)
  if (error) throw error
}

/** Borrado lógico: marca is_active=false. El borrado duro lo hace el cascade. */
export async function deleteEvent(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('events').update({ is_active: false }).eq('id', id)
  if (error) throw error
}

// ── Recurrentes: edición/eliminación por alcance (estilo Google Calendar) ──────

export type EventScope = 'all' | 'future' | 'single'

/** Datos de la ocurrencia sobre la que se actúa. `date` = YYYY-MM-DD en hora CR
 *  (lo calcula el cliente, que conoce la zona); `start` = ISO de su inicio real. */
export type OccurrenceRef = { date: string; start: string }

export class EventHasAttendanceError extends Error {
  constructor(msg = 'No se puede eliminar un evento que tiene check-ins o inscripciones registrados. Cancelalo en su lugar.') {
    super(msg); this.name = 'EventHasAttendanceError'
  }
}

/** ¿Cuántos check-ins + inscripciones tiene un evento (fila real)? */
async function countAttendance(
  supabase: ReturnType<typeof createAdminClient>,
  eventId: string,
): Promise<number> {
  const [ch, rg] = await Promise.all([
    supabase.from('event_checkins').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    supabase.from('event_registrations').select('member_id', { count: 'exact', head: true }).eq('event_id', eventId),
  ])
  return (ch.count ?? 0) + (rg.count ?? 0)
}

/** Snapshot de un evento (DB) a campos escribibles, para clonar overrides / nuevos padres. */
function toWriteInput(e: DbEventEnriched): EventWriteInput {
  return {
    title: e.title,
    description: e.description,
    event_type: e.event_type,
    location: e.location,
    location_url: e.location_url,
    starts_at: e.starts_at,
    ends_at: e.ends_at,
    is_recurring: e.is_recurring,
    recurrence_rule: e.recurrence_rule,
    recurrence_end: e.recurrence_end,
    max_capacity: e.max_capacity,
    flyer_url: e.flyer_url,
    committee_id: e.committee_id,
    is_virtual: e.is_virtual,
    virtual_url: e.virtual_url,
    requires_registration: e.requires_registration,
    requires_payment: e.requires_payment,
    payment_amount: e.payment_amount,
    requires_survey: e.requires_survey,
    status: e.status,
  }
}

function parentSubEvents(e: DbEventEnriched): SubEventInput[] {
  return e.sub_events.map((s) => ({ name: s.name, max_capacity: s.max_capacity }))
}

/**
 * Edita un evento recurrente según el alcance:
 *  - all: actualiza el padre (toda la serie).
 *  - future: pone UNTIL en el padre (termina antes de la ocurrencia) y crea un
 *    nuevo padre desde esa fecha con la misma RRULE + los cambios.
 *  - single: crea un evento puntual override con los cambios y registra la
 *    excepción (override_event_id) para esa fecha.
 */
export async function updateEventScoped(
  id: string,
  scope: EventScope,
  input: Partial<EventWriteInput>,
  subEvents: SubEventInput[] | undefined,
  occurrence: OccurrenceRef | null,
  createdBy?: string | null,
): Promise<DbEventEnriched> {
  if (scope === 'all' || !occurrence) return updateEvent(id, input, subEvents)

  const supabase = createAdminClient()
  const parent = await getEventById(id)
  if (!parent) throw new Error('Evento no encontrado')
  const base = toWriteInput(parent)
  const subs = subEvents ?? parentSubEvents(parent)

  if (scope === 'single') {
    const overrideInput: EventWriteInput = {
      ...base, ...input,
      is_recurring: false, recurrence_rule: null, recurrence_end: null,
      parent_event_id: id,
    }
    const override = await createEvent(overrideInput, subs, createdBy)
    const { error } = await supabase.from('event_exceptions').upsert(
      { parent_event_id: id, exception_date: occurrence.date, override_event_id: override.id },
      { onConflict: 'parent_event_id,exception_date' },
    )
    if (error) throw error
    return override
  }

  // scope === 'future'
  const until = new Date(new Date(occurrence.start).getTime() - 1000).toISOString()
  const { error: upErr } = await supabase.from('events').update({ recurrence_end: until }).eq('id', id)
  if (upErr) throw upErr
  const newParentInput: EventWriteInput = {
    ...base, ...input,
    is_recurring: true,
    recurrence_rule: input.recurrence_rule ?? parent.recurrence_rule,
    recurrence_end: parent.recurrence_end ?? null, // conserva el fin original de la serie
    parent_event_id: null,
  }
  return createEvent(newParentInput, subs, createdBy)
}

/**
 * Elimina un evento recurrente según el alcance:
 *  - all: borra el evento (cascade limpia hijos y excepciones). También borra
 *    sus overrides. Bloquea si hay check-ins/inscripciones.
 *  - future: pone UNTIL en el padre (sin crear nuevo padre).
 *  - single: registra la excepción cancelada (override_event_id null); si había
 *    un override, lo borra (bloquea si tenía asistencia).
 * Para eventos no recurrentes usar scope 'all'.
 */
export async function deleteEventScoped(
  id: string,
  scope: EventScope,
  occurrence: OccurrenceRef | null,
): Promise<void> {
  const supabase = createAdminClient()

  if (scope === 'single' && occurrence) {
    const { data: existing } = await supabase
      .from('event_exceptions').select('override_event_id')
      .eq('parent_event_id', id).eq('exception_date', occurrence.date).maybeSingle()
    const prevOverride = (existing as { override_event_id: string | null } | null)?.override_event_id
    if (prevOverride) {
      if (await countAttendance(supabase, prevOverride) > 0) throw new EventHasAttendanceError()
      await supabase.from('events').delete().eq('id', prevOverride)
    }
    const { error } = await supabase.from('event_exceptions').upsert(
      { parent_event_id: id, exception_date: occurrence.date, override_event_id: null },
      { onConflict: 'parent_event_id,exception_date' },
    )
    if (error) throw error
    return
  }

  if (scope === 'future' && occurrence) {
    const until = new Date(new Date(occurrence.start).getTime() - 1000).toISOString()
    const { error } = await supabase.from('events').update({ recurrence_end: until }).eq('id', id)
    if (error) throw error
    return
  }

  // scope === 'all' (o evento no recurrente): borrado duro con guard de asistencia.
  if (await countAttendance(supabase, id) > 0) throw new EventHasAttendanceError()
  // Overrides de la serie (eventos puntuales hijos): borrarlos también, con guard.
  const { data: overrides } = await supabase.from('events').select('id').eq('parent_event_id', id)
  for (const o of ((overrides ?? []) as Array<{ id: string }>)) {
    if (await countAttendance(supabase, o.id) > 0) throw new EventHasAttendanceError()
  }
  if (overrides && overrides.length > 0) {
    await supabase.from('events').delete().in('id', (overrides as Array<{ id: string }>).map((o) => o.id))
  }
  const { error } = await supabase.from('events').delete().eq('id', id)
  if (error) throw error
}

// Re-exportamos tipos de dominio usados por el adapter
export type { AttendanceType }
