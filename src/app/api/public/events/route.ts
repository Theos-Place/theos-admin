import { NextResponse } from 'next/server'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { type DbEventEnriched } from '@/lib/supabase/queries/events'
import { eventosPublicos } from '@/lib/supabase/queries/eventos-publicos'
import { reportarError } from '@/lib/observabilidad'

// GET público para el widget /calendario (embebible en el sitio de la iglesia).
// Decisión documentada: NO lleva requireRoles — expone los eventos con campos de
// cartelera (sin inscripciones ni check-ins, que sí viajan en /api/events).
// Desde 2026-08-27 la tabla tiene `is_public` y esta ruta filtra por ella: un
// evento INTERNO no se lista acá. Ojo con la asimetría, es a propósito:
// /api/public/events/[id] (el detalle) NO filtra, porque un evento interno se
// comparte justamente por su link directo. Lo que cambia es que no aparezca en
// la cartelera embebida del sitio. Rate limit por IP.
export async function GET(req: Request) {
  try {
    if (!rateLimit(`public-events:${clientIp(req)}`, 60, 60_000)) {
      return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 })
    }
    // INVARIANTE de privacidad: esta ruta es pública. `light: true` es
    // obligatorio (su SELECT no trae registrations/checkins/volunteers, que
    // incluyen nombres de miembros) y el .map() de abajo es una whitelist —
    // nunca hacer spread del evento enriquecido acá.
    const publicEvents = (await eventosPublicos())
      .map((e: DbEventEnriched) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      event_type: e.event_type,
      status: e.status,
      starts_at: e.starts_at,
      ends_at: e.ends_at,
      location: e.location,
      location_url: e.location_url,
      is_virtual: e.is_virtual,
      requires_registration: e.requires_registration,
      registration_form_id: e.registration_form_id ?? null,
      max_capacity: e.max_capacity,
      requires_payment: e.requires_payment,
      payment_amount: e.payment_amount,
      requires_survey: e.requires_survey,
      // Zona y excepciones: sin ellas el widget expandía las series en hora de
      // Costa Rica aunque fueran de Madrid, y mostraba las fechas canceladas
      // de una serie (2026-10-15). Las excepciones son solo fechas.
      timezone: e.timezone ?? null,
      exceptions: (e.exceptions ?? []).map(x => ({ exception_date: x.exception_date, override_event_id: x.override_event_id })),
      is_recurring: e.is_recurring,
      recurrence_rule: e.recurrence_rule,
      recurrence_end: e.recurrence_end,
      parent_event_id: e.parent_event_id,
      flyer_url: e.flyer_url,
      cancellation_reason: null,
      is_active: e.is_active,
      sub_events: [],
      registrations: [],
      checkins: [],
      volunteers: [],
      }))
    return NextResponse.json({ events: publicEvents, total: publicEvents.length })
  } catch (error) {
    reportarError('GET /api/public/events:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
