// REU-1: preferencias de días/zonas de una solicitud de estudio (reglas
// puras, testeables). Las reubicaciones nuevas guardan MÚLTIPLES zonas en
// proposed_zones; las solicitudes viejas tenían UNA zona en proposed_location.

/** Centinela de «me sirve cualquier zona». NO es un código de sede: se guarda
 *  tal cual y `zonaCoincide` nunca lo ve, lo atrapa antes el `includes`. */
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
/**
 * ¿Una preferencia de zona apunta a este grupo?
 *
 * ACEPTA CÓDIGO O NOMBRE, y no es indecisión: las dos formas conviven de
 * verdad. Las reubicaciones nuevas guardan el CÓDIGO (`la-sabana`) porque los
 * nombres cambian —el 2026-09-24 una zona pasó de «Sede Pedregal Miércoles
 * (código viejo)» a «Heredia» y cualquier preferencia guardada por nombre se
 * habría quedado apuntando a la nada—. Pero `proposed_location`, que es de
 * dónde salen las solicitudes viejas y las que eligen «otra», es TEXTO LIBRE y
 * lo va a seguir siendo.
 *
 * Comparar contra las dos cuesta una línea y evita que migrar datos sea
 * obligatorio para que el sistema funcione.
 */
export function zonaCoincide(
  grupo: { zoneCode: string | null; zoneName: string | null },
  preferencia: string,
): boolean {
  const p = preferencia.trim().toLowerCase()
  if (!p) return false
  if (grupo.zoneCode && p === grupo.zoneCode.toLowerCase()) return true
  return !!grupo.zoneName && p === grupo.zoneName.toLowerCase()
}

export function relocationGroupScore(
  // El grupo se pasa con las DOS: el `zone` crudo (un código) y su nombre ya
  // resuelto. Ver `zonaCoincide` para por qué hacen falta las dos.
  group: { zoneCode: string | null; zoneName: string | null; schedule_days: string[] | null },
  prefs: { zones: string[]; days: string[] },
): number {
  let score = 0
  if (prefs.zones.length > 0) {
    const anyZone = prefs.zones.includes(ANY_ZONE)
    const zoneMatch = anyZone || prefs.zones.some(z => zonaCoincide(group, z))
    if (zoneMatch) score += 2
  }
  if (prefs.days.length > 0) {
    const wanted = new Set(prefs.days.map(d => DAY_TO_LETTER[d] ?? d))
    if ((group.schedule_days ?? []).some(d => wanted.has(d))) score += 1
  }
  return score
}
