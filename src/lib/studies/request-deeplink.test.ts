import { describe, it, expect } from 'vitest'
import { resolveRequestSection, requestDeepLink } from './request-deeplink'

describe('requestDeepLink', () => {
  it('lleva el tipo y el id', () => {
    expect(requestDeepLink('relocation', 'abc')).toBe('/estudios/solicitudes?tab=relocation&request=abc')
    expect(requestDeepLink('study_interest', 'abc')).toBe('/estudios/solicitudes?tab=study_interest&request=abc')
  })
})

describe('resolveRequestSection (deep link de la notificación)', () => {
  it('link nuevo: abre el tab del tipo, para los dos tipos', () => {
    for (const t of ['relocation', 'study_interest'] as const) {
      expect(resolveRequestSection({
        tabParam: t, requestId: 'r1', requestType: t, fullQueue: true,
      })).toBe(t)
    }
  })

  it('link viejo (?request= sin ?tab=): provisional reubicaciones y luego el tipo real', () => {
    // Antes de cargar la lista no se sabe el tipo.
    expect(resolveRequestSection({ requestId: 'r1', fullQueue: true })).toBe('relocation')
    // Con la lista cargada manda el tipo real.
    expect(resolveRequestSection({
      requestId: 'r1', requestType: 'study_interest', fullQueue: true,
    })).toBe('study_interest')
  })

  it('el TIPO real gana sobre un ?tab= equivocado', () => {
    expect(resolveRequestSection({
      tabParam: 'prematrimonial', requestId: 'r1', requestType: 'relocation', fullQueue: true,
    })).toBe('relocation')
    expect(resolveRequestSection({
      tabParam: 'relocation', requestId: 'r1', requestType: 'study_interest', fullQueue: true,
    })).toBe('study_interest')
  })

  it('sin ?request=: respeta el ?tab= y si no, abre prematrimonial', () => {
    expect(resolveRequestSection({ tabParam: 'study_interest', fullQueue: true })).toBe('study_interest')
    expect(resolveRequestSection({ tabParam: 'basura', fullQueue: true })).toBe('prematrimonial')
    expect(resolveRequestSection({ fullQueue: true })).toBe('prematrimonial')
  })

  it('el comité (cola acotada) siempre queda en reubicaciones', () => {
    expect(resolveRequestSection({
      tabParam: 'study_interest', requestId: 'r1', requestType: 'study_interest', fullQueue: false,
    })).toBe('relocation')
  })
})
