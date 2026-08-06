// Mapea el payload del form de eventos (nuevo/editar) a columnas DB + sub-eventos.

import type { EventWriteInput } from '@/lib/supabase/queries/events'
import { computeSurveySendAt } from '@/lib/events/survey-schedule'

/** Combina fecha (YYYY-MM-DD) + hora (HH:mm) en un ISO timestamptz, o null. */
function combineDateTime(date?: string, time?: string): string | null {
  if (!date) return null
  return new Date(`${date}T${time || '00:00'}`).toISOString()
}

/** Fin de la recurrencia: último día completo en que aplica (23:59:59 hora CR
 *  fija, UTC-6), para que la ocurrencia de ese día no quede excluida. */
function endOfDayCR(date?: string): string | null {
  if (!date) return null
  return new Date(`${date}T23:59:59-06:00`).toISOString()
}

const num = (v: unknown) => (v === '' || v == null ? null : Number(v))

/** Ids de comités organizadores (m2m). El form envía `organizing_committee_ids`. */
export function formToOrganizingCommittees(body: Record<string, unknown>): string[] {
  return Array.isArray(body.organizing_committee_ids)
    ? (body.organizing_committee_ids as unknown[]).filter((x): x is string => typeof x === 'string')
    : []
}

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
    starts_at: combineDateTime(body.start_date as string, body.start_time as string) ?? new Date().toISOString(),
    ends_at: combineDateTime(body.end_date as string, body.end_time as string),
    location: (body.location as string) || null,
    location_url: (body.location_map_url as string) || null,
    is_virtual: Boolean(body.is_virtual),
    virtual_url: (body.virtual_link as string) || null,
    is_recurring: Boolean(body.is_recurring),
    recurrence_rule: (body.recurrence_rule as string) || null,
    recurrence_end: endOfDayCR(body.recurrence_end as string),
    requires_registration: Boolean(body.requires_registration),
    max_capacity: num(body.max_capacity),
    requires_payment: Boolean(body.requires_payment),
    payment_amount: num(body.payment_amount),
    // INT-2: moneda del costo; valores fuera del CHECK caen a CRC.
    currency: ['CRC', 'USD', 'EUR'].includes(body.currency as string) ? (body.currency as string) : 'CRC',
    server_price: num(body.server_price),
    servers_pay: body.servers_pay === undefined ? true : Boolean(body.servers_pay),
    requires_survey: Boolean(body.has_satisfaction_survey),
    flyer_url: (body.flyer as string) || null,
    status: 'upcoming',
    ...formToSurvey(body),
  }
}

/** EVE-4 · Formulario de inscripción y programación de la encuesta.
 *
 *  El MOMENTO se guarda calculado (survey_send_at), no solo la regla: es lo que
 *  mira el cron y así el envío es predecible. La regla (survey_offset_hours)
 *  también se guarda, para poder mostrarla y recalcular si mueven el evento. */
export function formToSurvey(body: Record<string, unknown>): Pick<EventWriteInput,
  'registration_form_id' | 'survey_form_id' | 'survey_template_id' | 'survey_offset_hours' | 'survey_send_at'> {
  const id = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const requiere = Boolean(body.has_satisfaction_survey)
  if (!requiere) {
    // Sin encuesta se limpia todo: si la apagaron, no debe quedar un envío
    // programado esperando en la base.
    return {
      registration_form_id: id(body.registration_form_id),
      survey_form_id: null, survey_template_id: null,
      survey_offset_hours: null, survey_send_at: null,
    }
  }
  const endsAt = combineDateTime(body.end_date as string, body.end_time as string)
  const offset = body.survey_offset_hours == null || body.survey_offset_hours === ''
    ? null
    : Number(body.survey_offset_hours)
  const sendAt = offset != null && Number.isFinite(offset)
    ? computeSurveySendAt(endsAt, offset)
    : id(body.survey_send_at)
  return {
    registration_form_id: id(body.registration_form_id),
    // El CHECK de la BD no permite los dos: gana el formulario.
    survey_form_id: id(body.survey_form_id),
    survey_template_id: id(body.survey_form_id) ? null : id(body.survey_template_id),
    survey_offset_hours: offset != null && Number.isFinite(offset) ? offset : null,
    survey_send_at: sendAt,
  }
}

/** Payload parcial para actualizar: solo incluye las claves presentes en el body. */
export function formToPartialWriteInput(body: Record<string, unknown>): Partial<EventWriteInput> {
  const full = formToWriteInput(body)
  const out: Partial<EventWriteInput> = {}
  const map: Record<string, keyof EventWriteInput> = {
    name: 'title', event_type: 'event_type', description: 'description',
    location: 'location', location_map_url: 'location_url', is_virtual: 'is_virtual',
    virtual_link: 'virtual_url',
    is_recurring: 'is_recurring', recurrence_rule: 'recurrence_rule', recurrence_end: 'recurrence_end',
    requires_registration: 'requires_registration', max_capacity: 'max_capacity',
    requires_payment: 'requires_payment', payment_amount: 'payment_amount',
    currency: 'currency',
    server_price: 'server_price', servers_pay: 'servers_pay',
    has_satisfaction_survey: 'requires_survey', flyer: 'flyer_url', status: 'status',
  }
  for (const [formKey, dbKey] of Object.entries(map)) {
    if (formKey in body) (out as Record<string, unknown>)[dbKey] = full[dbKey]
  }
  // fechas: si vienen, recomputar starts_at/ends_at
  if ('start_date' in body) out.starts_at = full.starts_at
  if ('end_date' in body) out.ends_at = full.ends_at

  // EVE-4 · La encuesta se recalcula EN BLOQUE si el body toca cualquiera de
  // sus piezas —o si movieron el fin del evento, porque el momento guardado
  // depende de él—. Media programación guardada es peor que ninguna.
  const tocaEncuesta = ['has_satisfaction_survey', 'survey_form_id', 'survey_template_id',
    'survey_offset_hours', 'survey_send_at', 'end_date', 'end_time'].some(k => k in body)
  if (tocaEncuesta) Object.assign(out, formToSurvey(body))
  else if ('registration_form_id' in body) out.registration_form_id = full.registration_form_id
  return out
}
