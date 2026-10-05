/**
 * Por qué un cobro no se cobró (módulo puro).
 *
 * Hasta el 2026-09-02 todo lo que no se cobraba caía en 'failed', y eso metía
 * en el mismo balde dos cosas que no se parecen ni se atienden igual:
 *
 *   · CANCELADO — la persona cerró la matrícula, se inscribió por error, se
 *     cambió de grupo, o se le venció el plazo para subir el comprobante.
 *     Es un desenlace normal. No hay nada que arreglar.
 *
 *   · FALLIDO — el sistema no pudo procesar el cobro. Eso sí es un problema y
 *     alguien tiene que mirarlo.
 *
 *   Los 6 casos que existían en producción eran cancelaciones, los 6. La
 *   pantalla decía "3 pagos fallidos" y hacía pensar en un problema técnico
 *   que no existía.
 */

export const PAYMENT_STATUSES = [
  'paid', 'pending', 'refunded', 'partial_refund', 'cancelado', 'failed',
] as const
export type PaymentStatusV2 = (typeof PAYMENT_STATUSES)[number]

/**
 * PAG-6 · LA MISMA PALABRA SIGNIFICA DOS COSAS OPUESTAS, así que hay dos
 * juegos de etiquetas. Decidido con Floriana el 2026-10-05.
 *
 * En contabilidad costarricense «cancelar» es PAGAR: Andrés concilia contra
 * el estado de cuenta y a un cobro pagado le dice cancelado. Para cualquier
 * otra persona, «cancelado» es ANULADO — lo contrario.
 *
 * Mandar una sola etiqueta obligaba a elegir a quién confundir. Con dos:
 *
 *  · FINANZAS ve `paid` como «Cancelado» (el término de Andrés) y el estado
 *    `cancelado` como «Anulado», que libera la palabra. Sin ese segundo
 *    cambio quedarían DOS «Cancelado» en la pantalla de conciliación y no se
 *    distinguirían los 239 cobrados de los 30 anulados (medido en producción
 *    el 2026-10-02).
 *  · LA PERSONA sigue viendo «Pagado» en Mis pagos. Decirle «Cancelado»
 *    sobre un pago suyo le haría creer que se lo anularon.
 *
 * LOS VALORES DE LA BASE NO CAMBIAN. Esto es solo cómo se escriben, y por eso
 * el renombre se deshace en una línea si hace falta.
 */
export const PAYMENT_STATUS_LABEL: Record<PaymentStatusV2, string> = {
  paid: 'Pagado',
  pending: 'Pendiente',
  refunded: 'Devuelto',
  partial_refund: 'Devolución parcial',
  cancelado: 'Anulado',
  failed: 'Fallido',
}

/** Las etiquetas para las pantallas de FINANZAS. Ver el comentario de arriba. */
export const PAYMENT_STATUS_LABEL_FINANZAS: Record<PaymentStatusV2, string> = {
  ...PAYMENT_STATUS_LABEL,
  paid: 'Cancelado',
}

/**
 * La etiqueta según quién mira.
 *
 * `audiencia` es obligatoria a propósito: sin un valor por defecto, una
 * pantalla nueva tiene que decidir para quién escribe en vez de heredar en
 * silencio la de finanzas y decirle «Cancelado» a un miembro.
 */
export function etiquetaDeEstado(
  status: string,
  audiencia: 'finanzas' | 'persona',
): string {
  const mapa = audiencia === 'finanzas' ? PAYMENT_STATUS_LABEL_FINANZAS : PAYMENT_STATUS_LABEL
  return mapa[status as PaymentStatusV2] ?? status
}

/** ¿Este desenlace merece que alguien lo mire? Solo el error del sistema: una
 *  cancelación es una decisión, no una avería. */
export function requiereAtencion(status: string): boolean {
  return status === 'failed'
}

/** ¿El cobro sigue vivo? Un cobro cancelado o fallido no sostiene nada — ni la
 *  matrícula ni la inscripción a un evento. */
export function cobroVivo(status: string): boolean {
  return status === 'pending' || status === 'paid'
}

/** El motivo por defecto según quién cortó el cobro. Se guarda en el pago para
 *  que dentro de seis meses se sepa por qué quedó así. */
export const MOTIVO_CANCELACION = {
  persona: 'La persona canceló la matrícula',
  plazo: 'Se venció el plazo para subir el comprobante',
  admin: 'Se cerró el cobro sin cobrarlo',
  retiro: 'Se retiró del estudio',
} as const
