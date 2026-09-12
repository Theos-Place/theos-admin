/**
 * Mover una beca asignada a OTRO estudio/evento.
 *
 * El caso que lo motiva (2026-09-11): dos personas pidieron beca para Romanos,
 * se les aprobó, y el único grupo abierto de Romanos se llenó (10/10) antes de
 * que se matricularan. La beca queda viva pero inservible: `findApplicableScholarship`
 * la busca por plan_id, así que en cualquier otro estudio no aparece.
 *
 * Sin esto la única salida era revocar y volver a aprobar a mano, lo que borra
 * el vínculo con la solicitud original (request_id) y el historial de aprobación.
 *
 * Lo que NO es obvio y por eso vive acá: al aprobar se CONGELAN el costo del
 * destino, el saldo y si la beca es total o parcial (FIN-5). Mover la beca sin
 * recalcular esos tres deja una beca que dice "cubre todo" sobre un estudio más
 * caro. El destino nuevo los vuelve a derivar.
 */
import { previewApproval } from './scholarship-approval'
import { formatMoney } from '@/lib/format'
import type { PaymentBreakdown } from './payment-breakdown'
import type { DiscountType } from '@/lib/supabase/queries/scholarships'

export type EntityType = 'study_plan' | 'event'
export type ApprovalType = 'total' | 'parcial'

export type BecaParaMover = {
  kind: 'asignada' | 'generica'
  status: 'active' | 'used' | 'revoked'
  entity_type: EntityType
  plan_id: string | null
  event_id: string | null
  discount_type: DiscountType
  discount_value: number
  currency: string | null
  /** Redenciones registradas (cupones) — una asignada usada ya viene en status. */
  used_count: number
}

/** El destino nuevo, con su precio y moneda ya resueltos. */
export type DestinoNuevo = {
  entity_type: EntityType
  id: string
  nombre: string
  currency: string | null
  cost: number | null
}

export type MotivoBloqueo =
  | 'no_activa'         // usada o revocada: mover una beca gastada la reviviría
  | 'cupon_generico'    // el código ya circula; cambiarle el destino rompe los que lo tienen
  | 'mismo_destino'     // no hay nada que mover
  | 'moneda_distinta'   // monto fijo en otra moneda (INT-2): no se puede aplicar

export const MENSAJE_BLOQUEO: Record<MotivoBloqueo, string> = {
  no_activa: 'Solo se puede mover una beca activa: esta ya se usó o fue revocada.',
  cupon_generico: 'Los cupones con código no se mueven: el código ya está en manos de la gente. Revocalo y creá uno nuevo.',
  mismo_destino: 'La beca ya está asignada a ese estudio.',
  moneda_distinta: 'La beca es de un monto fijo en otra moneda y no se puede aplicar a ese destino.',
}

/** ¿Esta beca admite que le cambien el destino? (sin mirar cuál sería). */
export function puedeMoverse(b: BecaParaMover): { ok: true } | { ok: false; error: MotivoBloqueo } {
  if (b.kind === 'generica') return { ok: false, error: 'cupon_generico' }
  if (b.status !== 'active') return { ok: false, error: 'no_activa' }
  if (b.used_count > 0) return { ok: false, error: 'no_activa' }
  return { ok: true }
}

export type CamposDelCambio = {
  entity_type: EntityType
  plan_id: string | null
  event_id: string | null
  currency: string
  /** Recongelados contra el precio del destino nuevo (FIN-5). */
  original_amount: number | null
  final_amount: number | null
  approval_type: ApprovalType
}

export type Movimiento =
  | { ok: true; campos: CamposDelCambio; breakdown: PaymentBreakdown | null }
  | { ok: false; error: MotivoBloqueo }

/**
 * Valida el movimiento y devuelve los campos a escribir.
 *
 * Un porcentaje es portable (50% es 50% de lo que valga el destino nuevo); un
 * monto fijo solo lo es dentro de la misma moneda, que es la misma regla que ya
 * aplica `currencyMismatch` al momento de pagar. Si no se validara acá, la beca
 * se movería y recién fallaría cuando la persona intenta matricularse.
 */
export function planearMovimiento(b: BecaParaMover, d: DestinoNuevo): Movimiento {
  const permitido = puedeMoverse(b)
  if (!permitido.ok) return permitido

  const actual = b.entity_type === 'study_plan' ? b.plan_id : b.event_id
  if (b.entity_type === d.entity_type && actual === d.id) return { ok: false, error: 'mismo_destino' }

  const monedaDestino = d.currency ?? 'CRC'
  if (b.discount_type === 'fixed' && (b.currency ?? 'CRC') !== monedaDestino) {
    return { ok: false, error: 'moneda_distinta' }
  }

  const preview = previewApproval({
    cost: d.cost, currency: monedaDestino,
    discountType: b.discount_type, discountValue: b.discount_value,
  })

  return {
    ok: true,
    breakdown: preview.breakdown,
    campos: {
      entity_type: d.entity_type,
      plan_id: d.entity_type === 'study_plan' ? d.id : null,
      event_id: d.entity_type === 'event' ? d.id : null,
      currency: monedaDestino,
      original_amount: preview.breakdown?.price ?? null,
      final_amount: preview.breakdown?.final ?? null,
      approval_type: preview.breakdown ? preview.approval_type : 'parcial',
    },
  }
}

/**
 * Lo que hay que decirle a quien mueve la beca ANTES de confirmar.
 *
 * El caso feo es una beca aprobada como "cubre todo" que en el destino nuevo
 * deja saldo: la persona ya recibió un correo diciéndole que no paga nada. No
 * se bloquea —la decisión es de finanzas— pero no puede pasar en silencio.
 */
export function avisoDelCambio(
  b: BecaParaMover, d: DestinoNuevo, m: Movimiento,
): string | null {
  if (!m.ok) return null
  const antes = b.discount_type === 'percentage' && b.discount_value >= 100
  if (!m.breakdown) {
    return `No sabemos cuánto cuesta ${d.nombre}, así que no se puede mostrar cuánto quedaría por pagar.`
  }
  if (m.campos.approval_type === 'parcial' && antes) {
    return `La beca era del 100% y en ${d.nombre} queda un saldo de ${formatMoney(m.breakdown.final, m.campos.currency)} por pagar. A la persona se le avisó que no pagaba nada.`
  }
  if (m.campos.approval_type === 'parcial') {
    return `En ${d.nombre} le quedan ${formatMoney(m.breakdown.final, m.campos.currency)} por pagar.`
  }
  if (b.discount_type === 'fixed' && m.breakdown.price < b.discount_value) {
    return `El descuento (${formatMoney(b.discount_value, m.campos.currency)}) es mayor que el costo de ${d.nombre} (${formatMoney(m.breakdown.price, m.campos.currency)}): cubre todo y la diferencia no se devuelve.`
  }
  return null
}
