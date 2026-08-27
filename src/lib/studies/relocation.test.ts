import { describe, it, expect } from 'vitest'
import { puedeReubicarseA, textoFalta, isRelocationCode, RELOCATION_CODES } from './relocation'

const sinNada = { is_donor: false, is_server: false, attendance_active: false, attendance_active_intermedia: false }
const conTodo = { is_donor: true, is_server: true, attendance_active: true, attendance_active_intermedia: true }

describe('los niveles no piden compromisos', () => {
  for (const code of ['N2', 'N3', 'N4']) {
    it(`${code}: pasa aunque no cumpla nada`, () => {
      const r = puedeReubicarseA(code, 'niveles', sinNada)
      expect(r.is_eligible).toBe(true)
      expect(r.missing).toEqual([])
    })
  }
})

describe('Discípulos exige donador, servidor y asistencia reforzada', () => {
  it('sin nada: lista las tres cosas que faltan', () => {
    const r = puedeReubicarseA('DIS2', 'etapa_intermedia', sinNada)
    expect(r.is_eligible).toBe(false)
    expect(r.missing).toHaveLength(3)
    expect(r.missing.join(' ')).toMatch(/donador/)
    expect(r.missing.join(' ')).toMatch(/comité/)
    expect(r.missing.join(' ')).toMatch(/asistencia/)
  })

  it('con todo: pasa', () => {
    expect(puedeReubicarseA('DIS3', 'etapa_intermedia', conTodo).is_eligible).toBe(true)
  })

  it('la asistencia GENERAL no alcanza: la intermedia pide el doble', () => {
    const casi = { is_donor: true, is_server: true, attendance_active: true, attendance_active_intermedia: false }
    const r = puedeReubicarseA('DIS2', 'etapa_intermedia', casi)
    expect(r.is_eligible).toBe(false)
    expect(r.missing).toEqual(['asistencia activa a las charlas (el doble de la general)'])
  })

  it('solo le falta servir', () => {
    const casi = { is_donor: true, is_server: false, attendance_active: true, attendance_active_intermedia: true }
    expect(puedeReubicarseA('DIS2', 'etapa_intermedia', casi).missing).toEqual(['servir activamente en un comité'])
  })

  it('una excepción de matrícula lo perdona', () => {
    const r = puedeReubicarseA('DIS2', 'etapa_intermedia', sinNada, req => req === 'all' || true)
    expect(r.is_eligible).toBe(true)
  })
})

describe('el prerequisito NO se exige', () => {
  it('DIS3 con los compromisos pasa aunque no haya completado DIS2', () => {
    // Quien pide reubicación venía en ese estudio y lo pausó: exigirle otra vez
    // el prerequisito lo dejaría afuera de volver a su propio grupo.
    expect(puedeReubicarseA('DIS3', 'etapa_intermedia', conTodo).is_eligible).toBe(true)
  })
})

describe('el texto que se le muestra', () => {
  it('una sola cosa', () => {
    expect(textoFalta('Discípulos 2', ['ser donador activo']))
      .toBe('Para estar en Discípulos 2 te falta ser donador activo.')
  })
  it('varias, con "y" al final', () => {
    expect(textoFalta('Discípulos 2', ['a', 'b', 'c']))
      .toBe('Para estar en Discípulos 2 te falta a, b y c.')
  })
  it('sin nada que falte, no dice nada', () => {
    expect(textoFalta('Nivel 2', [])).toBe('')
  })
})

describe('qué códigos admiten reubicación', () => {
  it('los cinco que estaban en producción', () => {
    expect([...RELOCATION_CODES]).toEqual(['N2', 'N3', 'N4', 'DIS2', 'DIS3'])
  })
  it('N1 no, hoy', () => expect(isRelocationCode('N1')).toBe(false))
  it('basura no', () => expect(isRelocationCode('XX')).toBe(false))
})
