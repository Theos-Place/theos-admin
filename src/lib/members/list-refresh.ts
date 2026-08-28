// Reglas de recálculo de las listas guardadas (módulo puro).
//
// La consulta vive en queries/member-lists.ts; acá está lo que se puede decidir
// sin tocar la base, que es justo lo que conviene tener fijado con tests: qué
// lista se puede recalcular y qué se le dice a quien aprieta el botón.

import type { FilterState } from '@/types/filters'

/**
 * Por qué una lista no se puede recalcular, o null si sí se puede.
 *
 * Dos motivos, y el segundo se descubrió midiendo:
 *
 *  · SIN FILTROS: su membresía es la única definición que tiene y recalcularla
 *    la dejaría vacía. Pasa con las listas armadas a mano.
 *
 *  · FILTRO INCOMPLETO: durante mucho tiempo solo se guardaban `conditions` y
 *    `groups`, mientras la pantalla de miembros mandaba además los chips, la
 *    búsqueda y el filtro de asistencia. En esas listas no se sabe si esos
 *    filtros estaban apagados o si no se guardaron, y la diferencia es enorme:
 *    "Invitación N1" tiene 260 personas y recalculada sin el filtro de
 *    asistencia da 14.848. Recalcularlas las ensancharía sola y en silencio.
 */
export function motivoNoRecalculable(f: FilterState | null | undefined): string | null {
  if (!f) return 'La lista no tiene filtros guardados: su contenido es la única definición que tiene.'
  if (f.v !== 2) {
    return 'Esta lista se guardó antes de que se guardara el filtro completo (faltan los chips, '
      + 'la búsqueda y el filtro de asistencia). Recalcularla daría un grupo más grande que el original. '
      + 'Para dejarla al día, volvé a armar la búsqueda en Miembros y guardala de nuevo con el mismo nombre.'
  }
  const tieneAlgo = f.conditions.length > 0 || !!f.is_donor || !!f.is_server
    || !!f.active_attendance || !!(f.search ?? '').trim()
  if (!tieneAlgo) return 'La lista no tiene filtros guardados: su contenido es la única definición que tiene.'
  return null
}

/** ¿Se puede recalcular esta lista? */
export function sePuedeRecalcular(f: FilterState | null | undefined): boolean {
  return motivoNoRecalculable(f) === null
}

/** El mensaje del resultado, en términos de lo que cambió. */
export function mensajeRecalculo(antes: number, despues: number): string {
  const n = (v: number) => v.toLocaleString('es-CR')
  if (antes === despues) return `Sin cambios: siguen siendo ${n(despues)}.`
  const dif = despues - antes
  return `Actualizada: ${n(antes)} → ${n(despues)} (${dif > 0 ? '+' : ''}${dif}).`
}
