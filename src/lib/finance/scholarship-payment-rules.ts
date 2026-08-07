// BEC-1: reglas puras de "aplicar beca/cupón a un pago pendiente" (modal de
// pagos). Sin Supabase: la ruta /api/payments/[id]/apply-scholarship resuelve
// los datos y delega acá las decisiones, así quedan testeables en node.

import { currencyDecimals } from '@/lib/format'
import type { DiscountType } from '@/lib/supabase/queries/scholarships'

export type PaymentForScholarship = {
  status: string
  scholarship_id: string | null
  member_id: string | null
  concept: string | null
  study_group_id: string | null
  event_id: string | null
}

export type EligibilityError =
  | 'pago_no_pendiente'   // solo pagos pending (rechazado con comprobante cuenta como pending)
  | 'pago_ya_con_beca'    // un pago admite UNA beca
  | 'pago_sin_miembro'    // sin miembro no hay a quién validar la beca
  | 'concepto_no_aplica'  // becas solo existen para study_plan/event

/** ¿El pago admite aplicar una beca/cupón? Devuelve el destino de la beca
 *  (tipo de entidad) o el código de error. El plan concreto del grupo lo
 *  resuelve el caller (requiere BD). */
export function checkPaymentScholarshipEligibility(
  p: PaymentForScholarship,
): { ok: true; entityType: 'study_plan' | 'event' } | { ok: false; error: EligibilityError } {
  if (p.status !== 'pending') return { ok: false, error: 'pago_no_pendiente' }
  if (p.scholarship_id) return { ok: false, error: 'pago_ya_con_beca' }
  if (!p.member_id) return { ok: false, error: 'pago_sin_miembro' }
  if (p.concept === 'matricula' && p.study_group_id) return { ok: true, entityType: 'study_plan' }
  if (p.concept === 'evento' && p.event_id) return { ok: true, entityType: 'event' }
  return { ok: false, error: 'concepto_no_aplica' }
}

/** Monto resultante de aplicar el descuento. `covered` = beca completa: el
 *  pago baja a 0 y se aprueba sin comprobante (el objeto pagado se libera
 *  igual que con approve_payment).
 *
 *  INT-3: el redondeo va según la moneda. Antes era Math.round fijo, que asume
 *  colones: un 10% sobre €25,50 daba €23 en vez de €22,95 — se comía los
 *  céntimos. En colones el resultado es idéntico al de antes. */
export function computeApplication(
  amount: number, type: DiscountType, value: number, currency: string | null = 'CRC',
): { amount: number; covered: boolean } {
  const bruto = type === 'percentage' ? amount * (1 - value / 100) : amount - value
  const f = 10 ** currencyDecimals(currency)
  const discounted = Math.max(0, Math.round(bruto * f) / f)
  return { amount: discounted, covered: discounted === 0 }
}

/** Un descuento de monto FIJO solo aplica si la beca y el pago están en la
 *  misma moneda (INT-2); los porcentuales no dependen de la moneda. */
export function currencyMismatch(
  type: DiscountType, scholarshipCurrency: string | null, paymentCurrency: string | null,
): boolean {
  if (type !== 'fixed') return false
  return (scholarshipCurrency ?? 'CRC') !== (paymentCurrency ?? 'CRC')
}

/** ¿Se puede mandar el correo de cupón/beca? (botón "Enviar por correo"). */
export function checkCouponEmailSendable(
  s: { kind: 'asignada' | 'generica'; status: string; expires_at: string | null; member_id: string | null },
  requestedMemberId: string | null,
  now: Date,
): { ok: true; memberId: string } | { ok: false; error: 'no_activa' | 'vencida' | 'miembro_requerido' } {
  if (s.status !== 'active') return { ok: false, error: 'no_activa' }
  if (s.expires_at && new Date(s.expires_at).getTime() < now.getTime()) return { ok: false, error: 'vencida' }
  // Asignada: el destinatario es su dueño; genérica: hay que indicar a quién.
  const memberId = s.kind === 'asignada' ? s.member_id : requestedMemberId
  if (!memberId) return { ok: false, error: 'miembro_requerido' }
  return { ok: true, memberId }
}
