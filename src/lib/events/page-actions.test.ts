import { describe, it, expect } from 'vitest'
import { eventPageActions } from './page-actions'

describe('eventPageActions (EVE-3)', () => {
  it('compartir calendario: SOLO admin y comunicaciones (dirección queda fuera)', () => {
    expect(eventPageActions(['admin']).share).toBe(true)
    expect(eventPageActions(['comunicaciones']).share).toBe(true)
    expect(eventPageActions(['direccion']).share).toBe(false)
    expect(eventPageActions(['encargado_eventos']).share).toBe(false)
    expect(eventPageActions(['miembro']).share).toBe(false)
  })

  it('check-in: EVENT_CHECKIN_ROLES (encargado_eventos, direccion, admin)', () => {
    expect(eventPageActions(['encargado_eventos']).checkin).toBe(true)
    expect(eventPageActions(['direccion']).checkin).toBe(true)
    expect(eventPageActions(['admin']).checkin).toBe(true)
    expect(eventPageActions(['comunicaciones']).checkin).toBe(false)
    expect(eventPageActions(['miembro']).checkin).toBe(false)
  })

  it('el rol miembro no ve ningún botón de gestión', () => {
    expect(eventPageActions(['miembro'])).toEqual({ share: false, checkin: false })
    expect(eventPageActions([])).toEqual({ share: false, checkin: false })
  })
})
