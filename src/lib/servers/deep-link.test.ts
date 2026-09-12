import { describe, it, expect } from 'vitest'
import { leerSeleccion, escribirSeleccion, alElegir } from './deep-link'

const A = '11111111-1111-4111-8111-111111111111'
const C = '22222222-2222-4222-8222-222222222222'
const P = '33333333-3333-4333-8333-333333333333'
const params = (s: string) => new URLSearchParams(s)

describe('leer la selección de la URL', () => {
  it('lee los tres niveles', () => {
    expect(leerSeleccion(params(`area=${A}&comite=${C}&puesto=${P}`))).toEqual({ area: A, comite: C, puesto: P })
  })

  // Un link a medias no debe dejar un puesto colgando de la nada.
  it('sin comité no hay puesto; sin área no hay comité', () => {
    expect(leerSeleccion(params(`area=${A}&puesto=${P}`))).toEqual({ area: A, comite: null, puesto: null })
    expect(leerSeleccion(params(`comite=${C}&puesto=${P}`))).toEqual({ area: null, comite: null, puesto: null })
  })

  it('lo que no es UUID se descarta', () => {
    expect(leerSeleccion(params('area=<script>&comite=1')).area).toBeNull()
    expect(leerSeleccion(params('')).area).toBeNull()
  })
})

describe('escribir la selección', () => {
  it('arma el query string en orden', () => {
    expect(escribirSeleccion({ area: A, comite: C, puesto: P })).toBe(`?area=${A}&comite=${C}&puesto=${P}`)
  })

  it('los vacíos no se escriben', () => {
    expect(escribirSeleccion({ area: A, comite: null, puesto: null })).toBe(`?area=${A}`)
    expect(escribirSeleccion({ area: null, comite: null, puesto: null })).toBe('')
  })

  it('un puesto sin comité no viaja', () => {
    expect(escribirSeleccion({ area: A, comite: null, puesto: P })).toBe(`?area=${A}`)
  })

  it('ida y vuelta', () => {
    const sel = { area: A, comite: C, puesto: P }
    expect(leerSeleccion(params(escribirSeleccion(sel).slice(1)))).toEqual(sel)
  })
})

describe('al elegir algo', () => {
  const sel = { area: A, comite: C, puesto: P }

  it('cambiar de área limpia comité y puesto', () => {
    expect(alElegir(sel, { area: 'otra' })).toEqual({ area: 'otra', comite: null, puesto: null })
  })

  it('cambiar de comité limpia el puesto', () => {
    expect(alElegir(sel, { comite: 'otro' })).toEqual({ area: A, comite: 'otro', puesto: null })
  })

  it('elegir puesto conserva lo de arriba', () => {
    expect(alElegir({ area: A, comite: C, puesto: null }, { puesto: P })).toEqual(sel)
  })

  it('cerrar un nivel lo pone en null sin tocar los de arriba', () => {
    expect(alElegir(sel, { puesto: null }).puesto).toBeNull()
    expect(alElegir(sel, { comite: null })).toEqual({ area: A, comite: null, puesto: null })
  })
})
