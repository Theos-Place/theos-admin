import { describe, it, expect } from 'vitest'
import { coincide, filtrarSolicitudes, conteos, filtroInicial, textoVacio, FILTROS } from './filtro-solicitudes-beca'

const lista = [
  { status: 'open' }, { status: 'open' }, { status: 'in_review' },
  { status: 'resolved' }, { status: 'resolved' }, { status: 'resolved' }, { status: 'rejected' },
]

describe('a qué filtro pertenece cada estado', () => {
  it('"Por revisar" junta abierta y en revisión', () => {
    expect(coincide('open', 'pendientes')).toBe(true)
    expect(coincide('in_review', 'pendientes')).toBe(true)
    expect(coincide('resolved', 'pendientes')).toBe(false)
  })

  it('"Todas" no filtra nada', () => {
    for (const s of ['open', 'in_review', 'resolved', 'rejected', 'raro']) {
      expect(coincide(s, 'all'), s).toBe(true)
    }
  })

  it('los demás filtran por estado exacto', () => {
    expect(coincide('resolved', 'resolved')).toBe(true)
    expect(coincide('rejected', 'resolved')).toBe(false)
  })
})

describe('filtrar la lista', () => {
  it('por revisar trae las 3 que esperan a alguien', () => {
    expect(filtrarSolicitudes(lista, 'pendientes')).toHaveLength(3)
  })

  it('aprobadas trae 3, rechazadas 1, todas 7', () => {
    expect(filtrarSolicitudes(lista, 'resolved')).toHaveLength(3)
    expect(filtrarSolicitudes(lista, 'rejected')).toHaveLength(1)
    expect(filtrarSolicitudes(lista, 'all')).toHaveLength(7)
  })
})

describe('conteos de las pastillas', () => {
  // Se cuentan sobre la lista completa: si dependieran del filtro activo,
  // mostrarían cero apenas se elige otro.
  it('no dependen del filtro activo', () => {
    const c = conteos(lista)
    expect(c).toMatchObject({ pendientes: 3, resolved: 3, rejected: 1, all: 7 })
  })

  it('lista vacía da ceros', () => {
    expect(conteos([])).toMatchObject({ pendientes: 0, all: 0 })
  })
})

describe('filtro inicial', () => {
  it('abre en "por revisar" cuando hay trabajo', () => {
    expect(filtroInicial(lista)).toBe('pendientes')
  })

  // Sin pendientes, abrir en "por revisar" daría una pantalla vacía de entrada.
  it('abre en "todas" cuando no hay nada pendiente', () => {
    expect(filtroInicial([{ status: 'resolved' }])).toBe('all')
    expect(filtroInicial([])).toBe('all')
  })
})

describe('texto del vacío', () => {
  it('sin ninguna solicitud lo dice sin mencionar el filtro', () => {
    expect(textoVacio('pendientes', false)).toBe('No hay solicitudes de beca')
  })

  // "No hay solicitudes" es mentira cuando lo que falta es de ESE estado.
  it('con solicitudes pero ninguna del filtro, lo aclara', () => {
    expect(textoVacio('pendientes', true)).toBe('No hay solicitudes por revisar')
    expect(textoVacio('rejected', true)).toBe('No hay solicitudes rechazadas')
  })
})

describe('las opciones', () => {
  it('la primera es la de trabajo pendiente', () => {
    expect(FILTROS[0].id).toBe('pendientes')
  })
})
