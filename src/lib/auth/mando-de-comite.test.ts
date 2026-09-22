import { describe, it, expect } from 'vitest'
import { mandaEnAlgunComite, puedeVerFichaPorComite } from './mando-de-comite'

describe('mandaEnAlgunComite', () => {
  it('sí cuando tiene al menos un comité', () => {
    // El caso de George Vivas: encargado de dos, sin el rol lider_comite.
    expect(mandaEnAlgunComite(['a', 'b'])).toBe(true)
  })
  it('no cuando no tiene ninguno', () => {
    expect(mandaEnAlgunComite([])).toBe(false)
  })
})

describe('puedeVerFichaPorComite', () => {
  it('sí cuando comparten un comité que la persona gestiona', () => {
    expect(puedeVerFichaPorComite(['a', 'b'], ['b'])).toBe(true)
  })

  it('NO cuando la persona buscada no es de sus comités', () => {
    // El caso de Floriana: buscó a alguien cualquiera y le abrió la ficha.
    expect(puedeVerFichaPorComite(['a'], ['z'])).toBe(false)
  })

  it('no gestionar nada no da acceso a nadie', () => {
    expect(puedeVerFichaPorComite([], ['a'])).toBe(false)
  })

  it('una persona sin comité no la ve ningún encargado', () => {
    expect(puedeVerFichaPorComite(['a', 'b'], [])).toBe(false)
  })
})
