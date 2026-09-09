/**
 * Relaciones posibles dentro de una unidad familiar.
 *
 * Vive acá y no en el modal porque ahora la validan tres lugares: el modal que
 * vincula, la pestaña que permite CORREGIR la relación (2026-09-10) y la API.
 * Con la lista duplicada, la API terminaría aceptando etiquetas que la UI no
 * ofrece y la pestaña mostraría un valor que su propio select no puede elegir.
 *
 * La etiqueta es relativa a la unidad, no a una persona concreta: por eso tras
 * fusionar dos familias puede haber más de un 'Titular' — y por eso hace falta
 * poder corregirlo a mano.
 */
export const RELACIONES_FAMILIARES = [
  'Titular',
  'Cónyuge',
  'Hijo/a',
  'Padre',
  'Madre',
  'Hermano/a',
  'Otro',
] as const

export type RelacionFamiliar = typeof RELACIONES_FAMILIARES[number]

export function esRelacionValida(v: unknown): v is RelacionFamiliar {
  return typeof v === 'string' && (RELACIONES_FAMILIARES as readonly string[]).includes(v)
}
