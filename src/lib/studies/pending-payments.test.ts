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
