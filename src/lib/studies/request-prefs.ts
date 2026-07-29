// REU-1: preferencias de días/zonas de una solicitud de estudio (reglas
// puras, testeables). Las reubicaciones nuevas guardan MÚLTIPLES zonas en
// proposed_zones; las solicitudes viejas tenían UNA zona en proposed_location.

export const ANY_ZONE = 'Cualquiera'

/** Zonas efectivas de una solicitud: las múltiples si existen; si no, la zona
 *  única vieja como lista de 1 (compatibilidad con solicitudes existentes). */
export function requestZones(r: { proposed_zones?: string[] | null; proposed_location?: string | null }): string[] {
  const multi = (r.proposed_zones ?? []).filter(Boolean)
  if (multi.length > 0) return multi
  const single = (r.proposed_location ?? '').trim()
  return single ? [single] : []
}

// Los grupos guardan los días como iniciales (L/M/X/J/V/S/D); las solicitudes
// guardan nombres completos.
const DAY_TO_LETTER: Record<string, string> = {
  'Lunes': 'L', 'Martes': 'M', 'Miércoles': 'X', 'Jueves': 'J', 'Viernes': 'V', 'Sábado': 'S', 'Domingo': 'D',
}

/**
 * Puntaje de coincidencia de un grupo candidato con las preferencias de la
 * persona (para ORDENAR el picker de resolución, no para filtrar): la zona
 * pedida pesa más que el día. Sin preferencias → 0 (orden estable original).
 * "Cualquiera" en zonas coincide con todo.
 */
export function relocationGroupScore(
  // zoneName = nombre legible de la sede (los grupos guardan el CODE; el
  // caller lo resuelve con sedeLabel) — las solicitudes guardan nombres.
  group: { zoneName: string | null; schedule_days: string[] | null },
  prefs: { zones: string[]; days: string[] },
): number {
  let score = 0
  if (prefs.zones.length > 0) {
    const anyZone = prefs.zones.includes(ANY_ZONE)
    const zoneMatch = anyZone || (group.zoneName !== null && prefs.zones.some(z => z.toLowerCase() === (group.zoneName ?? '').toLowerCase()))
    if (zoneMatch) score += 2
  }
  if (prefs.days.length > 0) {
    const wanted = new Set(prefs.days.map(d => DAY_TO_LETTER[d] ?? d))
    if ((group.schedule_days ?? []).some(d => wanted.has(d))) score += 1
  }
  return score
}
