import { describe, it, expect } from 'vitest'
import { normalizeCedula, isValidCedula, REQUIRES_CEDULA_CODES } from './cedula'

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

describe('REQUIRES_CEDULA_CODES', () => {
  it('PREMAT exige cédula', () => {
    expect(REQUIRES_CEDULA_CODES.has('PREMAT')).toBe(true)
    expect(REQUIRES_CEDULA_CODES.has('N1')).toBe(false)
  })
})
