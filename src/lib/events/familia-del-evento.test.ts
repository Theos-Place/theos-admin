import { describe, it, expect } from 'vitest'
import { comitesDeLaPuerta } from './familia-del-evento'
import { puedeOperarEvento } from '@/lib/auth/alcance-de-eventos'

const SEDE = 'sede-pedregal-domingos'
const YOUTH = 'comite-youth'
const AJENO = 'sede-liberia'

describe('comitesDeLaPuerta', () => {
  it('suma el comité del subevento a los del evento', () => {
    expect(comitesDeLaPuerta([SEDE], [YOUTH]).sort()).toEqual([YOUTH, SEDE].sort())
  })

  it('un subevento sin comité no agrega nada ni rompe', () => {
    expect(comitesDeLaPuerta([SEDE], [null, undefined])).toEqual([SEDE])
  })

  it('no repite si el subevento lo opera el mismo comité del evento', () => {
    expect(comitesDeLaPuerta([SEDE], [SEDE])).toEqual([SEDE])
  })

  it('un evento sin comité pero con subevento que sí tiene, abre por el subevento', () => {
    expect(comitesDeLaPuerta([], [YOUTH])).toEqual([YOUTH])
  })

  it('sin nada devuelve vacío: el evento sigue cerrado para el alcance por comité', () => {
    expect(comitesDeLaPuerta([], [])).toEqual([])
  })
})

describe('el caso real del 2026-09-21', () => {
  // Charla Pedregal Domingo (comité: Sede Pedregal Domingos) con subevento
  // Youth (comité: Comité Youth).
  const puerta = comitesDeLaPuerta([SEDE], [YOUTH])
  const alcanceDe = (comites: string[]) => ({ alcance: 'comites' as const, comites })

  it('el comité del SUBEVENTO opera la puerta', () => {
    expect(puedeOperarEvento(alcanceDe([YOUTH]), puerta)).toBe(true)
  })

  it('y con la lista angosta NO podía: eso era el bug', () => {
    expect(puedeOperarEvento(alcanceDe([YOUTH]), [SEDE])).toBe(false)
  })

  it('el comité del EVENTO sigue operando, y también la estación de Youth', () => {
    expect(puedeOperarEvento(alcanceDe([SEDE]), puerta)).toBe(true)
  })

  it('un comité ajeno a la familia sigue afuera', () => {
    expect(puedeOperarEvento(alcanceDe([AJENO]), puerta)).toBe(false)
  })

  it('quien tiene alcance total no se ve afectado', () => {
    expect(puedeOperarEvento({ alcance: 'todos' }, [])).toBe(true)
  })
})
