import { describe, it, expect } from 'vitest'
import {
  buildPaymentBreakdown, declaredAmountMismatch, formatDiscount,
} from './payment-breakdown'

describe('buildPaymentBreakdown', () => {
  it('sin costo no hay desglose (estudio gratuito)', () => {
    expect(buildPaymentBreakdown({ price: 0 })).toBeNull()
    expect(buildPaymentBreakdown({ price: null })).toBeNull()
    expect(buildPaymentBreakdown({ price: undefined })).toBeNull()
  })

  it('sin beca, el final es el precio', () => {
    const b = buildPaymentBreakdown({ price: 15000, currency: 'CRC' })!
    expect(b.price).toBe(15000)
    expect(b.discount).toBe(0)
    expect(b.final).toBe(15000)
    expect(b.covered).toBe(false)
    expect(b.discountLabel).toBeNull()
  })

  // El caso que pide la spec: una beca del 50% debe mostrar el residual bien.
  it('beca del 50% deja el residual correcto', () => {
    const b = buildPaymentBreakdown({
      price: 15000, currency: 'CRC',
      scholarship: { discount_type: 'percentage', discount_value: 50 },
    })!
    expect(b.discount).toBe(7500)
    expect(b.final).toBe(7500)
    expect(b.covered).toBe(false)
    expect(b.discountLabel).toBe('50%')
  })

  it('beca del 100% cubre todo (sin comprobante, BEC-1)', () => {
    const b = buildPaymentBreakdown({
      price: 15000, currency: 'CRC',
      scholarship: { discount_type: 'percentage', discount_value: 100 },
    })!
    expect(b.final).toBe(0)
    expect(b.covered).toBe(true)
    expect(b.discount).toBe(15000)
  })

  it('beca de monto fijo resta el monto', () => {
    const b = buildPaymentBreakdown({
      price: 15000, currency: 'CRC',
      scholarship: { discount_type: 'fixed', discount_value: 5000, currency: 'CRC' },
    })!
    expect(b.discount).toBe(5000)
    expect(b.final).toBe(10000)
    expect(b.discountLabel).toBe(formatDiscount('fixed', 5000, 'CRC'))
  })

  it('una beca fija mayor al precio no deja el final en negativo', () => {
    const b = buildPaymentBreakdown({
      price: 3000, currency: 'CRC',
      scholarship: { discount_type: 'fixed', discount_value: 5000, currency: 'CRC' },
    })!
    expect(b.final).toBe(0)
    expect(b.covered).toBe(true)
    expect(b.discount).toBe(3000)
  })

  // INT-2: una beca de monto fijo en otra moneda no aplica.
  it('beca fija en otra moneda NO aplica y se informa', () => {
    const b = buildPaymentBreakdown({
      price: 100, currency: 'EUR',
      scholarship: { discount_type: 'fixed', discount_value: 5000, currency: 'CRC' },
    })!
    expect(b.blockedByCurrency).toBe(true)
    expect(b.discount).toBe(0)
    expect(b.final).toBe(100)
  })

  it('un porcentaje sí aplica en cualquier moneda, con los céntimos', () => {
    const b = buildPaymentBreakdown({
      price: 25.5, currency: 'EUR',
      scholarship: { discount_type: 'percentage', discount_value: 10 },
    })!
    expect(b.blockedByCurrency).toBe(false)
    // 25,50 − 10% = 22,95. Con redondeo fijo a enteros daba 23 (se comía los céntimos).
    expect(b.final).toBe(22.95)
    expect(b.discount).toBe(2.55)
  })
})

describe('declaredAmountMismatch', () => {
  it('sin monto declarado no hay discrepancia', () => {
    expect(declaredAmountMismatch('', 7500)).toBe(false)
    expect(declaredAmountMismatch(null, 7500)).toBe(false)
    expect(declaredAmountMismatch(undefined, 7500)).toBe(false)
    expect(declaredAmountMismatch('abc', 7500)).toBe(false)
  })

  it('el monto correcto no avisa', () => {
    expect(declaredAmountMismatch(7500, 7500)).toBe(false)
    expect(declaredAmountMismatch('7500', 7500)).toBe(false)
    // Escrito con separadores de miles.
    expect(declaredAmountMismatch('7 500', 7500)).toBe(false)
    expect(declaredAmountMismatch('7,500', 7500)).toBe(false)
  })

  // El caso de la spec: pagó el precio de lista ignorando la beca.
  it('un monto distinto avisa', () => {
    expect(declaredAmountMismatch(15000, 7500)).toBe(true)
    expect(declaredAmountMismatch(7000, 7500)).toBe(true)
  })

  it('la tolerancia va según la moneda', () => {
    // En colones la unidad mínima es ₡1.
    expect(declaredAmountMismatch(7500.4, 7500, 'CRC')).toBe(false)
    expect(declaredAmountMismatch(7501, 7500, 'CRC')).toBe(true)
    // En euros, los céntimos cuentan.
    expect(declaredAmountMismatch(22.95, 22.95, 'EUR')).toBe(false)
    expect(declaredAmountMismatch(23, 22.95, 'EUR')).toBe(true)
  })
})
