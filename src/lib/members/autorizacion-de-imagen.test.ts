import { describe, it, expect } from 'vitest'
import {
  estadoDeAutorizacion, aValorGuardado, puedePublicarse, urgeConsultar, ETIQUETA,
} from './autorizacion-de-imagen'

describe('los tres estados', () => {
  it('NULL es "pendiente", no "no" — es la distinción que importa', () => {
    // Con un booleano de dos estados se pierde para siempre a quién falta
    // consultar, y se afirma una negativa que nadie dio.
    expect(estadoDeAutorizacion(null)).toBe('pendiente')
    expect(estadoDeAutorizacion(undefined)).toBe('pendiente')
    expect(estadoDeAutorizacion(false)).toBe('no')
    expect(estadoDeAutorizacion(true)).toBe('si')
  })

  it('ida y vuelta sin perder el matiz', () => {
    for (const v of [true, false, null]) {
      expect(aValorGuardado(estadoDeAutorizacion(v))).toBe(v)
    }
  })

  it('cada estado tiene su etiqueta y ninguna dice lo mismo', () => {
    expect(new Set(Object.values(ETIQUETA)).size).toBe(3)
    expect(ETIQUETA.pendiente).toMatch(/pendiente/i)
  })
})

describe('puedePublicarse', () => {
  it('SOLO con un sí explícito', () => {
    expect(puedePublicarse(true)).toBe(true)
  })

  it('PENDIENTE CUENTA COMO NO: la ausencia de respuesta no es un permiso', () => {
    // Quien consulta esto está por publicar una foto.
    expect(puedePublicarse(null)).toBe(false)
    expect(puedePublicarse(undefined)).toBe(false)
    expect(puedePublicarse(false)).toBe(false)
  })
})

describe('urgeConsultar', () => {
  it('un menor sin respuesta es a quien hay que ir a preguntarle', () => {
    expect(urgeConsultar(null, true)).toBe(true)
  })

  it('un menor que ya respondió, no', () => {
    expect(urgeConsultar(true, true)).toBe(false)
    expect(urgeConsultar(false, true)).toBe(false)
  })

  it('un adulto sin respuesta no urge: su imagen la decide él', () => {
    expect(urgeConsultar(null, false)).toBe(false)
  })
})
