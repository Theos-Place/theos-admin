import { describe, it, expect } from 'vitest'
import { canSeeModuleSummary, isSummaryModule } from './module-summary'

describe('canSeeModuleSummary (SEC-1 2026-07-29)', () => {
  it('el resumen de estudios/servidores exige alcance total', () => {
    expect(canSeeModuleSummary('estudios', 'all')).toBe(true)
    expect(canSeeModuleSummary('servidores', 'all')).toBe(true)
    // dirigente: estudios scope own → sus grupos, no el resumen
    expect(canSeeModuleSummary('estudios', 'own')).toBe(false)
    // lider_comite: servidores scope committee → su comité, no el resumen
    expect(canSeeModuleSummary('servidores', 'committee')).toBe(false)
  })

  it('sin el módulo no hay resumen', () => {
    expect(canSeeModuleSummary('estudios', null)).toBe(false)
  })

  it('los módulos que no son resumen organizacional no se ven afectados', () => {
    expect(isSummaryModule('miembros')).toBe(false)
    expect(canSeeModuleSummary('eventos', 'own')).toBe(true)
    expect(canSeeModuleSummary('finanzas', 'all')).toBe(true)
  })
})
