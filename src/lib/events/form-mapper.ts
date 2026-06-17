// Mapea el payload del form de eventos (nuevo/editar) a columnas DB + sub-eventos.

import type { EventWriteInput } from '@/lib/supabase/queries/events'

/** Combina fecha (YYYY-MM-DD) + hora (HH:mm) en un ISO timestamptz, o null. */
function combineDateTime(date?: string, time?: string): string | null {
  if (!date) return null
  return new Date(`${date}T${time || '00:00'}`).toISOString()
}

const num = (v: unknown) => (v === '' || v == null ? null : Number(v))

export function formToSubEvents(body: Record<string, unknown>): { name: string; max_capacity: number }[] {
  return Array.isArray(body.sub_events)
    ? (body.sub_events as Array<{ name: string; max_capacity: unknown }>).map((s) => ({
        name: s.name,
        max_capacity: Number(s.max_capacity) || 0,
      }))
    : []
}

/** Payload completo para crear. */
export function formToWriteInput(body: Record<string, unknown>): EventWriteInput {
  return {
    title: String(body.name ?? ''),
    event_type: String(body.event_type ?? ''),
    description: (body.description as string) || null,
    committee_id: (body.committee as string) || null,
    starts_at: combineDateTime(body.start_date as string, body.start_time as string) ?? new Date().toISOString(),
    ends_at: combineDateTime(body.end_date as string, body.end_time as string),
    location: (body.location as string) || null,
    location_url: (body.location_map_url as string) || null,
    is_virtual: Boolean(body.is_virtual),
    virtual_url: (body.virtual_link as string) || null,
    is_recurring: Boolean(body.is_recurring),
    recurrence_rule: (body.recurrence_rule as string) || null,
    requires_registration: Boolean(body.requires_registration),
    max_capacity: num(body.max_capacity),
    requires_payment: Boolean(body.requires_payment),
    payment_amount: num(body.payment_amount),
    requires_survey: Boolean(body.has_satisfaction_survey),
    flyer_url: (body.flyer as string) || null,
    status: 'upcoming',
  }
}

/** Payload parcial para actualizar: solo incluye las claves presentes en el body. */
export function formToPartialWriteInput(body: Record<string, unknown>): Partial<EventWriteInput> {
  const full = formToWriteInput(body)
  const out: Partial<EventWriteInput> = {}
  const map: Record<string, keyof EventWriteInput> = {
    name: 'title', event_type: 'event_type', description: 'description', committee: 'committee_id',
    location: 'location', location_map_url: 'location_url', is_virtual: 'is_virtual',
    virtual_link: 'virtual_url',
    is_recurring: 'is_recurring', recurrence_rule: 'recurrence_rule',
    requires_registration: 'requires_registration', max_capacity: 'max_capacity',
    requires_payment: 'requires_payment', payment_amount: 'payment_amount',
    has_satisfaction_survey: 'requires_survey', flyer: 'flyer_url', status: 'status',
  }
  for (const [formKey, dbKey] of Object.entries(map)) {
    if (formKey in body) (out as Record<string, unknown>)[dbKey] = full[dbKey]
  }
  // fechas: si vienen, recomputar starts_at/ends_at
  if ('start_date' in body) out.starts_at = full.starts_at
  if ('end_date' in body) out.ends_at = full.ends_at
  return out
}
