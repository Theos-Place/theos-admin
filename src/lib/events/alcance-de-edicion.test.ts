import { describe, it, expect } from 'vitest'
import { hayQuePreguntarElAlcance, ALCANCE_SIN_PREGUNTAR } from './alcance-de-edicion'

describe('hayQuePreguntarElAlcance', () => {
  it('sí, cuando se llegó desde una ocurrencia del calendario', () => {
    expect(hayQuePreguntarElAlcance(true, true)).toBe(true)
  })

  it('NO, editando el evento en sí: ahí no hay "esta instancia" — el bug del 2026-09-21', () => {
    // Se preguntaba igual, el código inventaba la ocurrencia con la fecha de
    // inicio del propio evento, y "solo esta" creaba un hijo en la fecha nueva
    // dejando el original en la vieja.
    expect(hayQuePreguntarElAlcance(true, false)).toBe(false)
  })

  it('nunca para un evento que no se repite', () => {
    expect(hayQuePreguntarElAlcance(false, true)).toBe(false)
    expect(hayQuePreguntarElAlcance(false, false)).toBe(false)
  })

  it('sin preguntar se actúa sobre el evento entero', () => {
    expect(ALCANCE_SIN_PREGUNTAR).toBe('all')
  })
})
