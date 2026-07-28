// PAG-3: qué pagos ameritan recordatorio. Módulo puro.
//   · status 'pending' (el miembro debe actuar);
//   · en_revision NO se recuerda: la pelota está en finanzas, no del miembro;
//   · comprobante RECHAZADO solo dentro de la ventana de 72h del cron
//     payment-holds-expire — pasado eso el pago va a expirar igual y recordarlo
//     sería ruido.

export const REMINDER_REJECTED_WINDOW_HOURS = 72

export function isRemindablePayment(
  p: { status: string; review_status: string | null; reviewed_at: string | null },
  nowIso: string,
): boolean {
  if (p.status !== 'pending') return false
  if (p.review_status === 'en_revision') return false
  if (p.review_status === 'rechazado') {
    if (!p.reviewed_at) return true
    const age = Date.parse(nowIso) - Date.parse(p.reviewed_at)
    return age < REMINDER_REJECTED_WINDOW_HOURS * 3600_000
  }
  return true
}
