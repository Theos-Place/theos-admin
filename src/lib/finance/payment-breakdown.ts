// FIN-3 · Desglose de lo que hay que pagar: precio, descuento de beca y MONTO
// FINAL. Módulo puro y usable desde el cliente (no importa supabase ni
// next/server), porque el reclamo de finanzas es justamente que la gente
// transfiere montos equivocados: el desglose tiene que verse ANTES de pagar.
//
// Es la ÚNICA fuente del cálculo y de la etiqueta del descuento. Antes había
// tres copias de la matemática (esta, `computeDiscountedAmount` en el server y
// una inline en el modal de matrícula con `Math.round` fijo, que se comía los
// céntimos en euros) y dos del formato.

import { currencyDecimals, formatMoney } from '@/lib/format'
import { computeApplication, currencyMismatch } from './scholarship-payment-rules'
import type { DiscountType } from '@/lib/supabase/queries/scholarships'

export type BreakdownScholarship = {
  discount_type: DiscountType
  discount_value: number
  /** Moneda de la beca. Solo importa en descuentos de monto fijo (INT-2). */
  currency?: string | null
}

export type PaymentBreakdown = {
  /** Precio de lista del estudio/evento. */
  price: number
  currency: string | null
  /** Cuánto se descuenta, en positivo. 0 si no hay beca aplicable. */
  discount: number
  /** "50%" o "₡5 000" — null si no hay beca aplicable. */
  discountLabel: string | null
  /** Lo que la persona tiene que transferir. */
  final: number
  /** La beca cubre el total: no se pide comprobante (BEC-1). */
  covered: boolean
  /** Beca de monto fijo en otra moneda: NO aplica (INT-2). Se informa para
   *  poder explicarlo en vez de mostrar un descuento que el server va a negar. */
  blockedByCurrency: boolean
}

/** "50%" para porcentajes, el monto formateado para descuentos fijos. */
export function formatDiscount(
  type: DiscountType, value: number, currency: string | null = 'CRC',
): string {
  if (type === 'percentage') return `${value}%`
  return formatMoney(value, currency)
}

/**
 * Desglose a mostrar. Devuelve null cuando no hay nada que pagar (estudio
 * gratuito o sin costo): el llamador no muestra desglose en ese caso.
 *
 * Si la beca es de monto fijo y está en otra moneda que el cobro, NO se aplica
 * (misma regla que el server) y `blockedByCurrency` queda en true.
 */
export function buildPaymentBreakdown(input: {
  price: number | null | undefined
  currency?: string | null
  scholarship?: BreakdownScholarship | null
}): PaymentBreakdown | null {
  const price = Number(input.price ?? 0)
  if (!Number.isFinite(price) || price <= 0) return null

  const currency = input.currency ?? 'CRC'
  const s = input.scholarship

  if (!s) {
    return {
      price, currency, discount: 0, discountLabel: null,
      final: price, covered: false, blockedByCurrency: false,
    }
  }

  if (currencyMismatch(s.discount_type, s.currency ?? 'CRC', currency)) {
    return {
      price, currency, discount: 0, discountLabel: null,
      final: price, covered: false, blockedByCurrency: true,
    }
  }

  const { amount: final, covered } = computeApplication(
    price, s.discount_type, s.discount_value, currency,
  )
  const f = 10 ** currencyDecimals(currency)
  const discount = Math.round((price - final) * f) / f

  return {
    price, currency, discount,
    discountLabel: formatDiscount(s.discount_type, s.discount_value, s.currency ?? currency),
    final, covered, blockedByCurrency: false,
  }
}

/**
 * ¿El monto que la persona declara en el comprobante difiere del que se
 * calculó? Solo para AVISAR: nunca bloquea — finanzas decide en revisión
 * (decisión de FIN-3).
 *
 * `declared` vacío/no numérico no es discrepancia: es que todavía no lo llenó.
 */
export function declaredAmountMismatch(
  declared: number | string | null | undefined,
  expected: number,
  currency: string | null = 'CRC',
): boolean {
  if (declared === null || declared === undefined || declared === '') return false
  const n = typeof declared === 'number' ? declared : Number(String(declared).replace(/[\s,]/g, ''))
  if (!Number.isFinite(n)) return false
  // Tolerancia = la unidad mínima de la moneda (₡1, $0.01), para que un
  // redondeo de céntimos no dispare el aviso.
  const tolerance = 1 / 10 ** currencyDecimals(currency)
  return Math.abs(n - expected) >= tolerance
}
