import { describe, it, expect } from 'vitest'
import { hayQuePreguntarElAlcance, esLaPrimeraOcurrencia, ALCANCE_SIN_PREGUNTAR } from './alcance-de-edicion'

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

describe('la primera ocurrencia de la serie', () => {
  it('NO se pregunta: las tres respuestas son la misma o son basura', () => {
    // Segundo reporte del 2026-09-21: editaron la primera fecha de una copia,
    // eligieron "esta y las siguientes" y la serie se partió en dos eventos.
    expect(hayQuePreguntarElAlcance(true, true, true)).toBe(false)
  })

  it('en una ocurrencia posterior sí se pregunta', () => {
    expect(hayQuePreguntarElAlcance(true, true, false)).toBe(true)
  })

  it('compara solo los días: la hora de la celda del calendario no cuenta', () => {
    expect(esLaPrimeraOcurrencia('2026-10-17T09:00:00Z', '2026-10-17T15:00:00Z')).toBe(true)
    expect(esLaPrimeraOcurrencia('2026-10-17T09:00:00Z', '2026-10-24T09:00:00Z')).toBe(false)
  })

  it('sin datos no afirma que sea la primera', () => {
    expect(esLaPrimeraOcurrencia(null, '2026-10-17')).toBe(false)
    expect(esLaPrimeraOcurrencia('2026-10-17', null)).toBe(false)
  })
})
