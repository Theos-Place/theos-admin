/**
 * Mover un elemento dentro de una lista del editor de formularios: las opciones
 * de un campo, o los campos del lienzo.
 *
 * BUG 2026-09-09: las dos listas mostraban un ícono de agarre (GripVertical con
 * cursor-grab) en cada fila. En las opciones no había NADA conectado —prometía
 * arrastre y no se movían, había que borrar y volver a escribir—; en los campos
 * el arrastre sí funcionaba, pero el drag de HTML5 no existe en táctil, así que
 * desde el celular tampoco se podía reordenar. De ahí las flechas.
 */

/** Devuelve una copia con el elemento de `desde` puesto en `hasta`.
 *  Si algún índice se sale de la lista, devuelve la lista igual. */
export function moverElemento<T>(lista: readonly T[], desde: number, hasta: number): T[] {
  const copia = [...lista]
  if (desde === hasta) return copia
  if (desde < 0 || desde >= copia.length) return copia
  if (hasta < 0 || hasta >= copia.length) return copia
  const [movido] = copia.splice(desde, 1)
  copia.splice(hasta, 0, movido)
  return copia
}

/** Igual que moverElemento, pero además renumera `sort_order` según la posición
 *  nueva. Los campos del formulario se guardan por ese número, así que moverlos
 *  sin renumerar deja el orden viejo en la base. */
export function moverCampo<T extends { sort_order?: number }>(
  campos: readonly T[],
  desde: number,
  hasta: number,
): T[] {
  return moverElemento(campos, desde, hasta).map((campo, i) => ({ ...campo, sort_order: i }))
}

/** ¿Se puede subir el elemento de esta posición? (el primero no) */
export function puedeSubir(indice: number): boolean {
  return indice > 0
}

/** ¿Se puede bajar el elemento de esta posición? (el último no) */
export function puedeBajar(indice: number, total: number): boolean {
  return indice < total - 1
}
