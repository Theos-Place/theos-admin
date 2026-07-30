import { describe, it, expect } from 'vitest'
import { canSeeSummaryRoute, isSummaryRoute } from './module-summary'

describe('canSeeSummaryRoute (SEC-1 2026-07-29)', () => {
  it('el resumen de estudios/servidores exige alcance total', () => {
    expect(canSeeSummaryRoute('/estudios', 'all')).toBe(true)
    expect(canSeeSummaryRoute('/servidores', 'all')).toBe(true)
    // dirigente: estudios scope own → sus grupos, no el resumen
    expect(canSeeSummaryRoute('/estudios', 'own')).toBe(false)
    // lider_comite: servidores scope committee → su comité, no el resumen
    expect(canSeeSummaryRoute('/servidores', 'committee')).toBe(false)
    expect(canSeeSummaryRoute('/estudios', null)).toBe(false)
  })

  it('REGRESIÓN (2026-07-30): /matricula usa el módulo estudios pero NO es un resumen', () => {
    // Bug real: la regla iba por nombre de módulo y dejó sin autoservicio de
    // matrícula a dirigentes y miembros (alcance own).
    expect(canSeeSummaryRoute('/matricula', 'own')).toBe(true)
    expect(canSeeSummaryRoute('/matricula', null)).toBe(true)
    expect(isSummaryRoute('/matricula')).toBe(false)
  })

  it('las subrutas de un módulo de resumen tampoco son el resumen', () => {
    expect(canSeeSummaryRoute('/estudios/grupos', 'own')).toBe(true)
    expect(canSeeSummaryRoute('/estudios/plan', 'own')).toBe(true)
    expect(canSeeSummaryRoute('/servidores/vacantes', 'committee')).toBe(true)
  })

  it('las rutas de otros módulos no se ven afectadas', () => {
    expect(isSummaryRoute('/miembros')).toBe(false)
    expect(canSeeSummaryRoute('/eventos', 'own')).toBe(true)
    expect(canSeeSummaryRoute('/finanzas', 'all')).toBe(true)
  })
})
