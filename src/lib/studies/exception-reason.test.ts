import { describe, it, expect } from 'vitest'
import {
  validateExceptionReason, isValidExceptionReason, REASON_MIN, REASON_MAX,
} from './exception-reason'

describe('validateExceptionReason', () => {
  it('vacío, espacios o nada → pide la razón', () => {
    for (const v of ['', '   ', '\n\t ', null, undefined]) {
      expect(validateExceptionReason(v)).toBeTruthy()
      expect(isValidExceptionReason(v)).toBe(false)
    }
  })

  it('demasiado corta → no pasa (el trim se aplica antes de contar)', () => {
    expect(isValidExceptionReason('sirve')).toBe(false)
    expect(isValidExceptionReason('   corta   ')).toBe(false)
    expect(isValidExceptionReason('a'.repeat(REASON_MIN - 1))).toBe(false)
  })

  it('justo en el mínimo ya sirve', () => {
    expect(isValidExceptionReason('a'.repeat(REASON_MIN))).toBe(true)
  })

  it('una frase real pasa', () => {
    expect(validateExceptionReason(
      'Lleva 3 años sirviendo en alabanza y su asistencia no quedó registrada.',
    )).toBeNull()
  })

  it('pasada del máximo → no pasa', () => {
    expect(isValidExceptionReason('a'.repeat(REASON_MAX + 1))).toBe(false)
    expect(isValidExceptionReason('a'.repeat(REASON_MAX))).toBe(true)
  })

  it('los mensajes dicen qué hacer, no solo que está mal', () => {
    expect(validateExceptionReason('')).toContain('Escribí la razón')
    expect(validateExceptionReason('corta')).toContain('por qué se hace la excepción')
  })
})
