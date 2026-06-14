import { NextResponse } from 'next/server'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { getEvents, type DbEventEnriched } from '@/lib/supabase/queries/events'

// GET público para el widget /calendario (embebible en el sitio de la iglesia).
// Decisión documentada: NO lleva requireRoles — expone los eventos con campos de
// cartelera (sin inscripciones ni check-ins, que sí viajan en /api/events).
// La tabla events NO tiene columna is_public; "hoy todos son públicos", así que
// lee la MISMA fuente que el calendario interno (is_active=all menos
// cancelados/archivados) para que ambos coincidan. Rate limit por IP.
export async function GET(req: Request) {
  try {
    if (!rateLimit(`public-events:${clientIp(req)}`, 60, 60_000)) {
      return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 })
    }
    const { events } = await getEvents({ light: true, is_active: 'all', pageSize: 2000 })
    const publicEvents = events
      .filter(e => e.status !== 'cancelled' && e.status !== 'archived')
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
      max_capacity: e.max_capacity,
      requires_payment: e.requires_payment,
      payment_amount: e.payment_amount,
      requires_survey: e.requires_survey,
      is_recurring: e.is_recurring,
      recurrence_rule: e.recurrence_rule,
      recurrence_end: e.recurrence_end,
      parent_event_id: e.parent_event_id,
      flyer_url: e.flyer_url,
      cancellation_reason: null,
      is_active: e.is_active,
      committee_id: null,
      sub_events: [],
      registrations: [],
      checkins: [],
      volunteers: [],
      }))
    return NextResponse.json({ events: publicEvents, total: publicEvents.length })
  } catch (error) {
    console.error('GET /api/public/events:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
