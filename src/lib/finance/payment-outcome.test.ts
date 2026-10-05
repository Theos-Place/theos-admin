import { describe, it, expect } from 'vitest'
import {
  PAYMENT_STATUSES, PAYMENT_STATUS_LABEL, requiereAtencion, cobroVivo,
} from './payment-outcome'

describe('separar cancelado de fallido', () => {
  it('una cancelación NO requiere atención: es una decisión, no una avería', () => {
    expect(requiereAtencion('cancelado')).toBe(false)
  })

  it('un fallo del sistema SÍ requiere atención', () => {
    expect(requiereAtencion('failed')).toBe(true)
  })

  it('los estados normales no alarman a nadie', () => {
    for (const s of ['paid', 'pending', 'refunded', 'partial_refund']) {
      expect(requiereAtencion(s)).toBe(false)
    }
  })
})

describe('cobroVivo', () => {
  it('pendiente y pagado están vivos', () => {
    expect(cobroVivo('pending')).toBe(true)
    expect(cobroVivo('paid')).toBe(true)
  })

  it('cancelado y fallido no sostienen nada', () => {
    expect(cobroVivo('cancelado')).toBe(false)
    expect(cobroVivo('failed')).toBe(false)
  })

  it('una devolución tampoco', () => {
    expect(cobroVivo('refunded')).toBe(false)
    expect(cobroVivo('partial_refund')).toBe(false)
  })
})

describe('etiquetas', () => {
  it('todos los estados tienen su nombre en español', () => {
    for (const s of PAYMENT_STATUSES) {
      expect(PAYMENT_STATUS_LABEL[s]).toBeTruthy()
    }
  })

  it('el cobro cerrado y el fallido se leen distinto', () => {
    // Lo que fija este test es que NO se confundan: uno es un desenlace
    // normal y el otro una avería que alguien tiene que mirar.
    //
    // La palabra cambió en PAG-6 (2026-10-05): el estado `cancelado` pasó a
    // escribirse «Anulado» porque «Cancelado» se necesitaba para el cobro
    // PAGADO, que es como le dice contabilidad. Los valores de la base no se
    // tocaron.
    expect(PAYMENT_STATUS_LABEL.cancelado).toBe('Anulado')
    expect(PAYMENT_STATUS_LABEL.failed).toBe('Fallido')
    expect(PAYMENT_STATUS_LABEL.cancelado).not.toBe(PAYMENT_STATUS_LABEL.failed)
  })
})
