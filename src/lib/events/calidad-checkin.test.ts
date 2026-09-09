import { describe, it, expect } from 'vitest'
import {
  CALIDADES_CHECKIN, esCalidadValida, calidadDesdeTipo, contarPorCalidad, textoDeCalidad,
} from './calidad-checkin'

describe('la calidad del check-in', () => {
  it('son dos y solo dos', () => {
    expect([...CALIDADES_CHECKIN]).toEqual(['asistente', 'servidor'])
  })

  it('rechaza cualquier otra cosa', () => {
    for (const v of ['voluntario', 'Servidor', '', null, 1]) expect(esCalidadValida(v)).toBe(false)
  })

  it('traduce el vocabulario de la pantalla al de la base', () => {
    expect(calidadDesdeTipo('server')).toBe('servidor')
    expect(calidadDesdeTipo('participant')).toBe('asistente')
  })

  it('cualquier valor raro cae en asistente, que es el default de la columna', () => {
    for (const v of [null, undefined, 'otro', '']) expect(calidadDesdeTipo(v)).toBe('asistente')
  })
})

describe('contar', () => {
  const filas = [
    { checked_in_as: 'asistente' }, { checked_in_as: 'servidor' },
    { checked_in_as: 'asistente' }, { checked_in_as: 'servidor' }, { checked_in_as: 'asistente' },
  ]

  it('separa las dos cifras y el total las suma', () => {
    expect(contarPorCalidad(filas)).toEqual({ total: 5, asistentes: 3, servidores: 2 })
  })

  it('los históricos sin el dato cuentan como asistentes', () => {
    // 168.743 filas quedaron así: no es una suposición, es que nunca se guardó.
    expect(contarPorCalidad([{ checked_in_as: null }, {}])).toEqual({ total: 2, asistentes: 2, servidores: 0 })
  })

  it('el servidor SUMA al total: estuvo en la charla', () => {
    const c = contarPorCalidad([{ checked_in_as: 'servidor' }])
    expect(c.total).toBe(1)
    expect(c.asistentes + c.servidores).toBe(c.total)
  })

  it('cuenta igual con el vocabulario del dominio ("server")', () => {
    // La base dice 'servidor' y el dominio 'server'. Si el contador no
    // entendiera los dos, la pantalla contaría distinto que un export.
    expect(contarPorCalidad([
      { attendance_type: 'server' }, { attendance_type: 'participant' },
    ])).toEqual({ total: 2, asistentes: 1, servidores: 1 })
  })

  it('sin nadie da ceros', () => {
    expect(contarPorCalidad([])).toEqual({ total: 0, asistentes: 0, servidores: 0 })
  })
})

describe('cómo se lee', () => {
  it('con servidores, las dos cifras', () => {
    expect(textoDeCalidad({ total: 187, asistentes: 157, servidores: 30 }))
      .toBe('187 asistentes · de los cuales 30 servidores')
  })

  it('sin servidores NO dice "· 0 servidores"', () => {
    // Para todo lo anterior a hoy ese 0 significa "no se medía", no "nadie sirvió".
    expect(textoDeCalidad({ total: 187, asistentes: 187, servidores: 0 })).toBe('187 asistentes')
  })

  it('no dice "1 asistentes" ni "1 servidores"', () => {
    expect(textoDeCalidad({ total: 1, asistentes: 1, servidores: 0 })).toBe('1 asistente')
    expect(textoDeCalidad({ total: 2, asistentes: 1, servidores: 1 }))
      .toBe('2 asistentes · de los cuales 1 servidor')
  })
})
