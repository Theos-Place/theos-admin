/**
 * Cuándo se puede borrar un comunicado.
 *
 * La pantalla de comunicaciones tenía tres pestañas y en la de borradores no
 * había forma de sacar nada: quedaron 14 acumulados —pruebas del cron,
 * invitaciones duplicadas, un "Prueba final del cron (borrar)" de agosto— y la
 * única acción disponible era "Continuar editando".
 *
 * La regla es corta: solo un BORRADOR se borra. Un programado primero se
 * cancela (eso ya existe y lo devuelve a borrador), y uno que ya salió es
 * historial: hay gente que recibió ese correo y borrar la fila no lo
 * desenvía, solo deja de poder responder a quién le llegó qué.
 */

export type EstadoComunicado = 'draft' | 'scheduled' | 'sending' | 'sent' | 'partial' | 'failed'

export type MotivoNoBorrable =
  | 'programado'   // tiene fecha puesta: cancelarlo primero
  | 'en_curso'     // se está enviando ahora mismo
  | 'ya_salio'     // es historial de envíos reales
  | 'tiene_envios' // hay filas en message_logs: salió algo aunque el estado diga otra cosa

export const MENSAJE_NO_BORRABLE: Record<MotivoNoBorrable, string> = {
  programado: 'Este comunicado está programado. Cancelá el envío primero y después borralo.',
  en_curso: 'Este comunicado se está enviando en este momento.',
  ya_salio: 'Un comunicado que ya se envió no se borra: es el registro de a quién le llegó.',
  tiene_envios: 'Este comunicado tiene envíos registrados y no se puede borrar.',
}

/** Solo por el estado (lo que sabe la UI antes de pedir el borrado). */
export function sePuedeBorrar(estado: string): { ok: true } | { ok: false; error: MotivoNoBorrable } {
  if (estado === 'draft') return { ok: true }
  if (estado === 'scheduled') return { ok: false, error: 'programado' }
  if (estado === 'sending') return { ok: false, error: 'en_curso' }
  return { ok: false, error: 'ya_salio' }
}

/**
 * Con el conteo de envíos ya consultado (lo que sabe el servidor).
 *
 * El conteo se mira aunque el estado diga 'draft': la regla del repo es no
 * borrar nada con referencias, y un borrador con filas en message_logs
 * significa que algo salió y el estado quedó mal.
 */
export function sePuedeBorrarEnServidor(
  estado: string, enviosRegistrados: number,
): { ok: true } | { ok: false; error: MotivoNoBorrable; envios?: number } {
  const porEstado = sePuedeBorrar(estado)
  if (!porEstado.ok) return porEstado
  if (enviosRegistrados > 0) return { ok: false, error: 'tiene_envios', envios: enviosRegistrados }
  return { ok: true }
}

/** Texto del modal de confirmación. Uno o varios. */
export function textoDeConfirmacion(cuantos: number): string {
  return cuantos === 1
    ? 'Se va a borrar este borrador. No se puede deshacer.'
    : `Se van a borrar ${cuantos} borradores. No se puede deshacer.`
}

/** Resumen del resultado de un borrado en tanda. */
export function resumenDelBorrado(borrados: number, fallados: number): string {
  if (fallados === 0) return borrados === 1 ? 'Borrador eliminado.' : `${borrados} borradores eliminados.`
  if (borrados === 0) return 'No se pudo borrar ninguno.'
  return `${borrados} borradores eliminados; ${fallados} no se pudieron borrar.`
}
