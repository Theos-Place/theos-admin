import { describe, it, expect } from 'vitest'
import { computeMemberSede, formatSedeRecency } from './sede-attendance'
import { SEDE_RULE_CASES } from './sede-rule-fixtures'

// La regla de sede vive en dos implementaciones espejo (TS aquí, SQL en
// refresh_member_sedes). Los casos son el CONTRATO compartido (sede-rule-fixtures.ts):
// esta suite valida el lado TS; sirven de especificación única para el SQL.
describe('computeMemberSede (contrato de la regla de sede)', () => {
  for (const tc of SEDE_RULE_CASES) {
    it(tc.name, () => {
      expect(computeMemberSede(tc.checkins, new Date(tc.now))).toEqual(tc.expected)
    })
  }
})

describe('formatSedeRecency', () => {
  it('redondea a meses calendario', () => {
    const now = new Date('2026-07-15T00:00:00Z')
    expect(formatSedeRecency('2026-06-01T00:00:00Z', now)).toBe('hace 1 mes')
    expect(formatSedeRecency('2025-11-01T00:00:00Z', now)).toBe('hace 8 meses')
  })

  it('a partir de 12 meses usa "hace más de un año"', () => {
    const now = new Date('2026-07-15T00:00:00Z')
    expect(formatSedeRecency('2025-07-01T00:00:00Z', now)).toBe('hace más de un año')
    expect(formatSedeRecency('2020-01-01T00:00:00Z', now)).toBe('hace más de un año')
  })
})
