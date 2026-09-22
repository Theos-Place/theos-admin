import { describe, it, expect } from 'vitest'
import { sumarDias, ventanaDeDias } from './ventana-de-dias'

describe('sumarDias', () => {
  it('suma dentro del mes', () => { expect(sumarDias('2026-03-01', 10)).toBe('2026-03-11') })
  it('cruza el mes', () => { expect(sumarDias('2026-01-25', 30)).toBe('2026-02-24') })
  it('cruza el año', () => { expect(sumarDias('2026-12-20', 30)).toBe('2027-01-19') })
  it('febrero bisiesto', () => { expect(sumarDias('2028-02-27', 3)).toBe('2028-03-01') })
  it('resta con días negativos', () => { expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28') })
  it('una fecha inválida vuelve tal cual, sin inventar', () => {
    expect(sumarDias('no-es-fecha', 5)).toBe('no-es-fecha')
  })
  it('NO depende del reloj: dos llamadas iguales dan lo mismo', () => {
    // Es el punto de todo esto — poder calcular la ventana sin leer Date.now()
    // en pleno render.
    expect(sumarDias('2026-06-15', 30)).toBe(sumarDias('2026-06-15', 30))
  })
})

describe('ventanaDeDias', () => {
  it('de hoy a +30, ambos inclusive', () => {
    expect(ventanaDeDias('2026-09-22', 30)).toEqual({ desde: '2026-09-22', hasta: '2026-10-22' })
  })
})
