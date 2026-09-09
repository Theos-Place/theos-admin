/**
 * Qué puede tocar el equipo de check-in sobre una ficha, y nada más.
 *
 * El rol encargado_eventos NO tiene el módulo de miembros y no lo va a tener:
 * no ve el padrón, no lo filtra, no lo exporta. Pero en la fila de un evento
 * necesita dos cosas puntuales, con la persona enfrente:
 *
 *   · dar de alta a quien llegó y no está en el sistema;
 *   · corregirle el documento o el teléfono cuando la pantalla avisa que faltan.
 *
 * Este módulo fija esas dos listas de campos. Los endpoints acotados
 * (/api/events/[id]/members) construyen el payload SOLO con lo que sale de acá,
 * así que abrirle un campo más al rol exige tocar esta lista — y este archivo
 * tiene tests que cuentan cuáles son.
 */

/** Lo único que se puede mandar al crear una ficha desde la fila. */
export const CAMPOS_ALTA_CHECKIN = [
  'first_name',
  'last_name',
  'phone',
  'email',
  'cedula',
  'document_type',
  'birth_date',
] as const

/** Lo único que se puede corregir de una ficha existente desde la fila.
 *
 *  El documento porque es lo que la pantalla reclama para poder matricular y
 *  cobrar después; el teléfono porque es el otro dato que se corrige de viva
 *  voz. Nada del resto del perfil: ni el correo (cambia el acceso a la cuenta),
 *  ni is_active, ni notas, ni nada de gestión. */
export const CAMPOS_CORRECCION_CHECKIN = [
  'cedula',
  'document_type',
  'phone',
] as const

export type CampoAlta = typeof CAMPOS_ALTA_CHECKIN[number]
export type CampoCorreccion = typeof CAMPOS_CORRECCION_CHECKIN[number]

/** Deja del cuerpo recibido SOLO las claves permitidas. Lo que no está en la
 *  lista no se ignora en silencio a medias: no llega nunca a la base. */
export function soloCamposPermitidos<T extends string>(
  cuerpo: unknown,
  permitidos: readonly T[],
): Partial<Record<T, unknown>> {
  const salida: Partial<Record<T, unknown>> = {}
  if (!cuerpo || typeof cuerpo !== 'object') return salida
  const obj = cuerpo as Record<string, unknown>
  for (const k of permitidos) if (k in obj) salida[k] = obj[k]
  return salida
}

/** Los campos del cuerpo que NO están permitidos. Sirve para responder 400 con
 *  el detalle en vez de guardar a medias y dejar a alguien creyendo que cambió
 *  algo que no cambió. */
export function camposRechazados<T extends string>(
  cuerpo: unknown,
  permitidos: readonly T[],
): string[] {
  if (!cuerpo || typeof cuerpo !== 'object') return []
  const set = new Set<string>(permitidos as readonly string[])
  return Object.keys(cuerpo as Record<string, unknown>).filter(k => !set.has(k))
}
