/**
 * Buscar una dirección de correo SIN que se cuele un comodín.
 *
 * BUG 2026-09-09 (caso Paola Castillo Sibaja): el endpoint de "olvidé mi
 * contraseña" buscaba al miembro con `.ilike('email', identifier)`. En LIKE /
 * ILIKE el guion bajo es un COMODÍN de un carácter, así que `paoc_27@hotmail.com`
 * también calzaba con `paocq27@hotmail.com` — otra persona real. Como la consulta
 * llevaba `.limit(1)` sin orden, la base devolvía a la otra Paola primero: durante
 * semanas ella pidió el enlace y el correo se le fue a una desconocida. En
 * producción había 2 pares de direcciones que se confunden así.
 *
 * El mismo comodín afectaba la supresión por rebote: un bounce de `paocq27`
 * marcaba a AMBAS como correo malo.
 *
 * Se usa ILIKE (no `eq`) a propósito, porque en la BD las direcciones están
 * guardadas con mayúsculas y minúsculas mezcladas y hay que comparar sin
 * distinguir. Lo que se arregla es el patrón, no el operador.
 */

/** Escapa los metacaracteres de LIKE para que el texto se compare literal.
 *  `\` es el carácter de escape por defecto de Postgres, así que va primero. */
export function escaparLike(texto: string): string {
  return texto.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/** Dirección normalizada y lista para usar como patrón ILIKE exacto. */
export function patronDeCorreo(email: string): string {
  return escaparLike(email.trim().toLowerCase())
}

/** ¿Son la misma dirección? Comparación exacta, sin comodines ni mayúsculas. */
export function esMismoCorreo(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}
