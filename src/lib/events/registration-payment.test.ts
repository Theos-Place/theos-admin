import { describe, it, expect } from 'vitest'
import { montoAPagar, comprobanteRequerido, conDescuento } from './registration-payment'

const pago = { requiresPayment: true, exempt: false, price: 10_000 }

describe('cuánto se debe pagar al inscribirse', () => {
  it('evento gratuito: nada', () => {
    expect(montoAPagar({ requiresPayment: false, exempt: false, price: 0 })).toBe(0)
  })

  it('servidor exento: nada, aunque el evento tenga precio', () => {
    expect(montoAPagar({ requiresPayment: true, exempt: true, price: 10_000 })).toBe(0)
  })

  it('evento pago sin beca: el precio completo', () => {
    expect(montoAPagar(pago)).toBe(10_000)
  })

  it('beca porcentual', () => {
    expect(montoAPagar(pago, { discount_type: 'percentage', discount_value: 40 })).toBe(6_000)
  })

  it('beca de monto fijo', () => {
    expect(montoAPagar(pago, { discount_type: 'fixed', discount_value: 2_500 })).toBe(7_500)
  })

  it('beca del 100%: queda en 0 y NO se pide comprobante', () => {
    const m = montoAPagar(pago, { discount_type: 'percentage', discount_value: 100 })
    expect(m).toBe(0)
    expect(comprobanteRequerido(m)).toBe(false)
  })

  it('una beca mayor que el precio no genera saldo negativo', () => {
    expect(montoAPagar(pago, { discount_type: 'fixed', discount_value: 99_000 })).toBe(0)
    expect(conDescuento(1_000, { discount_type: 'fixed', discount_value: 5_000 })).toBe(0)
  })
})

describe('la regla: sin comprobante no hay inscripción', () => {
  it('con saldo pendiente, el comprobante es obligatorio', () => {
    expect(comprobanteRequerido(montoAPagar(pago))).toBe(true)
    expect(comprobanteRequerido(1)).toBe(true)
  })

  it('sin saldo, no se pide', () => {
    expect(comprobanteRequerido(0)).toBe(false)
  })
})
