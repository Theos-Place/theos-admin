/**
 * ¿El correo de esta ficha es de la PERSONA o se lo prestó un adulto?
 *
 * Es la pregunta que separa los dos problemas que viven mezclados en DAT-8:
 *
 *  · El correo lleva el nombre de la propia persona («andres.herreram1802@»
 *    en una ficha que dice tener 5 años) → lo que está mal es la FECHA, no el
 *    correo. Es un adulto con la fecha mal digitada.
 *  · El correo lleva otro nombre, o es idéntico al de un adulto del padrón
 *    («cristellopeztorres@» en la ficha de Camilia Sanabria) → sí es menor y el
 *    correo es de su mamá. Ahí lo que falta es la familia.
 *
 * Tratarlos igual es el error: a uno hay que arreglarle la fecha y al otro
 * vincularle la familia. Quitarle el correo al primero lo deja incomunicado.
 */

function norm(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/** La parte de antes del @, sin puntos, guiones ni números. */
export function usuarioDelCorreo(email: string | null | undefined): string {
  return norm(String(email ?? '').split('@')[0]).replace(/[._\-+0-9]/g, '')
}

/**
 * ¿El usuario del correo contiene el NOMBRE DE PILA de la persona?
 *
 * Solo el nombre, nunca el apellido: madre e hijo comparten apellido, así que
 * `cristellopeztorres@` daría por suyo el correo de la ficha de Camilia
 * Sanabria LOPEZ. Es el mismo error que ya advertía el brief de DAT-8 —"39 solo
 * comparten un apellido con alguien que tiene familia; eso no es evidencia"— y
 * acá se cuela por la puerta del correo.
 *
 * Se piden 4 letras como mínimo por pedazo: "ana" aparece dentro de demasiadas
 * palabras ("mariana", "juana") y daría falsos positivos en las dos
 * direcciones.
 */
export function correoPareceDeLaPersona(
  email: string | null | undefined,
  firstName: string,
): boolean {
  const u = usuarioDelCorreo(email)
  if (u.length < 4) return false
  return firstName
    .split(/\s+/)
    .map(norm)
    .filter(p => p.length >= 4)
    .some(p => u.includes(p))
}

export type Veredicto =
  /** El correo es suyo → la fecha es lo que está mal. */
  | 'la_fecha_esta_mal'
  /** El correo es de un adulto identificado → falta vincular la familia. */
  | 'correo_prestado'
  /** No se puede decir con lo que hay. */
  | 'a_mano'

export function deQuienEsElCorreo(f: {
  email: string | null
  first_name: string
  last_name: string
  /** Nombre del adulto del padrón que tiene EXACTAMENTE ese correo, si existe. */
  adultoConElMismoCorreo?: string | null
  /** Nombre del adulto que comparte teléfono, si existe. */
  adultoConElMismoTelefono?: string | null
}): Veredicto {
  if (correoPareceDeLaPersona(f.email, f.first_name)) return 'la_fecha_esta_mal'
  if (f.adultoConElMismoCorreo || f.adultoConElMismoTelefono) return 'correo_prestado'
  return 'a_mano'
}
