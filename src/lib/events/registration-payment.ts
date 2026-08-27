/**
 * ¿Cuánto debe pagar realmente quien se inscribe, y por lo tanto hace falta
 * comprobante? MÓDULO PURO, y a propósito compartido por la ruta y la pantalla.
 *
 * Existe porque la regla vivía duplicada: la pantalla decidía si mostrar los
 * campos del comprobante y la ruta decidía si exigirlo. Dos copias de la misma
 * condición se separan tarde o temprano, y el resultado es de los peores: la
 * pantalla pide un archivo que la API no exige (molesto) o la pantalla no lo pide
 * y la API rechaza la inscripción (la persona no entiende qué pasó).
 */
import type { EventPricing } from '@/lib/events/eligibility'

export type Descuento = { discount_type: 'percentage' | 'fixed'; discount_value: number }

/** El precio con el descuento aplicado, nunca negativo y sin decimales (colones). */
export function conDescuento(precio: number, d: Descuento): number {
  const bruto = d.discount_type === 'percentage'
    ? precio * (1 - d.discount_value / 100)
    : precio - d.discount_value
  return Math.max(0, Math.round(bruto))
}

/** Lo que queda por pagar. 0 si el evento es gratuito, si la persona está exenta
 *  (servidor del comité organizador) o si la beca cubre todo. */
export function montoAPagar(
  pricing: Pick<EventPricing, 'requiresPayment' | 'exempt' | 'price'>,
  descuento?: Descuento | null,
): number {
  if (!pricing.requiresPayment || pricing.exempt) return 0
  const base = Math.max(0, pricing.price)
  return descuento ? conDescuento(base, descuento) : base
}

/**
 * Regla del 2026-08-27: si queda algo por pagar, sin comprobante NO hay
 * inscripción. Con ₡0 no se pide nada — pedir comprobante de un evento gratuito,
 * de un servidor exento o de una beca del 100% sería absurdo.
 */
export const comprobanteRequerido = (monto: number): boolean => monto > 0
