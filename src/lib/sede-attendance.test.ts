import { describe, it, expect } from 'vitest'
import { computeMemberSede, formatSedeRecency } from './sede-attendance'

const c = (checked_in_at: string, title = 'Charla Cartago') => ({ checked_in_at, title })

describe('computeMemberSede', () => {
  it('sin check-ins → null', () => {
    expect(computeMemberSede([])).toBeNull()
  })

  it('sin check-ins con sede reconocible → null (título no canónico se ignora)', () => {
    expect(computeMemberSede([c('2026-06-01T00:00:00Z', 'Actividad especial')])).toBeNull()
  })

  it('caso activo: sede = más asistida en los últimos 6 meses', () => {
    const now = new Date('2026-07-15T12:00:00Z')
    const checkins = [
      c('2026-07-01T00:00:00Z', 'Charla Cartago'),
      c('2026-06-01T00:00:00Z', 'Charla Cartago'),
      c('2026-05-01T00:00:00Z', 'Charla Heredia'),
    ]
    const res = computeMemberSede(checkins, now)
    expect(res).toEqual({ name: 'Cartago', case: 'activo', lastCheckin: '2026-07-01T00:00:00Z' })
  })

  it('empate en el caso activo → gana la más reciente', () => {
    const now = new Date('2026-07-15T12:00:00Z')
    const checkins = [
      c('2026-06-01T00:00:00Z', 'Charla Cartago'),
      c('2026-07-01T00:00:00Z', 'Charla Heredia'),
    ]
    const res = computeMemberSede(checkins, now)
    expect(res?.name).toBe('Heredia')
  })

  it('caso inactivo: usa la ventana de 6 meses previa a la última asistencia, no todo el historial', () => {
    const now = new Date('2026-07-15T12:00:00Z') // última asistencia hace 8 meses → inactivo
    const checkins = [
      // Mayoría histórica (hace más de un año): Alajuela — no debe ganar.
      c('2024-01-01T00:00:00Z', 'Charla Alajuela'),
      c('2024-02-01T00:00:00Z', 'Charla Alajuela'),
      c('2024-03-01T00:00:00Z', 'Charla Alajuela'),
      // Su último período activo (los 6 meses antes de su última asistencia, nov-2025): Cartago.
      c('2025-08-01T00:00:00Z', 'Charla Cartago'),
      c('2025-09-01T00:00:00Z', 'Charla Cartago'),
      c('2025-11-01T00:00:00Z', 'Charla Cartago'), // última asistencia
    ]
    const res = computeMemberSede(checkins, now)
    expect(res).toEqual({ name: 'Cartago', case: 'inactivo', lastCheckin: '2025-11-01T00:00:00Z' })
  })
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
