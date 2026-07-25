import { describe, it, expect } from 'vitest'
import { VACANCY_STATES, VACANCY_STATE_LABEL, VACANCY_STATE_BADGE, isVacancyState } from './vacancy-states'

describe('vacancy-states (vocabulario unificado, migración 20260725120000)', () => {
  it('acepta los cinco estados del vocabulario nuevo', () => {
    for (const s of ['creado', 'enviado_lider', 'aprobado', 'denegado', 'cerrada']) {
      expect(isVacancyState(s)).toBe(true)
    }
  })

  it('rechaza los estados legacy absorbidos por la migración', () => {
    // draft→creado, published→aprobado, filled/closed→cerrada
    for (const legacy of ['draft', 'published', 'filled', 'closed']) {
      expect(isVacancyState(legacy)).toBe(false)
    }
  })

  it('todo estado tiene label y badge', () => {
    for (const s of VACANCY_STATES) {
      expect(VACANCY_STATE_LABEL[s]).toBeTruthy()
      expect(VACANCY_STATE_BADGE[s]).toBeTruthy()
    }
  })
})
