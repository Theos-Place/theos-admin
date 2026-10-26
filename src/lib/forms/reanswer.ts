/**
 * FRM-7 · Formularios de actividades sociales (pedido 2026-10-26, urgente:
 * la publicidad ya estaba en la calle).
 *
 * DOS COSAS, las dos puras:
 *
 * 1. EL MISMO LINK SIRVE CON O SIN CUENTA. La publicidad salió con
 *    `/formularios/<id>/responder` (el módulo, que el proxy manda al login
 *    siempre) y la página pública vive en `/formulario/<id>` (singular). Al
 *    marcar «se puede contestar sin cuenta» nadie reimprime los afiches, así
 *    que el proxy traduce: sin sesión, `/formularios/<id>` y
 *    `/formularios/<id>/responder` van a `/formulario/<id>`. Si el formulario
 *    sigue pidiendo cuenta, esa página ofrece el login y vuelve a
 *    `/formularios/<id>/responder`. Nunca hay «link viejo» y «link nuevo».
 *
 * 2. RESPONDER DE NUEVO EN ACTIVIDADES RECURRENTES. El mismo formulario se
 *    reutiliza para cada edición (Calles de febrero, Calles de octubre…) y
 *    decía «ya respondiste». Con «permitir responder más de una vez», se
 *    acepta otra respuesta pasados N días de la última (default 2: hay
 *    actividades con dos ediciones en el mismo mes, así que la ventana solo
 *    frena el doble envío accidental). Cada respuesta es un registro NUEVO
 *    con su fecha. A quien aún no puede se le dice CUÁNDO.
 */

import { formatDateLong, ymdCR } from '@/lib/format'

export const DIAS_ENTRE_RESPUESTAS_POR_DEFECTO = 2

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const RUTA_DEL_MODULO = new RegExp(`^/formularios/(${UUID})(?:/responder)?/?$`, 'i')

/** La página pública equivalente a un link del módulo, o null si no aplica. */
export function rutaPublicaDesdeModulo(pathname: string): string | null {
  const m = RUTA_DEL_MODULO.exec(pathname)
  return m ? `/formulario/${m[1].toLowerCase()}` : null
}

/** A dónde mandar a quien SÍ tiene cuenta desde la página pública. */
export function rutaConCuenta(formId: string): string {
  return `/formularios/${formId}/responder`
}

export type VeredictoDeReenvio =
  | { ok: true }
  | { ok: false; desde: string }

/**
 * ¿Se acepta otra respuesta?
 *  · Sin `permiteVarias`: una sola, como siempre (si ya hay una, no).
 *  · Con `permiteVarias`: sí, salvo que la última sea más reciente que `dias`.
 */
export function puedeResponderDeNuevo(input: {
  permiteVarias: boolean
  ultimaRespuesta: string | Date | null | undefined
  dias?: number | null
  ahora?: Date
}): VeredictoDeReenvio {
  if (!input.ultimaRespuesta) return { ok: true }
  const ultima = new Date(input.ultimaRespuesta)
  if (isNaN(ultima.getTime())) return { ok: true }
  if (!input.permiteVarias) return { ok: false, desde: 'nunca' }
  const dias = Number.isFinite(input.dias) && (input.dias as number) >= 0 ? (input.dias as number) : DIAS_ENTRE_RESPUESTAS_POR_DEFECTO
  const desde = new Date(ultima.getTime() + dias * 86_400_000)
  const ahora = input.ahora ?? new Date()
  return ahora >= desde ? { ok: true } : { ok: false, desde: desde.toISOString() }
}

/** El mensaje para quien aún no puede: dice cuándo, no un rechazo seco. */
export function mensajeDeEspera(desdeIso: string): string {
  const d = new Date(desdeIso)
  // Día en hora de Costa Rica, con el formateador central (formato único).
  const fecha = isNaN(d.getTime()) ? '' : formatDateLong(ymdCR(d))
  return fecha
    ? `Ya te inscribiste a esta actividad; podrás volver a inscribirte después del ${fecha}.`
    : 'Ya te inscribiste a esta actividad; podrás volver a inscribirte más adelante.'
}
