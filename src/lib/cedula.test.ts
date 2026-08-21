import { describe, it, expect } from 'vitest'
import { normalizeCedula, isValidCedula } from './cedula'

describe('normalizeCedula', () => {
  it('quita guiones y espacios', () => {
    expect(normalizeCedula('1-1234-5678')).toBe('112345678')
    expect(normalizeCedula(' 1 1234 5678 ')).toBe('112345678')
  })
})

describe('isValidCedula', () => {
  it('acepta nacional de 9 dígitos (con o sin guiones)', () => {
    expect(isValidCedula('112345678')).toBe(true)
    expect(isValidCedula('1-1234-5678')).toBe(true)
    expect(isValidCedula('503990975')).toBe(true)
  })
  it('acepta DIMEX de 11-12 dígitos', () => {
    expect(isValidCedula('11223344556')).toBe(true)
    expect(isValidCedula('112233445566')).toBe(true)
  })
  it('rechaza vacío, nulo, longitud inválida o no numérico', () => {
    expect(isValidCedula('')).toBe(false)
    expect(isValidCedula(null)).toBe(false)
    expect(isValidCedula(undefined)).toBe(false)
    expect(isValidCedula('12345')).toBe(false)      // muy corta
    expect(isValidCedula('1234567890')).toBe(false) // 10 dígitos (jurídica, no persona)
    expect(isValidCedula('11-abc-678')).toBe(false) // con letras
  })
})

// ── INT-1: documento por tipo ─────────────────────────────────────────────────
import { isValidDocument } from './cedula'

describe('isValidDocument (INT-1)', () => {
  it('cedula: formato CR', () => {
    expect(isValidDocument('cedula', '1-1234-5678')).toBe(true)
    expect(isValidDocument('cedula', '123')).toBe(false)
  })

  it('dni_nie: 8 dígitos + letra; NIE con X/Y/Z; case-insensitive', () => {
    expect(isValidDocument('dni_nie', '12345678Z')).toBe(true)
    expect(isValidDocument('dni_nie', 'x1234567l')).toBe(true)
    expect(isValidDocument('dni_nie', '12345678')).toBe(false)
    expect(isValidDocument('dni_nie', '1-1234-5678')).toBe(false)
  })

  it('pasaporte/otro: alfanumérico 5-20', () => {
    expect(isValidDocument('pasaporte', 'AB123456')).toBe(true)
    expect(isValidDocument('pasaporte', 'A1')).toBe(false)
    expect(isValidDocument('otro', 'CC 1098765432')).toBe(true) // guiones/espacios se normalizan
    // Puntos NO se normalizan (la columna generada de BD solo quita [-\s]):
    // el número se captura sin puntos.
    expect(isValidDocument('otro', 'CC-1.098.765.432')).toBe(false)
    expect(isValidDocument('otro', null)).toBe(false)
  })
})
