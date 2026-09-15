import { describe, it, expect } from 'vitest'
import {
  estadoDelCupo, hayCampo, aplicaLaRevision, conteosPorCupo, ETIQUETA_CUPO,
} from './cupo-del-destino'

describe('hayCampo', () => {
  it('un grupo sin tope nunca está lleno', () => {
    expect(hayCampo({ max_students: null, inscritos: 500 })).toBe(true)
    // Un 0 en la BD es "no configuraron tope", no "cupo cero".
    expect(hayCampo({ max_students: 0, inscritos: 500 })).toBe(true)
  })

  it('lleno es inscritos >= tope, no solo >', () => {
    expect(hayCampo({ max_students: 10, inscritos: 9 })).toBe(true)
    expect(hayCampo({ max_students: 10, inscritos: 10 })).toBe(false)
    expect(hayCampo({ max_students: 10, inscritos: 11 })).toBe(false)
  })
})

describe('estadoDelCupo', () => {
  it('el caso de Karla y María José: único grupo lleno', () => {
    expect(estadoDelCupo([{ max_students: 10, inscritos: 10 }])).toBe('lleno')
  })

  it('basta UN grupo con campo para que la beca sirva', () => {
    expect(estadoDelCupo([
      { max_students: 10, inscritos: 10 },
      { max_students: 12, inscritos: 3 },
    ])).toBe('con_cupo')
  })

  it('sin grupos abiertos NO es lo mismo que lleno', () => {
    // Un plan sin grupos puede abrir uno la otra semana: no hay nada que hacer
    // hoy. Uno lleno hay que resolverlo ya. Mezclarlos vuelve ruido la cola.
    expect(estadoDelCupo([])).toBe('sin_grupos')
    expect(ETIQUETA_CUPO.sin_grupos).not.toBe(ETIQUETA_CUPO.lleno)
  })
})

describe('aplicaLaRevision', () => {
  // 'study_plan' es el valor real de la columna, no 'estudio': el dominio en
  // español no llega hasta scholarships.entity_type. Comprobado contra la BD.
  const base = { status: 'active', used_count: 0, entity_type: 'study_plan', plan_id: 'p1' }

  it('sí para una beca viva y sin usar hacia un plan', () => {
    expect(aplicaLaRevision(base)).toBe(true)
  })

  it('no para una ya usada, revocada, o de evento', () => {
    expect(aplicaLaRevision({ ...base, used_count: 1 })).toBe(false)
    expect(aplicaLaRevision({ ...base, status: 'used' })).toBe(false)
    expect(aplicaLaRevision({ ...base, status: 'revoked' })).toBe(false)
    expect(aplicaLaRevision({ ...base, entity_type: 'event', plan_id: null })).toBe(false)
  })

  it('no si el entity_type no es el de la BD: un typo no debe pasar por bueno', () => {
    expect(aplicaLaRevision({ ...base, entity_type: 'estudio' })).toBe(false)
  })

  it('no si apunta a un plan pero sin plan_id: no hay dónde mirar el cupo', () => {
    expect(aplicaLaRevision({ ...base, plan_id: null })).toBe(false)
  })
})

describe('conteosPorCupo', () => {
  it('cuenta sobre la lista completa, incluido el total', () => {
    const c = conteosPorCupo(['lleno', 'lleno', 'con_cupo', 'sin_grupos', 'no_aplica'])
    expect(c).toEqual({ lleno: 2, con_cupo: 1, sin_grupos: 1, no_aplica: 1, todas: 5 })
  })
})
