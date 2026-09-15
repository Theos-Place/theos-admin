import { describe, it, expect } from 'vitest'
import {
  resumenGeneral, desgloseDeTarjeta, ventanaDelMesCR, APORTE_VACIO,
} from './resumen-general'

const campanas = { mensajes: 3, alcanzados: 1000, entregados: 900, conErrores: 1 }
const sistema = { mensajes: 240, alcanzados: 240, entregados: 228, conErrores: 12 }

describe('resumenGeneral', () => {
  it('suma las dos fuentes y guarda cuánto puso el sistema', () => {
    const r = resumenGeneral(campanas, sistema)
    expect(r.mensajes).toEqual({ total: 243, delSistema: 240 })
    expect(r.alcanzados).toEqual({ total: 1240, delSistema: 240 })
    expect(r.conErrores).toEqual({ total: 13, delSistema: 12 })
  })

  it('la tasa es de las dos juntas, no el promedio de las dos tasas', () => {
    // 1128 entregados de 1240 alcanzados = 91%. El promedio de 90% y 95% daría
    // 92,5%: sería el número equivocado porque las fuentes no pesan igual.
    expect(resumenGeneral(campanas, sistema).tasa).toBe(91)
  })

  it('sin sistema, los números son los de siempre', () => {
    const r = resumenGeneral(campanas, APORTE_VACIO)
    expect(r.mensajes.total).toBe(3)
    expect(r.tasa).toBe(90)
    expect(r.tasaDelSistema).toBeNull()
  })

  it('un mes sin nada no divide entre cero', () => {
    const r = resumenGeneral(APORTE_VACIO, APORTE_VACIO)
    expect(r.tasa).toBe(0)
    expect(r.tasaDelSistema).toBeNull()
  })
})

describe('desgloseDeTarjeta', () => {
  it('no imprime una línea que diga cero', () => {
    expect(desgloseDeTarjeta({ total: 3, delSistema: 0 })).toBeNull()
  })
  it('lleva separador de miles', () => {
    // El separador se compara con el que emite Intl y no con un literal: según
    // la versión de ICU es punto o espacio fino, y eso no es lo que se prueba.
    expect(desgloseDeTarjeta({ total: 2500, delSistema: 1300 }))
      .toBe(`${(1300).toLocaleString('es-CR')} del sistema`)
  })
})

describe('ventanaDelMesCR', () => {
  it('arranca a medianoche CR del día 1, que en UTC son las 6 a.m.', () => {
    expect(ventanaDelMesCR('2026-09-14')).toEqual({
      desde: '2026-09-01T06:00:00.000Z',
      hasta: '2026-10-01T06:00:00.000Z',
    })
  })
  it('diciembre cierra contra enero del año siguiente', () => {
    expect(ventanaDelMesCR('2026-12-31').hasta).toBe('2027-01-01T06:00:00.000Z')
  })
})
