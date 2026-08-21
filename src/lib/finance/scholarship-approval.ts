// FIN-5 · Resolver una solicitud de beca: 100%, 50%, porcentaje libre, monto
// fijo, o rechazo.
//
// Módulo puro y client-safe: la misma cuenta alimenta la VISTA PREVIA que ve
// finanzas antes de aprobar y el monto que se congela al aprobar. Si fueran dos
// cuentas distintas, finanzas aprobaría viendo un número y se guardaría otro.

import { buildPaymentBreakdown, type PaymentBreakdown } from './payment-breakdown'
import type { DiscountType } from '@/lib/supabase/queries/scholarships'

export type ApprovalType = 'total' | 'parcial'

/** Atajos de la UI. 'otro' abre el input libre (porcentaje o monto). */
export const QUICK_PERCENTAGES = [100, 50] as const

export type ApprovalPreview = {
  breakdown: PaymentBreakdown | null
  /** Derivado de la cobertura real, NO elegido a mano. */
  approval_type: ApprovalType
  /** Motivo por el que no se puede aprobar así (null = se puede). */
  error: 'valor_invalido' | 'sin_costo' | 'porcentaje_fuera_de_rango' | 'monto_mayor_al_costo' | null
}

/**
 * Vista previa de una aprobación: cuánto cubre y cuánto queda por pagar.
 *
 * `approval_type` se DERIVA de la cobertura: si el descuento deja el saldo en
 * 0 es 'total', si no es 'parcial'. Antes se elegía a mano en la UI, así que se
 * podía guardar "total" con un 50% — un dato que se contradice a sí mismo.
 *
 * `cost` null/0 = el destino no tiene costo conocido: no hay nada que prorratear.
 */
export function previewApproval(input: {
  cost: number | null | undefined
  currency?: string | null
  discountType: DiscountType
  discountValue: number | string
}): ApprovalPreview {
  const value = typeof input.discountValue === 'number'
    ? input.discountValue
    : Number(String(input.discountValue).trim())

  if (!Number.isFinite(value) || value <= 0) {
    return { breakdown: null, approval_type: 'parcial', error: 'valor_invalido' }
  }
  if (input.discountType === 'percentage' && value > 100) {
    return { breakdown: null, approval_type: 'parcial', error: 'porcentaje_fuera_de_rango' }
  }

  const cost = Number(input.cost ?? 0)
  if (!Number.isFinite(cost) || cost <= 0) {
    // Sin costo no hay vista previa, pero la beca se puede otorgar igual: un
    // porcentaje se aplica cuando el costo exista.
    return { breakdown: null, approval_type: value >= 100 && input.discountType === 'percentage' ? 'total' : 'parcial', error: 'sin_costo' }
  }

  const breakdown = buildPaymentBreakdown({
    price: cost,
    currency: input.currency ?? 'CRC',
    scholarship: { discount_type: input.discountType, discount_value: value, currency: input.currency ?? 'CRC' },
  })

  if (!breakdown) return { breakdown: null, approval_type: 'parcial', error: 'sin_costo' }

  // Un monto fijo mayor al costo se acepta (queda en 0), pero se avisa: casi
  // siempre es un cero de más al teclear.
  const error = input.discountType === 'fixed' && value > cost ? 'monto_mayor_al_costo' : null

  return {
    breakdown,
    approval_type: breakdown.covered ? 'total' : 'parcial',
    error,
  }
}

/** Etiqueta del atajo, para los botones rápidos. */
export function quickLabel(pct: number): string {
  return pct === 100 ? 'Beca completa (100%)' : `${pct}%`
}
