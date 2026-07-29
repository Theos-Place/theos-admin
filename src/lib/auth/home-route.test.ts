import { describe, it, expect } from 'vitest'
import { landsOnProfile } from './home-route'

describe('landsOnProfile (SEC-1 ampliado 2026-07-29)', () => {
  it('miembro, dirigente y líder de comité aterrizan en su perfil (sin dashboard)', () => {
    expect(landsOnProfile(['miembro'])).toBe(true)
    expect(landsOnProfile(['dirigente'])).toBe(true)
    expect(landsOnProfile(['lider_comite'])).toBe(true)
    expect(landsOnProfile(['miembro', 'dirigente'])).toBe(true)
    expect(landsOnProfile(['dirigente', 'lider_comite'])).toBe(true)
    expect(landsOnProfile([])).toBe(true) // sin roles = miembro default
  })

  it('cualquier rol administrativo conserva el dashboard', () => {
    expect(landsOnProfile(['admin'])).toBe(false)
    expect(landsOnProfile(['coordinador_estudios'])).toBe(false)
    expect(landsOnProfile(['dirigente', 'coordinador_dirigentes'])).toBe(false)
    expect(landsOnProfile(['miembro', 'finanzas'])).toBe(false)
    expect(landsOnProfile(['encargado_eventos'])).toBe(false) // tiene su propio redirect a check-in
  })
})
