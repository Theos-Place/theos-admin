/**
 * Mover una opción dentro de la lista de un campo de formulario.
 *
 * BUG 2026-09-09: el editor mostraba un ícono de agarre (GripVertical con
 * cursor-grab) al lado de cada opción, pero no había nada conectado: prometía
 * que se podían arrastrar y no se movían. La única salida era borrar la opción
 * y volver a escribirla al final.
 */

/** Devuelve una copia con el elemento de `desde` puesto en `hasta`.
 *  Si algún índice se sale de la lista, devuelve la lista igual. */
export function moverOpcion<T>(opciones: readonly T[], desde: number, hasta: number): T[] {
  const copia = [...opciones]
  if (desde === hasta) return copia
  if (desde < 0 || desde >= copia.length) return copia
  if (hasta < 0 || hasta >= copia.length) return copia
  const [movida] = copia.splice(desde, 1)
  copia.splice(hasta, 0, movida)
  return copia
}

/** ¿Se puede subir esta opción? (la primera no) */
export function puedeSubir(indice: number): boolean {
  return indice > 0
}

/** ¿Se puede bajar esta opción? (la última no) */
export function puedeBajar(indice: number, total: number): boolean {
  return indice < total - 1
}
