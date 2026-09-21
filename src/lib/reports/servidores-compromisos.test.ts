import { describe, it, expect } from 'vitest'
import {
  cumplimiento, porcentajes, desglose, hayGenteCompartida, type ServidorDelReporte,
} from './servidores-compromisos'

const s = (x: Partial<ServidorDelReporte> & { member_id: string }): ServidorDelReporte => ({
  nombre: x.member_id, comites: ['c1'],
  asistencia: false, llevandoEstudio: false, dandoEstudio: false, donante: false,
  ultimoCheckin: null, ...x,
})

describe('cumplimiento', () => {
  it('des-duplica a quien sirve en dos comités del alcance', () => {
    // Sin esto los totales inflarían a la gente más comprometida, que es
    // justamente la que sirve en más lugares.
    const gente = [
      s({ member_id: 'ana', comites: ['c1'], asistencia: true }),
      s({ member_id: 'ana', comites: ['c2'], asistencia: true }),
      s({ member_id: 'beto' }),
    ]
    const c = cumplimiento(gente)
    expect(c.total).toBe(2)
    expect(c.asistencia).toBe(1)
  })

  it('estudio cumple con llevar O con dar', () => {
    expect(cumplimiento([s({ member_id: 'a', dandoEstudio: true })]).estudio).toBe(1)
    expect(cumplimiento([s({ member_id: 'b', llevandoEstudio: true })]).estudio).toBe(1)
  })

  it('"todo" exige los tres', () => {
    const casi = s({ member_id: 'a', asistencia: true, llevandoEstudio: true })
    const completo = s({ member_id: 'b', asistencia: true, llevandoEstudio: true, donante: true })
    const c = cumplimiento([casi, completo])
    expect(c.todo).toBe(1)
    expect(c.conPendientes).toBe(1)
  })

  it('sin nadie no revienta', () => {
    expect(cumplimiento([])).toMatchObject({ total: 0, todo: 0 })
  })
})

describe('porcentajes', () => {
  it('sin nadie son null y no 0%', () => {
    // 0% dice "ninguno cumple"; null dice "no hay a quién medir".
    expect(porcentajes(cumplimiento([]))).toEqual({ asistencia: null, estudio: null, donante: null, todo: null })
  })

  it('redondea', () => {
    const gente = [s({ member_id: 'a', donante: true }), s({ member_id: 'b' }), s({ member_id: 'c' })]
    expect(porcentajes(cumplimiento(gente)).donante).toBe(33)
  })
})

describe('desglose', () => {
  const gente = [
    s({ member_id: 'ana', comites: ['c1'], asistencia: true, donante: true, llevandoEstudio: true }),
    s({ member_id: 'ana', comites: ['c2'], asistencia: true, donante: true, llevandoEstudio: true }),
    s({ member_id: 'beto', comites: ['c2'] }),
  ]
  const grupos = [{ id: 'c1', nombre: 'Uno' }, { id: 'c2', nombre: 'Dos' }, { id: 'c3', nombre: 'Vacío' }]
  const pertenece = (x: ServidorDelReporte, g: string) => x.comites.includes(g)

  it('una persona en dos comités aparece en los dos', () => {
    const d = desglose(gente, grupos, pertenece)
    expect(d.find(f => f.id === 'c1')!.cumplimiento.total).toBe(1)
    expect(d.find(f => f.id === 'c2')!.cumplimiento.total).toBe(2)
  })

  it('las filas no suman el total, y está bien: es gente compartida', () => {
    const d = desglose(gente, grupos, pertenece)
    const suma = d.reduce((n, f) => n + f.cumplimiento.total, 0)
    expect(suma).toBe(3)
    expect(cumplimiento(gente).total).toBe(2)
  })

  it('primero el que peor va: el reporte existe para encontrar dónde ayudar', () => {
    expect(desglose(gente, grupos, pertenece).map(f => f.nombre)).toEqual(['Dos', 'Uno'])
  })

  it('un comité sin servidores no aparece', () => {
    expect(desglose(gente, grupos, pertenece).map(f => f.id)).not.toContain('c3')
  })
})

describe('hayGenteCompartida', () => {
  it('avisa cuando alguien sirve en más de un comité del alcance', () => {
    expect(hayGenteCompartida([s({ member_id: 'a', comites: ['c1', 'c2'] })])).toBe(true)
    expect(hayGenteCompartida([s({ member_id: 'a', comites: ['c1'] })])).toBe(false)
  })
})
