import { describe, it, expect } from 'vitest'
import { addCalendarMonths, minCeremonyDate, ceremonyDateTooSoon } from './premat-dates'

describe('premat-dates (PRE-3: boda mínimo hoy + 6 meses calendario)', () => {
  it('suma meses calendario simples', () => {
    expect(addCalendarMonths('2026-07-26', 6)).toBe('2027-01-26')
    expect(addCalendarMonths('2026-01-15', 6)).toBe('2026-07-15')
  })

  it('ajusta al último día cuando el mes destino es más corto', () => {
    expect(addCalendarMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addCalendarMonths('2024-08-31', 6)).toBe('2025-02-28')
    expect(addCalendarMonths('2023-08-31', 6)).toBe('2024-02-29') // bisiesto
  })

  it('cruza el año correctamente', () => {
    expect(minCeremonyDate('2026-11-05')).toBe('2027-05-05')
  })

  it('es meses calendario, NO 180 días', () => {
    // 2026-07-26 + 180 días = 2027-01-22, que sería aceptado con la regla de días.
    expect(ceremonyDateTooSoon('2027-01-22', '2026-07-26')).toBe(true)
    expect(ceremonyDateTooSoon('2027-01-26', '2026-07-26')).toBe(false)
  })

  it('rechaza justo un día antes del mínimo y acepta el mínimo exacto', () => {
    expect(ceremonyDateTooSoon('2027-01-25', '2026-07-26')).toBe(true)
    expect(ceremonyDateTooSoon('2027-01-26', '2026-07-26')).toBe(false)
    expect(ceremonyDateTooSoon('2027-06-01', '2026-07-26')).toBe(false)
  })
})
