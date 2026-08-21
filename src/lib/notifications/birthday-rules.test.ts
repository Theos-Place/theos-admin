import { describe, it, expect } from 'vitest'
import {
  isLeapYear, birthdayMatchDays, greetingSkipReason, yearStartIsoCR,
  isMonthlyDigestDay, monthOf,
} from './birthday-rules'

describe('isLeapYear', () => {
  it('divisible entre 4 sí, entre 100 no, entre 400 sí', () => {
    expect(isLeapYear(2024)).toBe(true)
    expect(isLeapYear(2026)).toBe(false)
    expect(isLeapYear(1900)).toBe(false)   // divisible entre 100
    expect(isLeapYear(2000)).toBe(true)    // divisible entre 400
  })
})

describe('birthdayMatchDays', () => {
  it('un día normal felicita solo ese día', () => {
    expect(birthdayMatchDays('2026-09-15')).toEqual(['09-15'])
    expect(birthdayMatchDays('2026-01-01')).toEqual(['01-01'])
  })

  // El caso que pide la spec: en años NO bisiestos, la gente del 29 se felicita el 28.
  it('el 28 de febrero de un año no bisiesto suma a los del 29', () => {
    expect(birthdayMatchDays('2026-02-28')).toEqual(['02-28', '02-29'])
    expect(birthdayMatchDays('2027-02-28')).toEqual(['02-28', '02-29'])
  })

  it('en año bisiesto el 28 es solo el 28: el 29 tiene su propio día', () => {
    expect(birthdayMatchDays('2024-02-28')).toEqual(['02-28'])
    expect(birthdayMatchDays('2024-02-29')).toEqual(['02-29'])
  })

  it('rechaza formatos inválidos', () => {
    expect(birthdayMatchDays('28/02/2026')).toEqual([])
    expect(birthdayMatchDays('')).toEqual([])
  })
})

describe('greetingSkipReason', () => {
  const ok = { member_id: 'm1', email: 'a@b.com', birth_date: '1990-09-15' }

  it('con correo válido y fecha, se manda', () => {
    expect(greetingSkipReason(ok)).toBeNull()
  })

  // Los rebotados quedan fuera: insistirle a una dirección muerta quema el dominio.
  it('excluye rebotados y quejas', () => {
    expect(greetingSkipReason({ ...ok, email_bounced: true })).toBe('rebotado')
    expect(greetingSkipReason({ ...ok, email_complained: true })).toBe('queja')
  })

  it('excluye sin correo y sin fecha', () => {
    expect(greetingSkipReason({ ...ok, email: null })).toBe('sin_correo')
    expect(greetingSkipReason({ ...ok, email: '   ' })).toBe('sin_correo')
    expect(greetingSkipReason({ ...ok, birth_date: null })).toBe('sin_fecha')
  })

  it('la fecha se revisa antes que el correo', () => {
    expect(greetingSkipReason({ member_id: 'm1', email: null, birth_date: null })).toBe('sin_fecha')
  })
})

describe('yearStartIsoCR', () => {
  it('ancla el dedupe al 1 de enero en hora CR', () => {
    expect(yearStartIsoCR('2026-09-15')).toBe('2026-01-01T00:00:00-06:00')
    expect(yearStartIsoCR('2027-02-28')).toBe('2027-01-01T00:00:00-06:00')
  })
})

describe('resumen mensual', () => {
  it('solo el día 1', () => {
    expect(isMonthlyDigestDay('2026-09-01')).toBe(true)
    expect(isMonthlyDigestDay('2026-09-02')).toBe(false)
    expect(isMonthlyDigestDay('2026-09-30')).toBe(false)
  })

  it('el mes sale como MM', () => {
    expect(monthOf('2026-09-01')).toBe('09')
    expect(monthOf('2026-12-01')).toBe('12')
  })
})
