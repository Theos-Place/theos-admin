import { describe, it, expect } from 'vitest'
import {
  miembrosDelPuesto, conteoDelPuesto, tituloDelPuesto, filasParaExport, nombreDeArchivo,
} from './miembros-del-puesto'
import type { CommitteeServer } from '@/types/server'

const s = (o: Partial<CommitteeServer> & { name: string }): CommitteeServer => ({
  member_id: o.name, initials: '', position: 'Colaborador Comida', position_id: 'p1',
  start_date: '2025-01-15', status: 'active', ...o,
})
const comite = { members: [
  s({ name: 'Zulema' }),
  s({ name: 'Ana' }),
  s({ name: 'Beto', status: 'inactive' }),
  s({ name: 'Carla', position: 'Anfitrión', position_id: 'p2' }),
] }

describe('miembros de un puesto', () => {
  it('solo los de ESE puesto, y por defecto solo activos', () => {
    expect(miembrosDelPuesto(comite, 'p1').map(m => m.name)).toEqual(['Ana', 'Zulema'])
  })

  it('con el toggle entran los inactivos, y van al final', () => {
    expect(miembrosDelPuesto(comite, 'p1', { incluirInactivos: true }).map(m => m.name))
      .toEqual(['Ana', 'Zulema', 'Beto'])
  })

  it('sin puesto o sin comité, lista vacía', () => {
    expect(miembrosDelPuesto(comite, null)).toEqual([])
    expect(miembrosDelPuesto(null, 'p1')).toEqual([])
  })

  it('trae la antigüedad calculada', () => {
    expect(miembrosDelPuesto(comite, 'p1')[0].antiguedad).toMatch(/año|mes/)
  })
})

describe('conteo del encabezado', () => {
  // No puede depender del toggle: "12 activos" no cambia al mostrar inactivos.
  it('cuenta sobre la lista completa, no la visible', () => {
    expect(conteoDelPuesto(comite, 'p1')).toEqual({ activos: 2, inactivos: 1 })
  })

  it('un puesto sin nadie da ceros', () => {
    expect(conteoDelPuesto(comite, 'p9')).toEqual({ activos: 0, inactivos: 0 })
  })
})

describe('título del encabezado', () => {
  it('dice cuántos activos', () => {
    expect(tituloDelPuesto('Colaborador Comida', { activos: 12, inactivos: 3 }))
      .toBe('Colaborador Comida — 12 activos')
  })

  it('singular con uno', () => {
    expect(tituloDelPuesto('Encargado', { activos: 1, inactivos: 0 })).toBe('Encargado — 1 activo')
  })

  // Un "0 activos" pelado se lee como error de carga; se dice con palabras.
  it('sin nadie lo dice, no muestra un cero', () => {
    expect(tituloDelPuesto('Músico', { activos: 0, inactivos: 0 })).toBe('Músico — sin nadie asignado')
    expect(tituloDelPuesto('Músico', { activos: 0, inactivos: 4 })).toBe('Músico — sin nadie activo')
  })
})

describe('filas para el export', () => {
  it('lleva comité y área, que la fila del puesto no trae', () => {
    const f = filasParaExport(miembrosDelPuesto(comite, 'p1'), { comite: 'Sede Madrid', area: 'Sedes', lider: 'Ana' })
    expect(f).toHaveLength(2)
    expect(f[0]).toMatchObject({ name: 'Ana', committee: 'Sede Madrid', area: 'Sedes', status: 'active' })
  })

  it('el estado se normaliza a active/inactive', () => {
    const f = filasParaExport(miembrosDelPuesto(comite, 'p1', { incluirInactivos: true }), { comite: 'c', area: 'a', lider: '' })
    expect(f.map(x => x.status)).toEqual(['active', 'active', 'inactive'])
  })
})

describe('nombre del archivo', () => {
  it('sin tildes ni espacios', () => {
    expect(nombreDeArchivo('Sede Pérez Zeledón', 'Colaborador Información'))
      .toBe('sede-perez-zeledon-colaborador-informacion')
  })

  it('ignora las partes vacías', () => {
    expect(nombreDeArchivo('Comité GO', null, undefined, '')).toBe('comite-go')
  })

  it('nunca queda vacío', () => {
    expect(nombreDeArchivo(null, '')).toBe('servidores')
  })
})
