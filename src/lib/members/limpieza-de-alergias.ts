/**
 * Qué hacer con cada texto escrito en `members.allergies`.
 *
 * El campo es libre y recogió de todo: la alergia de verdad, una restricción
 * alimenticia, un "No" que no dice nada, y datos que se colaron de otro campo
 * del formulario (un correo, una cédula, una edad).
 *
 * Importa porque de acá sale la lista que usa quien cocina en un campamento.
 * Un "Ninguna" ocupa una fila y hace que alguien que no necesita nada aparezca
 * resaltado junto a quien sí es celíaco.
 *
 * DECISIÓN DEL USUARIO (2026-09-15): las restricciones alimenticias se dejan
 * TAL CUAL las escribieron. No se mueven al campo `dietary_restrictions`:
 * "Gluten" puede ser celiaquía o alergia de verdad y esa diferencia le importa
 * a quien cocina, así que la traducción no se hace sola.
 */

export type Veredicto =
  /** Alergia o condición real: se queda. */
  | 'alergia'
  /** Restricción alimenticia escrita a mano: se queda tal cual (decisión del usuario). */
  | 'restriccion'
  /** No dice nada ("No", "Ninguna", "none"): se borra. */
  | 'vacio'
  /** Dato de OTRO campo (correo, cédula, edad): se revisa a mano, no se borra solo. */
  | 'otro_campo'

const SIN_DATO = /^(no|ninguna|ninguno|nada|none|n\/?a|-{1,2}|\.)\.?$/i
const RESTRICCION = /celiac|gluten|lactos|vegan/i
const CORREO = /@/
/** Cédula costarricense (1-1396-0111 o 113960111) o teléfono. Nunca una alergia. */
const NUMERO = /^\+?[\d][\d\s.-]{6,}$/
/** "4 años", "7 años": la edad se coló del campo de al lado. */
const EDAD = /^\d{1,2}\s*a[ñn]os?$/i

export function clasificarAlergia(texto: string | null | undefined): Veredicto | null {
  const t = (texto ?? '').trim()
  if (!t) return null
  if (SIN_DATO.test(t)) return 'vacio'
  if (CORREO.test(t) || NUMERO.test(t) || EDAD.test(t)) return 'otro_campo'
  if (RESTRICCION.test(t)) return 'restriccion'
  return 'alergia'
}

/** Se borra solo lo que no dice nada. Todo lo demás se conserva o se revisa. */
export function seBorra(texto: string | null | undefined): boolean {
  return clasificarAlergia(texto) === 'vacio'
}

/**
 * Un dato de otro campo se borra únicamente si YA está guardado donde
 * corresponde: si no, borrarlo destruye el único rastro que hay de él. El caso
 * que lo obligó: alguien escribió su cédula ahí y tiene el campo de cédula
 * vacío — ese texto es lo único que queda.
 */
export function sePuedeDescartar(
  texto: string,
  ficha: { email?: string | null; phone?: string | null; cedula_normalized?: string | null },
): boolean {
  const t = texto.trim().toLowerCase()
  const soloDigitos = (s: string) => s.replace(/\D/g, '')
  if (ficha.email && ficha.email.trim().toLowerCase() === t) return true
  if (ficha.phone && soloDigitos(ficha.phone) === soloDigitos(t) && soloDigitos(t).length >= 7) return true
  if (ficha.cedula_normalized && soloDigitos(ficha.cedula_normalized) === soloDigitos(t) && soloDigitos(t).length >= 7) return true
  return false
}
