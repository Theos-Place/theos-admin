import { rateLimit, clientIp } from '@/lib/rate-limit'
import { eventosPublicos } from '@/lib/supabase/queries/eventos-publicos'
import { toDomainEvent } from '@/lib/events/adapter'
import { eventsInRange } from '@/lib/events/event-views'
import { armarIcs } from '@/lib/events/ics'
import { reportarError } from '@/lib/observabilidad'

/**
 * GET público: el calendario de Theos para SUSCRIBIRSE (2026-10-15).
 *
 * Decisión documentada: NO lleva requireRoles. Es la misma cartelera que
 * `/api/public/events` —mismos eventos, misma whitelist— en formato iCalendar,
 * y una app de calendario no tiene sesión. Rate limit por IP.
 *
 * Google, Apple y Outlook vuelven a pedir esta URL solos, cada tanto: por eso
 * un evento nuevo o movido aparece sin que la persona haga nada.
 *
 * Ventana: de 60 días atrás a 13 meses adelante. Para atrás alcanza para ver
 * lo reciente; más historia solo engorda el archivo (hay 3.500 charlas viejas)
 * y las apps tardan más en procesarlo. `?types=a,b` filtra por tipo, como el
 * widget.
 */
export const dynamic = 'force-dynamic'

const DIA = 86_400_000

export async function GET(req: Request) {
  try {
    if (!rateLimit(`public-ics:${clientIp(req)}`, 30, 60_000)) {
      return new Response('Demasiadas solicitudes', { status: 429 })
    }
    const url = new URL(req.url)
    const tipos = url.searchParams.get('types')?.split(',').map(t => t.trim()).filter(Boolean) ?? null

    const db = await eventosPublicos()
    const actualizado = new Map(db.map(e => [e.id, e.updated_at]))
    const eventos = db.map(toDomainEvent).filter(e => !tipos || tipos.includes(e.event_type))

    const ahora = new Date()
    const fechas = eventsInRange(eventos, new Date(ahora.getTime() - 60 * DIA), new Date(ahora.getTime() + 396 * DIA))

    const ics = armarIcs(
      // Whitelist: solo lo que ya publica la cartelera.
      fechas.map(e => ({
        id: e.id,
        name: e.name,
        description: e.description,
        location: e.is_virtual ? (e.location || 'Virtual') : e.location,
        start_at: e.start_at,
        end_at: e.end_at,
        is_occurrence: (e as { is_occurrence?: boolean }).is_occurrence,
        updated_at: actualizado.get(e.id) ?? null,
      })),
      { base: url.origin, ahora, nombre: 'Theos Place' },
    )

    return new Response(ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="theos-place.ics"',
        // Las apps piden cada pocas horas; 15 minutos de caché en el CDN
        // alcanzan para que un evento recién creado no tarde en salir.
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600',
      },
    })
  } catch (error) {
    reportarError('GET /api/public/events.ics:', error)
    return new Response('Error interno', { status: 500 })
  }
}
