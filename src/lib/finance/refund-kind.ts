// FIN-6 · De qué tipo es una devolución. Se DERIVA del pago original, nunca se
// pide a mano: el pago ya sabe de dónde vino.
//
// Reusa `paymentKind` y le agrega una distinción que el pago no hace: una
// matrícula cuyo plan es de nivel 'campanas' es una CAMPAÑA, no un estudio
// regular. `payments.concept` no tiene valor para campaña (sus 4 valores son
// matricula/folletos/evento/prematrimonial), así que sale del plan.
//
// Nota de alcance: la spec de FIN-6 mencionaba también "actividad" como tipo,
// pero no existe en el modelo — no hay concepto ni entidad que la represente.
// Queda fuera a propósito; si aparece, se agrega acá y al CHECK de refunds.kind.

import { paymentKind, type PaymentForLabel } from './payment-label'

/** Valores del CHECK de refunds.kind. Sin ñ, como el resto del esquema. */
export type RefundKind = 'estudio' | 'campana' | 'evento' | 'prematrimonial' | 'folletos' | 'otro'

export const REFUND_KINDS: RefundKind[] = [
  'estudio', 'campana', 'evento', 'prematrimonial', 'folletos', 'otro',
]

const KIND_LABEL: Record<RefundKind, string> = {
  estudio: 'Estudio',
  campana: 'Campaña',
  evento: 'Evento',
  prematrimonial: 'Prematrimonial',
  folletos: 'Folletos',
  otro: 'Otro',
}

export function refundKindLabel(kind: string | null | undefined): string {
  return KIND_LABEL[(kind ?? 'otro') as RefundKind] ?? 'Otro'
}

export type PaymentForRefundKind = PaymentForLabel & {
  /** Nivel del plan del grupo (study_plans.level). 'campanas' ⇒ campaña. */
  plan_level?: string | null
}

/** Tipo de la devolución a partir del pago que la origina. */
export function refundKindFromPayment(p: PaymentForRefundKind): RefundKind {
  const base = paymentKind(p)
  // Una matrícula de un plan de campaña se reporta como campaña: para finanzas
  // es otra cosa que un nivel o una capacitación.
  if (base === 'estudio' && (p.plan_level ?? '') === 'campanas') return 'campana'
  return base
}

/** ¿Este tipo admite filtrar por plan de estudio? Solo los que salen de un plan. */
export function kindHasPlan(kind: string | null | undefined): boolean {
  return kind === 'estudio' || kind === 'campana' || kind === 'prematrimonial'
}
