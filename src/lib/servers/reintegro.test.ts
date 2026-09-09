import { describe, it, expect } from 'vitest'
import {
  candidaturaEnComite, seOcultaDelBuscador, puestosQueSePuedenSumar, perderaElRol,
} from './reintegro'

const JC = 'juan-carlos'
/** El caso real: un solo registro, inactivo, en Colaborador Montaje. */
const COMITE_CON_JC_INACTIVO = [
  { member_id: JC, position_id: 'montaje', status: 'inactive' },
  { member_id: 'otra', position_id: 'montaje', status: 'active' },
]

describe('el caso Juan Carlos: dejó de servir y volvió', () => {
  it('su candidatura es un REINTEGRO, no un alta nueva', () => {
    const c = candidaturaEnComite(JC, COMITE_CON_JC_INACTIVO)
    expect(c.tipo).toBe('reintegro')
    expect(c.tipo === 'reintegro' && c.puestosInactivos).toEqual(['montaje'])
  })

  it('y NO se oculta del buscador — ese era el bug', () => {
    // El buscador descartaba a toda persona con registro en el comité, activo o
    // inactivo, así que quien alguna vez sirvió ahí quedaba excluido para siempre.
    expect(seOcultaDelBuscador(JC, COMITE_CON_JC_INACTIVO)).toBe(false)
  })

  it('puede volver al MISMO puesto que tenía', () => {
    const puestos = [{ id: 'montaje', title: 'Colaborador Montaje' }]
    expect(puestosQueSePuedenSumar(JC, puestos, COMITE_CON_JC_INACTIVO))
      .toEqual([{ id: 'montaje', title: 'Colaborador Montaje' }])
  })
})

describe('quién sí se oculta del buscador', () => {
  const activo = [{ member_id: 'ana', position_id: 'p1', status: 'active' }]

  it('quien YA sirve activo: a esa persona se le suma otro puesto desde su fila', () => {
    expect(seOcultaDelBuscador('ana', activo)).toBe(true)
    expect(candidaturaEnComite('ana', activo).tipo).toBe('ya_sirve')
  })

  it('quien no tiene historial en el comité es un alta normal', () => {
    expect(seOcultaDelBuscador('nadie', activo)).toBe(false)
    expect(candidaturaEnComite('nadie', activo).tipo).toBe('nuevo')
  })

  it('con un puesto activo Y otro inactivo, cuenta como que ya sirve', () => {
    const mixto = [
      { member_id: 'ana', position_id: 'p1', status: 'active' },
      { member_id: 'ana', position_id: 'p2', status: 'inactive' },
    ]
    const c = candidaturaEnComite('ana', mixto)
    expect(c.tipo).toBe('ya_sirve')
    expect(c.tipo === 'ya_sirve' && c.puestosActivos).toEqual(['p1'])
  })
})

describe('sumar otro puesto', () => {
  const puestos = [
    { id: 'p1', title: 'Logística' },
    { id: 'p2', title: 'Anfitrión' },
    { id: 'p3', title: 'Bienvenida' },
  ]

  it('ofrece los que la persona NO tiene activos', () => {
    const reg = [{ member_id: 'ana', position_id: 'p1', status: 'active' }]
    expect(puestosQueSePuedenSumar('ana', puestos, reg).map(p => p.id)).toEqual(['p2', 'p3'])
  })

  it('un puesto inactivo suyo SÍ se ofrece: agregarlo lo reactiva', () => {
    const reg = [{ member_id: 'ana', position_id: 'p1', status: 'inactive' }]
    expect(puestosQueSePuedenSumar('ana', puestos, reg).map(p => p.id)).toEqual(['p1', 'p2', 'p3'])
  })

  it('con todos los puestos activos no queda ninguno por sumar', () => {
    const reg = puestos.map(p => ({ member_id: 'ana', position_id: p.id, status: 'active' }))
    expect(puestosQueSePuedenSumar('ana', puestos, reg)).toEqual([])
  })

  it('los puestos de OTRA persona no le quitan opciones', () => {
    const reg = [{ member_id: 'otra', position_id: 'p1', status: 'active' }]
    expect(puestosQueSePuedenSumar('ana', puestos, reg)).toHaveLength(3)
  })
})

describe('dar de baja uno de varios puestos', () => {
  it('con dos puestos que respaldan el rol, quitar uno NO lo quita', () => {
    expect(perderaElRol('p1', ['p1', 'p2'])).toBe(false)
  })

  it('quitar el último respaldo sí lo quita', () => {
    expect(perderaElRol('p1', ['p1'])).toBe(true)
  })

  it('quitar un puesto que no respaldaba ese rol no lo toca', () => {
    expect(perderaElRol('p9', ['p1', 'p2'])).toBe(false)
  })
})
