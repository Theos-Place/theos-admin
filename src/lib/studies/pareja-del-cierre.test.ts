import { describe, it, expect } from 'vitest'
import { parejasDelCierre, participantesActivos } from './pareja-del-cierre'

const GRUPO = 'g-premat'
const sol = (id: string, a: string, b: string) => ({ id, requester_name: a, spouse_name: b })
const par = (id: string, nombre: string, status = 'enrolled') =>
  ({ member_id: id, member_name: nombre, status })

describe('PRE-8 · de dónde sale la pareja al cerrar', () => {
  it('con solicitud vinculada, manda la solicitud', () => {
    // Trae el request_id con el que ya se venía guardando y el historial
    // de la pareja; cambiar eso rompería las evaluaciones existentes.
    const r = parejasDelCierre({
      solicitudes: [sol('req-1', 'Ana', 'Beto')],
      participantes: [par('m1', 'Ana'), par('m2', 'Beto')],
      groupId: GRUPO,
    })
    expect(r).toEqual([{ clave: 'req-1', deSolicitud: true, nombres: 'Ana y Beto' }])
  })

  it('SIN solicitud, la pareja son los participantes', () => {
    // El caso real: los cinco grupos prematrimoniales abiertos se crearon a
    // mano y en toda la base hay una sola solicitud, pendiente y sin grupo.
    const r = parejasDelCierre({
      solicitudes: [],
      participantes: [par('m1', 'Tatiana Longhi'), par('m2', 'Marco Araya')],
      groupId: GRUPO,
    })
    expect(r).toEqual([
      { clave: GRUPO, deSolicitud: false, nombres: 'Tatiana Longhi y Marco Araya' },
    ])
  })

  it('las bajas no son parte de la pareja', () => {
    for (const baja of ['withdrawn', 'dropped', 'cancelada', 'transferred']) {
      const r = parejasDelCierre({
        solicitudes: [],
        participantes: [par('m1', 'Ana'), par('m2', 'Beto', baja)],
        groupId: GRUPO,
      })
      expect(r[0].nombres, baja).toBe('Ana')
    }
  })

  it('con una sola persona igual se evalúa', () => {
    // El otro se retiró, pero el acompañamiento ocurrió. Lo que no se hace
    // es inventar a quien falta.
    const r = parejasDelCierre({
      solicitudes: [], participantes: [par('m1', 'Ana')], groupId: GRUPO,
    })
    expect(r).toHaveLength(1)
    expect(r[0].nombres).toBe('Ana')
  })

  it('sin nadie activo no hay nada que evaluar', () => {
    expect(parejasDelCierre({
      solicitudes: [], participantes: [par('m1', 'Ana', 'withdrawn')], groupId: GRUPO,
    })).toEqual([])
  })

  it('varias solicitudes dan varias parejas', () => {
    const r = parejasDelCierre({
      solicitudes: [sol('r1', 'Ana', 'Beto'), sol('r2', 'Caro', 'Dani')],
      participantes: [], groupId: GRUPO,
    })
    expect(r.map(x => x.nombres)).toEqual(['Ana y Beto', 'Caro y Dani'])
  })

  it('una solicitud a la que le falta un nombre no deja « y » colgando', () => {
    expect(parejasDelCierre({
      solicitudes: [sol('r1', 'Ana', '')], participantes: [], groupId: GRUPO,
    })[0].nombres).toBe('Ana')
  })
})

describe('participantesActivos', () => {
  it('deja fuera las cuatro formas de baja', () => {
    const todos = [
      par('1', 'Activa'), par('2', 'Retirada', 'withdrawn'), par('3', 'Caída', 'dropped'),
      par('4', 'Cancelada', 'cancelada'), par('5', 'Movida', 'transferred'),
      par('6', 'Terminó', 'completed'),
    ]
    expect(participantesActivos(todos).map(p => p.member_name)).toEqual(['Activa', 'Terminó'])
  })
})
