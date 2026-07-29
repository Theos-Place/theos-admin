import { describe, it, expect } from 'vitest'
import {
  validatePrematEvaluation, needsFollowUp, PREMAT_EVAL_ROLES,
  STRENGTH_OPTIONS, TOPIC_OPTIONS, ACTION_PLAN_OPTIONS, COMMITMENT_OPTIONS,
  type PrematEvaluationInput,
} from './premat-evaluation'

function base(over: Partial<PrematEvaluationInput> = {}): PrematEvaluationInput {
  return {
    request_id: 'req-1',
    commitment: 'si',
    strengths: [],
    topics_to_work: [],
    blind_spot: false,
    action_plan: 'listos',
    ...over,
  }
}

describe('validatePrematEvaluation (PRE-8)', () => {
  it('evaluación mínima válida', () => {
    expect(validatePrematEvaluation(base())).toBeNull()
  })

  it('compromiso obligatorio y del catálogo', () => {
    expect(validatePrematEvaluation(base({ commitment: '' }))).toMatch(/compromiso/i)
    expect(validatePrematEvaluation(base({ commitment: 'quizas' }))).toMatch(/compromiso/i)
  })

  it('plan de acción obligatorio y del catálogo', () => {
    expect(validatePrematEvaluation(base({ action_plan: '' }))).toMatch(/plan de acción/i)
    expect(validatePrematEvaluation(base({ action_plan: 'inventado' }))).toMatch(/plan de acción/i)
  })

  it('punto ciego en Sí exige descripción', () => {
    expect(validatePrematEvaluation(base({ blind_spot: true }))).toMatch(/describilo/i)
    expect(validatePrematEvaluation(base({ blind_spot: true, blind_spot_notes: '  ' }))).toMatch(/describilo/i)
    expect(validatePrematEvaluation(base({ blind_spot: true, blind_spot_notes: 'Desacuerdo en finanzas' }))).toBeNull()
  })

  it('fortalezas y temas deben venir del catálogo', () => {
    expect(validatePrematEvaluation(base({ strengths: [STRENGTH_OPTIONS[0]] }))).toBeNull()
    expect(validatePrematEvaluation(base({ strengths: ['otra cosa'] }))).toMatch(/fortalezas/i)
    expect(validatePrematEvaluation(base({ topics_to_work: [TOPIC_OPTIONS[3]] }))).toBeNull()
    expect(validatePrematEvaluation(base({ topics_to_work: ['tema raro'] }))).toMatch(/10 temas/i)
  })

  it('los 10 temas del curso están completos', () => {
    expect(TOPIC_OPTIONS).toHaveLength(10)
    expect(STRENGTH_OPTIONS).toHaveLength(6)
    expect(ACTION_PLAN_OPTIONS).toHaveLength(3)
    expect(COMMITMENT_OPTIONS.map(o => o.value)).toEqual(['si', 'en_proceso', 'requiere_atencion'])
  })
})

describe('needsFollowUp (PRE-8)', () => {
  it('"listos" cierra regular; consejería y posponer dejan seguimiento', () => {
    expect(needsFollowUp('listos')).toBe(false)
    expect(needsFollowUp('consejeria')).toBe(true)
    expect(needsFollowUp('posponer')).toBe(true)
  })
})

describe('visibilidad (PRE-8)', () => {
  it('coordinador_dirigentes puede cerrar grupos pero NO ve la evaluación', () => {
    expect(PREMAT_EVAL_ROLES).toEqual(['coordinador_estudios', 'direccion', 'admin'])
    expect(PREMAT_EVAL_ROLES).not.toContain('coordinador_dirigentes')
    expect(PREMAT_EVAL_ROLES).not.toContain('miembro')
    expect(PREMAT_EVAL_ROLES).not.toContain('dirigente')
  })
})
