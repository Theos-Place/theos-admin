import { describe, it, expect } from 'vitest'
import { isRemindablePayment } from './payment-reminder-rules'

const NOW = '2026-07-27T12:00:00.000Z'

describe('isRemindablePayment (PAG-3)', () => {
  it('pendiente sin comprobante → se recuerda', () => {
    expect(isRemindablePayment({ status: 'pending', review_status: null, reviewed_at: null }, NOW)).toBe(true)
  })

  it('en revisión → NO (la pelota está en finanzas)', () => {
    expect(isRemindablePayment({ status: 'pending', review_status: 'en_revision', reviewed_at: null }, NOW)).toBe(false)
  })

  it('rechazado dentro de las 72h → se recuerda; pasado eso NO (va a expirar igual)', () => {
    expect(isRemindablePayment({ status: 'pending', review_status: 'rechazado', reviewed_at: '2026-07-26T12:00:00.000Z' }, NOW)).toBe(true)
    expect(isRemindablePayment({ status: 'pending', review_status: 'rechazado', reviewed_at: '2026-07-23T12:00:00.000Z' }, NOW)).toBe(false)
  })

  it('pagados/cerrados nunca', () => {
    expect(isRemindablePayment({ status: 'paid', review_status: null, reviewed_at: null }, NOW)).toBe(false)
    expect(isRemindablePayment({ status: 'failed', review_status: null, reviewed_at: null }, NOW)).toBe(false)
  })
})
