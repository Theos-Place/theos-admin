import { describe, it, expect } from 'vitest'
import { computeEventEligibility } from './eligibility'

describe('comprobante en revisión vs pago que falta de verdad', () => {
  // El reclamo del 2026-08-27: a quien acababa de subir el comprobante la
  // pantalla le decía "falta el pago". `registration_status` NO puede distinguir
  // los dos casos —se queda en 'pending' hasta que finanzas aprueba— así que la
  // diferencia entra desde afuera, con los ids que tienen pago en revisión.
  const evento = (registrationId: string) => ([{
    id: 'ev1', title: 'Prueba', starts_at: '2026-12-01T00:00:00Z', ends_at: null,
    event_type: 'otro', status: 'upcoming' as const, location: null, flyer_url: null,
    is_recurring: false, recurrence_rule: null, max_capacity: null,
    registrations: [{ id: registrationId, member_id: 'm1', payment_status: 'pending' as const, registered_at: '2026-08-27T00:00:00Z', member: null }],
  }] as unknown as Parameters<typeof computeEventEligibility>[0])

  const precios = new Map([['ev1', { requiresPayment: true, isServer: false, exempt: false, price: 1000 }]])

  it('con el comprobante en revisión, payment_in_review es true', () => {
    const [r] = computeEventEligibility(evento('reg1'), 'm1', precios, new Set(['reg1']))
    expect(r.already_registered).toBe(true)
    expect(r.registration_status).toBe('pending')
    expect(r.payment_in_review).toBe(true)
  })

  it('sin comprobante subido, es false aunque el estado sea el mismo', () => {
    const [r] = computeEventEligibility(evento('reg1'), 'm1', precios, new Set())
    expect(r.registration_status).toBe('pending')
    expect(r.payment_in_review).toBe(false)
  })

  it('el comprobante de OTRA inscripción no cuenta', () => {
    const [r] = computeEventEligibility(evento('reg1'), 'm1', precios, new Set(['reg-de-otro']))
    expect(r.payment_in_review).toBe(false)
  })

  it('sin el parámetro (llamadas viejas) no revienta y da false', () => {
    const [r] = computeEventEligibility(evento('reg1'), 'm1', precios)
    expect(r.payment_in_review).toBe(false)
  })
})
