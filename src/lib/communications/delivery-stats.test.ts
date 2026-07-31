import { describe, it, expect } from 'vitest'
import { deliveryCards, deliveryRate, hasDeliveryConfirmations } from './delivery-stats'

const stats = (over: Partial<{ total: number; sent: number; delivered: number; failed: number }> = {}) => ({
  total: 19, sent: 19, delivered: 0, failed: 0, ...over,
})

describe('deliveryRate', () => {
  it('null cuando no hay confirmaciones (no se inventa 0%)', () => {
    expect(deliveryRate(stats())).toBeNull()
    expect(deliveryRate(stats({ total: 0, sent: 0 }))).toBeNull()
  })

  it('porcentaje cuando sí hay', () => {
    expect(deliveryRate(stats({ delivered: 19 }))).toBe(100)
    expect(deliveryRate(stats({ delivered: 10, total: 20 }))).toBe(50)
  })
})

describe('hasDeliveryConfirmations', () => {
  it('distingue "no llegó ninguna confirmación" de "no se entregó"', () => {
    expect(hasDeliveryConfirmations(stats())).toBe(false)
    expect(hasDeliveryConfirmations(stats({ delivered: 1 }))).toBe(true)
  })
})

describe('deliveryCards', () => {
  it('sin confirmaciones: muestra ENVIADOS y no una tasa falsa', () => {
    const cards = deliveryCards(stats())
    expect(cards.map(c => c.key)).toEqual(['total', 'enviados', 'fallidos', 'tasa'])
    expect(cards.find(c => c.key === 'enviados')?.value).toBe('19')
    // No hay tarjeta de "entregados" cuando nadie confirmó.
    expect(cards.some(c => c.key === 'entregados')).toBe(false)
    const tasa = cards.find(c => c.key === 'tasa')!
    expect(tasa.value).toBe('Sin datos')
    expect(tasa.hint).toMatch(/no está reportando/)
  })

  it('con confirmaciones: aparece entregados y la tasa real', () => {
    const cards = deliveryCards(stats({ delivered: 19 }))
    expect(cards.find(c => c.key === 'entregados')?.value).toBe('19 (100%)')
    expect(cards.find(c => c.key === 'tasa')).toMatchObject({ value: '100%', tone: 'good' })
  })

  it('la tasa cambia de tono según qué tan baja sea', () => {
    expect(deliveryCards(stats({ total: 100, sent: 100, delivered: 95 })).find(c => c.key === 'tasa')?.tone).toBe('good')
    expect(deliveryCards(stats({ total: 100, sent: 100, delivered: 75 })).find(c => c.key === 'tasa')?.tone).toBe('warn')
    expect(deliveryCards(stats({ total: 100, sent: 100, delivered: 40 })).find(c => c.key === 'tasa')?.tone).toBe('bad')
  })

  it('los fallidos se marcan en rojo solo si hay', () => {
    expect(deliveryCards(stats()).find(c => c.key === 'fallidos')?.tone).toBe('neutral')
    expect(deliveryCards(stats({ failed: 2 })).find(c => c.key === 'fallidos')?.tone).toBe('bad')
  })
})
