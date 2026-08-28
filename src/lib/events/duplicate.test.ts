import { describe, it, expect } from 'vitest'
import { eventoDuplicado } from './duplicate'

const base = {
  title: 'Retiro de Mujeres', event_type: 'retiro', starts_at: '2026-03-01T15:00:00Z',
  ends_at: '2026-03-01T20:00:00Z', location: 'Pedregal', max_capacity: 80,
  requires_registration: true, requires_payment: true, payment_amount: 15000,
  registration_form_id: 'form-1', flyer_url: 'https://x.test/f.webp',
  is_recurring: true, recurrence_rule: 'FREQ=MONTHLY;BYDAY=1SA',
}

describe('eventoDuplicado — lo que SÍ se copia', () => {
  it('todo lo que define al evento', () => {
    const d = eventoDuplicado(base)
    expect(d).toMatchObject({
      event_type: 'retiro', starts_at: base.starts_at, ends_at: base.ends_at,
      location: 'Pedregal', max_capacity: 80,
      requires_registration: true, requires_payment: true, payment_amount: 15000,
      registration_form_id: 'form-1', flyer_url: base.flyer_url,
      is_recurring: true, recurrence_rule: 'FREQ=MONTHLY;BYDAY=1SA',
    })
  })
  it('el título lleva "(copia)" para poder distinguirlos en la lista', () => {
    expect(eventoDuplicado(base).title).toBe('Retiro de Mujeres (copia)')
  })
})

describe('eventoDuplicado — lo que NO se hereda', () => {
  it('la copia entra INTERNA aunque el original sea público', () => {
    // Conserva la fecha del original: publicarla de una la pondría en el
    // calendario compitiendo con el evento real.
    expect(eventoDuplicado({ ...base, is_public: true }).is_public).toBe(false)
  })
  it('arranca en upcoming aunque el original esté terminado o cancelado', () => {
    // Duplicar un evento pasado es la razón más común para duplicar.
    expect(eventoDuplicado({ ...base, status: 'finished' }).status).toBe('upcoming')
    expect(eventoDuplicado({ ...base, status: 'cancelled' }).status).toBe('upcoming')
  })
  it('no arrastra el envío de la encuesta del original', () => {
    // Si no, la copia creería que ya mandó una encuesta que nunca mandó.
    expect(eventoDuplicado({ ...base, survey_send_at: '2026-03-02T12:00:00Z' }).survey_send_at).toBeNull()
  })
  it('no queda colgada de la serie del original', () => {
    expect(eventoDuplicado({ ...base, parent_event_id: 'ev-1' } as never))
      .not.toHaveProperty('parent_event_id', 'ev-1')
  })
})

describe('eventoDuplicado — defaults sanos', () => {
  it('un evento mínimo no genera undefined sueltos', () => {
    const d = eventoDuplicado({ title: 'X', event_type: 'otro', starts_at: '2026-01-01T00:00:00Z' })
    expect(d.currency).toBe('CRC')
    expect(d.requires_payment).toBe(false)
    expect(d.max_capacity).toBeNull()
  })
})
