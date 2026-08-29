import { describe, it, expect } from 'vitest'
import { cuentaHabilitada } from './account-active'

describe('cuentaHabilitada', () => {
  it('solo false bloquea', () => {
    expect(cuentaHabilitada({ is_active: false })).toBe(false)
    expect(cuentaHabilitada({ is_active: true })).toBe(true)
  })

  it('sin ficha, no entra', () => {
    expect(cuentaHabilitada(null)).toBe(false)
    expect(cuentaHabilitada(undefined)).toBe(false)
  })

  it('null/ausente cuenta como activa', () => {
    // A propósito: `is_active` es vieja y hay fichas anteriores al default.
    // Negar por un null bloquearía a gente sana, que es peor que el hueco.
    expect(cuentaHabilitada({ is_active: null })).toBe(true)
    expect(cuentaHabilitada({})).toBe(true)
  })
})
