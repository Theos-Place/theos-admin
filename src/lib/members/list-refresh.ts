// Reglas de recálculo de las listas guardadas (módulo puro).
//
// La consulta vive en queries/member-lists.ts; acá está lo que se puede decidir
// sin tocar la base, que es justo lo que conviene tener fijado con tests: qué
// lista se puede recalcular y qué se le dice a quien aprieta el botón.

import type { FilterState } from '@/types/filters'

/**
 * ¿Se puede recalcular esta lista?
 *
 * Una lista sin filtros guardados NO se puede: su membresía es la única
 * definición que tiene, y recalcularla la dejaría vacía. Pasa con las listas
 * armadas a mano y con las viejas que se guardaron antes de que los filtros se
 * persistieran.
 */
export function sePuedeRecalcular(f: FilterState | null | undefined): boolean {
  if (!f) return false
  return f.conditions.length > 0 || !!f.is_donor || !!f.is_server
}

/** El mensaje del resultado, en términos de lo que cambió. */
export function mensajeRecalculo(antes: number, despues: number): string {
  const n = (v: number) => v.toLocaleString('es-CR')
  if (antes === despues) return `Sin cambios: siguen siendo ${n(despues)}.`
  const dif = despues - antes
  return `Actualizada: ${n(antes)} → ${n(despues)} (${dif > 0 ? '+' : ''}${dif}).`
}
