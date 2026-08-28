import { describe, it, expect } from 'vitest'
import { ventanaProximos, esVistaDeProximos, etiquetaContador, DIAS_PROXIMOS } from './calendar-view-window'

describe('ventanaProximos', () => {
  it('NO se encoge a fin de mes: el 28 sigue mirando 60 días', () => {
    // Es el bug exacto: con "hoy → fin de mes", el 28 de agosto daba 4 días y
    // cero eventos, mientras el encabezado contaba 33.
    const { desde, hasta } = ventanaProximos(new Date('2026-08-28T15:00:00Z'))
    expect(desde.toISOString().slice(0, 10)).toBe('2026-08-28')
    expect(Math.round((+hasta - +desde) / 86400000)).toBe(DIAS_PROXIMOS)
  })
  it('el último día del mes tampoco', () => {
    const { desde, hasta } = ventanaProximos(new Date('2026-08-31T23:00:00Z'))
    expect(Math.round((+hasta - +desde) / 86400000)).toBe(DIAS_PROXIMOS)
    expect(hasta > desde).toBe(true)
  })
  it('arranca al inicio del día, no a la hora actual', () => {
    // Si no, un evento de hoy más temprano desaparecería de la lista.
    expect(ventanaProximos(new Date('2026-08-28T15:00:00Z')).desde.getHours()).toBe(0)
  })
  it('cruza el fin de año sin romperse', () => {
    const { desde, hasta } = ventanaProximos(new Date('2026-12-15T12:00:00Z'), 30)
    expect(hasta.getFullYear()).toBe(2027)
    expect(hasta > desde).toBe(true)
  })
})

describe('esVistaDeProximos', () => {
  it('lista y cuadrícula sí; mensual y semanal no', () => {
    expect(esVistaDeProximos('list')).toBe(true)
    expect(esVistaDeProximos('grid')).toBe(true)
    expect(esVistaDeProximos('monthly')).toBe(false)
    expect(esVistaDeProximos('weekly')).toBe(false)
  })
})

describe('etiquetaContador', () => {
  it('dice "este mes" solo donde se muestra un mes', () => {
    expect(etiquetaContador('monthly', 33)).toBe('33 este mes')
    expect(etiquetaContador('weekly', 5)).toBe('5 este mes')
  })
  it('en lista y cuadrícula dice "próximos", que es lo que muestra', () => {
    expect(etiquetaContador('list', 3)).toBe('3 próximos')
    expect(etiquetaContador('grid', 0)).toBe('0 próximos')
  })
  it('singular', () => {
    expect(etiquetaContador('list', 1)).toBe('1 próximo')
  })
})
