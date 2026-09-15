/**
 * FAM-2 Parte B · Qué cambia cuando la persona es menor de edad.
 *
 * Dos reglas, y las dos salen del mismo hecho: un menor no es su propio punto
 * de contacto. Quien responde por él es su familia.
 *
 *   1. NO se le crea cuenta de acceso. Nunca, y no solo escondiendo el botón:
 *      el endpoint la rechaza.
 *   2. NO se le exige correo ni teléfono. En los formularios donde son
 *      obligatorios, para un menor pasan a opcionales.
 *
 * SIN FECHA DE NACIMIENTO NO SE SABE, y hay 3.260 fichas así. La decisión es
 * tratar el desconocido como MAYOR para los bloqueos —no se le niega la cuenta
 * a alguien de 40 años porque falte un dato— y listarlo en el reporte de
 * revisión. Bloquear por las dudas rompería el alta de miles de personas para
 * proteger a las pocas que además son menores; el reporte los encuentra sin
 * romper nada. Es el mismo criterio que ya tenía `esMenorDe`.
 */
import { esMenorDeEdad, hoyCR } from '@/lib/members/alta-persona'

export type FichaConEdad = {
  birth_date?: string | null
  datos_protegidos?: boolean | null
}

/** Se sabe que es menor. Sin fecha: no se sabe, y acá eso es `false`. */
export function esMenor(f: FichaConEdad, hoy: string = hoyCR()): boolean {
  return esMenorDeEdad(f.birth_date ?? null, hoy)
}

/** No hay con qué decidir. Es un caso a revisar, no un menor asumido. */
export function edadDesconocida(f: FichaConEdad): boolean {
  return !f.birth_date
}

export const MOTIVO_MENOR_SIN_CUENTA =
  'No se le crea cuenta de acceso a un menor de edad. El contacto es el de su familia.'

/**
 * ¿Se le puede crear cuenta de acceso?
 *
 * Dos noes: los menores y los que tienen datos protegidos (menor-protegido.ts,
 * decisión de 2026-09-10). El segundo ya existía; el primero lo agrega FAM-2.
 */
export function puedeCrearseCuenta(f: FichaConEdad, hoy: string = hoyCR()): boolean {
  if (f.datos_protegidos) return false
  return !esMenor(f, hoy)
}

/** ¿Hay que exigirle correo o teléfono? A un menor no. */
export function exigeContacto(f: FichaConEdad, hoy: string = hoyCR()): boolean {
  return !esMenor(f, hoy) && !f.datos_protegidos
}

export const AYUDA_CONTACTO_MENOR =
  'Es menor de edad: el correo y el teléfono son opcionales. El contacto es el de su familia.'

/**
 * Un teléfono o correo que el menor tiene PRESTADO de un adulto de su familia.
 *
 * No es un dato suyo: es el número del papá o la mamá que alguien puso en un
 * formulario. Duplica el contacto, ensucia las búsquedas y hace que el dedup
 * empareje a un niño con su madre.
 *
 * Solo cuenta si el adulto de SU familia lo tiene igual. Un teléfono que no
 * coincide con nadie se queda: puede ser el celular real del adolescente.
 */
export function mismoTelefono(a: string | null | undefined, b: string | null | undefined): boolean {
  const d = (s: string | null | undefined) => String(s ?? '').replace(/\D/g, '')
  // Al menos 8 dígitos: un "123" repetido en dos fichas no prueba nada, y en
  // Costa Rica el número tiene 8.
  return d(a).length >= 8 && d(a) === d(b)
}

export function mismoCorreo(a: string | null | undefined, b: string | null | undefined): boolean {
  const n = (s: string | null | undefined) => String(s ?? '').trim().toLowerCase()
  return n(a) !== '' && n(a) === n(b)
}
