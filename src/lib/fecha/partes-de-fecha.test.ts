import { describe, it, expect } from 'vitest'
import { partesDeFecha, anioDe, mesDe, caeEn, fechaLocal } from './partes-de-fecha'

describe('partes de una fecha', () => {
  it('lee el mes que dice el string, no el que dicta la zona horaria', () => {
    // El bug: new Date('2026-09-01').getMonth() + 1 da 8 en Costa Rica.
    expect(mesDe('2026-09-01')).toBe(9)
    expect(mesDe('2026-01-01')).toBe(1)
  })

  it('el 1.º de enero es del año que dice, no del anterior', () => {
    // 4.136 donaciones caen ese día y se estaban contando en el año previo.
    expect(anioDe('2026-01-01')).toBe(2026)
  })

  it('reproduce el corrimiento que se está corrigiendo', () => {
    // Fija POR QUÉ existe esto: si alguien vuelve a `new Date`, este test
    // sigue pasando pero documenta qué da la vía mala.
    const malo = new Date('2026-01-01')
    const desfase = malo.getFullYear() !== 2026 || malo.getMonth() + 1 !== 1
    // En UTC no hay desfase; en CR sí. Cualquiera de las dos, partesDeFecha acierta.
    expect(anioDe('2026-01-01')).toBe(2026)
    expect(mesDe('2026-01-01')).toBe(1)
    if (desfase) expect(malo.getFullYear()).toBe(2025)
  })

  it('devuelve las tres partes', () => {
    expect(partesDeFecha('2026-04-15')).toEqual({ anio: 2026, mes: 4, dia: 15 })
  })

  it('un timestamp con hora se lee en hora local', () => {
    const d = new Date(2026, 6, 4, 10, 30)
    expect(partesDeFecha(d.toISOString())).toEqual({ anio: 2026, mes: 7, dia: 4 })
  })

  it('lo que no se entiende da null, no NaN', () => {
    expect(partesDeFecha(null)).toBeNull()
    expect(partesDeFecha('')).toBeNull()
    expect(partesDeFecha('no es fecha')).toBeNull()
    expect(anioDe(undefined)).toBeNull()
    expect(mesDe('2026-13')).toBeNull()
  })

  it('caeEn compara año y mes juntos', () => {
    expect(caeEn('2026-10-01', 2026, 10)).toBe(true)
    expect(caeEn('2026-10-01', 2026, 9)).toBe(false)
    expect(caeEn('2026-10-01', 2025, 10)).toBe(false)
    expect(caeEn(null, 2026, 10)).toBe(false)
  })

  it('fechaLocal arma el mismo día que dice el string', () => {
    const d = fechaLocal('2026-09-01')
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 9, 1])
  })

  it('fechaLocal deja comparar contra los límites de un filtro sin corrimiento', () => {
    expect(fechaLocal('2026-09-01') >= fechaLocal('2026-09-01')).toBe(true)
    expect(fechaLocal('2026-08-31') < fechaLocal('2026-09-01')).toBe(true)
  })
})
