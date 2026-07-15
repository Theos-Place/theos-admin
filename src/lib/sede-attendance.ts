// Cálculo ÚNICO de la sede de un miembro por asistencia a charlas (módulo
// PURO, sin server — importable desde componentes cliente). Fuente de verdad
// para perfil, lista y export; usa los nombres canónicos de sedes-canonical.ts.
//
// Reglas (decisión 2026-07-15):
//  · Activo (asistió en los últimos 6 meses calendario): sede = charla más
//    asistida en esos últimos 6 meses. Empate → la más reciente.
//  · Inactivo (sin asistencia en los últimos 6 meses): se toma la fecha de su
//    última asistencia y se calcula la sede como la charla más asistida en la
//    ventana de 6 meses PREVIA a esa fecha (su último período activo, no todo
//    el historial).
//  · Sin asistencias nunca: sin sede (null).
import { canonicalCharlaTitle } from './sedes-canonical'

export type MemberSedeResult = {
  /** Nombre canónico de la sede, sin el prefijo "Charla " (ej. "Cartago"). */
  name: string
  case: 'activo' | 'inactivo'
  /** ISO de la última asistencia a charla (con nombre de sede reconocido). */
  lastCheckin: string
}

// UTC (no hora local del servidor) — para coincidir con `NOW() - INTERVAL`
// en Postgres (mismo cálculo que el cron refresh_member_sedes, migración 125).
function monthsAgoIso(from: Date, months: number): string {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - months, from.getUTCDate(),
    from.getUTCHours(), from.getUTCMinutes(), from.getUTCSeconds(), from.getUTCMilliseconds()))
  return d.toISOString()
}

/** `checkins`: TODO el historial de check-ins de charla del miembro (title +
 *  checked_in_at), sin filtrar por ventana — la función decide la ventana. */
export function computeMemberSede(
  checkins: Array<{ checked_in_at: string | null; title: string | null }>,
  now = new Date(),
): MemberSedeResult | null {
  const valid = checkins
    .filter((c): c is { checked_in_at: string; title: string } => !!c.checked_in_at && !!c.title && !!canonicalCharlaTitle(c.title))
    .map(c => ({ date: c.checked_in_at, sede: canonicalCharlaTitle(c.title)!.replace(/^Charla\s+/, '') }))
  if (valid.length === 0) return null

  const lastCheckin = valid.reduce((max, c) => (c.date > max ? c.date : max), valid[0].date)
  const activeCutoff = monthsAgoIso(now, 6)
  const isActive = lastCheckin >= activeCutoff

  // Ventana de la mayoría: si está activo, los últimos 6 meses desde hoy; si
  // no, los 6 meses previos a su última asistencia (su último período activo).
  const windowEnd = isActive ? now.toISOString() : lastCheckin
  const windowStart = isActive ? activeCutoff : monthsAgoIso(new Date(lastCheckin), 6)

  const tally = new Map<string, { count: number; last: string }>()
  for (const c of valid) {
    if (c.date < windowStart || c.date > windowEnd) continue
    const cur = tally.get(c.sede) ?? { count: 0, last: '' }
    cur.count++
    if (c.date > cur.last) cur.last = c.date
    tally.set(c.sede, cur)
  }

  let best: { name: string; last: string; count: number } | null = null
  for (const [name, v] of tally) {
    if (!best || v.count > best.count || (v.count === best.count && v.last > best.last)) {
      best = { name, last: v.last, count: v.count }
    }
  }
  if (!best) return null // no debería pasar: la última asistencia siempre cae en su propia ventana

  return { name: best.name, case: isActive ? 'activo' : 'inactivo', lastCheckin }
}

const CR_TZ = 'America/Costa_Rica'

/** Componentes {year, month, day} de una fecha en horario de Costa Rica (para
 *  no depender de la zona horaria del servidor al mostrarle la fecha al usuario). */
function partsCR(d: Date): { year: number; month: number; day: number } {
  const [y, m, day] = d.toLocaleDateString('en-CA', { timeZone: CR_TZ }).split('-').map(Number)
  return { year: y, month: m, day }
}

/** Texto "hace N meses" para el matiz de sede inactiva. Redondea a meses
 *  calendario completos (horario Costa Rica); a partir de 12 usa "hace más de un año". */
export function formatSedeRecency(lastCheckinIso: string, now = new Date()): string {
  const last = partsCR(new Date(lastCheckinIso))
  const cur = partsCR(now)
  let months = (cur.year - last.year) * 12 + (cur.month - last.month)
  if (cur.day < last.day) months -= 1
  if (months < 0) months = 0
  if (months >= 12) return 'hace más de un año'
  if (months <= 1) return 'hace 1 mes'
  return `hace ${months} meses`
}
