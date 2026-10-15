import { getEvents, type DbEventEnriched } from '@/lib/supabase/queries/events'

/**
 * Los eventos de la cartelera pública: los mismos para el widget /calendario
 * (`GET /api/public/events`) y para la suscripción (`GET /api/public/events.ics`).
 *
 * Un solo lugar a propósito: si el widget y el feed filtraran distinto, la
 * persona suscrita vería en su teléfono algo que el sitio no muestra.
 *
 * `light: true` es obligatorio: su SELECT no trae inscripciones, check-ins ni
 * voluntarios, que llevan nombres de miembros. Igual, quien expone esto tiene
 * que pasar por una whitelist de campos y nunca hacer spread del evento.
 */
export async function eventosPublicos(): Promise<DbEventEnriched[]> {
  // PostgREST corta cada respuesta en ~1000 filas: paginar hasta agotar.
  const pageSize = 1000
  let events: DbEventEnriched[] = []
  for (let page = 1; ; page++) {
    const batch = await getEvents({ light: true, is_active: 'all', page, pageSize })
    events = events.concat(batch.events)
    if (events.length >= batch.total || batch.events.length < pageSize) break
  }
  return events
    .filter(e => e.status !== 'cancelled' && e.status !== 'archived')
    // Un evento INTERNO no va a la cartelera (is_public, 2026-08-27).
    .filter(e => e.is_public !== false)
}
