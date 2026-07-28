import { describe, it, expect } from 'vitest'
import {
  checkPaymentScholarshipEligibility, computeApplication, currencyMismatch,
  checkCouponEmailSendable,
} from './scholarship-payment-rules'

const basePayment = {
  status: 'pending',
  scholarship_id: null,
  member_id: 'm1',
  concept: 'matricula',
  study_group_id: 'g1',
  event_id: null,
}

describe('checkPaymentScholarshipEligibility (BEC-1)', () => {
  it('pago de matrícula pendiente → aplica con destino study_plan', () => {
    expect(checkPaymentScholarshipEligibility(basePayment)).toEqual({ ok: true, entityType: 'study_plan' })
  })

  it('pago de evento pendiente → aplica con destino event', () => {
    expect(checkPaymentScholarshipEligibility({
      ...basePayment, concept: 'evento', study_group_id: null, event_id: 'e1',
    })).toEqual({ ok: true, entityType: 'event' })
  })

  it('pago ya pagado o fallido → pago_no_pendiente', () => {
    expect(checkPaymentScholarshipEligibility({ ...basePayment, status: 'paid' }))
      .toEqual({ ok: false, error: 'pago_no_pendiente' })
    expect(checkPaymentScholarshipEligibility({ ...basePayment, status: 'failed' }))
      .toEqual({ ok: false, error: 'pago_no_pendiente' })
  })

  it('pago con beca previa → pago_ya_con_beca (una beca por pago)', () => {
    expect(checkPaymentScholarshipEligibility({ ...basePayment, scholarship_id: 's1' }))
      .toEqual({ ok: false, error: 'pago_ya_con_beca' })
  })

  it('conceptos sin becas (folletos/otros) → concepto_no_aplica', () => {
    expect(checkPaymentScholarshipEligibility({ ...basePayment, concept: 'folletos' }))
      .toEqual({ ok: false, error: 'concepto_no_aplica' })
    expect(checkPaymentScholarshipEligibility({ ...basePayment, concept: null }))
      .toEqual({ ok: false, error: 'concepto_no_aplica' })
  })

  it('sin miembro asociado → pago_sin_miembro', () => {
    expect(checkPaymentScholarshipEligibility({ ...basePayment, member_id: null }))
      .toEqual({ ok: false, error: 'pago_sin_miembro' })
  })
})

describe('computeApplication (BEC-1)', () => {
  it('beca completa (100%) → monto 0 y covered: se aprueba sin comprobante', () => {
    expect(computeApplication(15000, 'percentage', 100)).toEqual({ amount: 0, covered: true })
  })

  it('monto fijo que cubre todo → covered', () => {
    expect(computeApplication(15000, 'fixed', 15000)).toEqual({ amount: 0, covered: true })
    expect(computeApplication(15000, 'fixed', 20000)).toEqual({ amount: 0, covered: true })
  })

  it('beca parcial → queda pendiente por el resto', () => {
    expect(computeApplication(15000, 'percentage', 50)).toEqual({ amount: 7500, covered: false })
    expect(computeApplication(15000, 'fixed', 5000)).toEqual({ amount: 10000, covered: false })
  })

  it('redondea al colón', () => {
    expect(computeApplication(10001, 'percentage', 50)).toEqual({ amount: 5001, covered: false })
  })
})

describe('currencyMismatch (BEC-1 + INT-2)', () => {
  it('monto fijo en otra moneda → no aplica', () => {
    expect(currencyMismatch('fixed', 'USD', 'CRC')).toBe(true)
  })
  it('monto fijo en la misma moneda (o defaults CRC) → aplica', () => {
    expect(currencyMismatch('fixed', 'CRC', 'CRC')).toBe(false)
    expect(currencyMismatch('fixed', null, null)).toBe(false)
  })
  it('porcentaje no depende de la moneda', () => {
    expect(currencyMismatch('percentage', 'USD', 'CRC')).toBe(false)
  })
})

describe('checkCouponEmailSendable (BEC-1)', () => {
  const now = new Date('2026-07-28T12:00:00Z')
  const coupon = { kind: 'generica' as const, status: 'active', expires_at: '2026-12-31', member_id: null }

  it('cupón genérico activo + persona indicada → se envía a esa persona', () => {
    expect(checkCouponEmailSendable(coupon, 'm9', now)).toEqual({ ok: true, memberId: 'm9' })
  })

  it('cupón genérico sin persona → miembro_requerido', () => {
    expect(checkCouponEmailSendable(coupon, null, now)).toEqual({ ok: false, error: 'miembro_requerido' })
  })

  it('beca asignada → siempre a su dueño (ignora el pedido)', () => {
    expect(checkCouponEmailSendable(
      { kind: 'asignada', status: 'active', expires_at: null, member_id: 'owner' }, 'otro', now,
    )).toEqual({ ok: true, memberId: 'owner' })
  })

  it('revocada o vencida → no se envía', () => {
    expect(checkCouponEmailSendable({ ...coupon, status: 'revoked' }, 'm9', now))
      .toEqual({ ok: false, error: 'no_activa' })
    expect(checkCouponEmailSendable({ ...coupon, expires_at: '2026-01-01' }, 'm9', now))
      .toEqual({ ok: false, error: 'vencida' })
  })
})
