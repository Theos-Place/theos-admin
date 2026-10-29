/**
 * EVE-10 (2026-10-29) · La asistencia del reporte, repartida por sub-evento.
 *
 * El tab Reportes sumaba todo el evento y, en una charla con Youth, el número
 * del Youth solo se veía en el tab Check-in (y sin asistentes/servidores ni
 * personas nuevas). Floriana: «si tiene youth debe agregarse ese dato».
 *
 * Una fila por sub-evento, en el orden en que vienen, más una fila para los
 * check-ins SIN sub-evento (la charla principal) cuando los hay. Un check-in
 * cuyo sub_event_id no corresponde a ningún sub-evento del evento (uno que se
 * borró después) cae en la fila principal: es gente que estuvo, y perderla
 * del reporte sería peor que ponerla en la fila equivocada.
 */
import { contarPorCalidad, type ConteoCalidad } from './calidad-checkin'
import { contarPersonasNuevas, type CheckinParaConteo, type ConteoNuevos } from './personas-nuevas'

export type CheckinRepartible = CheckinParaConteo & {
  sub_event_id?: string | null
  checked_in_as?: string | null
  attendance_type?: string | null
}

export type FilaPorSubEvento = {
  /** null = la charla principal (check-ins sin sub-evento). */
  sub_event_id: string | null
  nombre: string
  calidad: ConteoCalidad
  nuevos: ConteoNuevos
}

export const NOMBRE_DEL_PRINCIPAL = 'Evento principal'

export function asistenciaPorSubEvento(
  checkins: ReadonlyArray<CheckinRepartible>,
  subEvents: ReadonlyArray<{ id: string; name: string }>,
  referencia: string,
): FilaPorSubEvento[] {
  const ids = new Set(subEvents.map(s => s.id))
  const fila = (id: string | null, nombre: string, lista: CheckinRepartible[]): FilaPorSubEvento => ({
    sub_event_id: id,
    nombre,
    calidad: contarPorCalidad(lista),
    nuevos: contarPersonasNuevas(lista, referencia),
  })
  const principal = checkins.filter(c => !c.sub_event_id || !ids.has(c.sub_event_id))
  const filas = subEvents.map(se => fila(se.id, se.name, checkins.filter(c => c.sub_event_id === se.id)))
  if (principal.length > 0) filas.unshift(fila(null, NOMBRE_DEL_PRINCIPAL, principal))
  return filas
}
