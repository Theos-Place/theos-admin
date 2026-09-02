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

export const PAYMENT_STATUS_LABEL: Record<PaymentStatusV2, string> = {
  paid: 'Pagado',
  pending: 'Pendiente',
  refunded: 'Devuelto',
  partial_refund: 'Devolución parcial',
  cancelado: 'Cancelado',
  failed: 'Fallido',
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
