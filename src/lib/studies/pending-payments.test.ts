import { describe, it, expect } from 'vitest'
import { isBlockingStudyPayment } from './pending-payments'

describe('isBlockingStudyPayment (PAG-2)', () => {
  it('pago de estudio pendiente → bloquea', () => {
    expect(isBlockingStudyPayment({ concept: 'matricula', status: 'pending' })).toBe(true)
  })

  it('pago de evento pendiente → NO bloquea', () => {
    expect(isBlockingStudyPayment({ concept: 'evento', status: 'pending' })).toBe(false)
  })

  it('otros conceptos y estados no bloquean', () => {
    expect(isBlockingStudyPayment({ concept: 'folletos', status: 'pending' })).toBe(false)
    expect(isBlockingStudyPayment({ concept: 'prematrimonial', status: 'pending' })).toBe(false)
    expect(isBlockingStudyPayment({ concept: 'matricula', status: 'paid' })).toBe(false)
    expect(isBlockingStudyPayment({ concept: 'matricula', status: 'failed' })).toBe(false)
    expect(isBlockingStudyPayment({ concept: null, status: 'pending' })).toBe(false)
  })
})

describe('un cobro cancelado no es una deuda', () => {
  it('cancelado NO bloquea', () => {
    // Al retirar a alguien su cobro se cancela. Si eso contara como deuda, el
    // propio retiro le impediría volver a matricularse — que es lo que le
    // pasó a Celina Rodríguez el 2026-09-05.
    expect(isBlockingStudyPayment({ concept: 'matricula', status: 'cancelado' })).toBe(false)
  })

  it('fallido tampoco: es una avería, no un saldo', () => {
    expect(isBlockingStudyPayment({ concept: 'matricula', status: 'failed' })).toBe(false)
  })

  it('solo pending bloquea', () => {
    expect(isBlockingStudyPayment({ concept: 'matricula', status: 'pending' })).toBe(true)
    expect(isBlockingStudyPayment({ concept: 'matricula', status: 'paid' })).toBe(false)
    expect(isBlockingStudyPayment({ concept: 'matricula', status: 'refunded' })).toBe(false)
  })
})
