import { describe, it, expect } from 'vitest'
import { inferEmailKind, reachesUnsubscribed, emailKindNotice } from './email-kind'

describe('inferEmailKind', () => {
  it('las plantillas del sistema son avisos', () => {
    expect(inferEmailKind({ is_system: true, category: 'transaccional' })).toBe('transactional')
    // is_system gana aunque la categoría diga otra cosa.
    expect(inferEmailKind({ is_system: true, category: 'general' })).toBe('transactional')
  })

  it('inscripción y bienvenida son avisos', () => {
    expect(inferEmailKind({ category: 'inscripcion' })).toBe('transactional')
    expect(inferEmailKind({ category: 'bienvenida' })).toBe('transactional')
    expect(inferEmailKind({ category: 'transaccional' })).toBe('transactional')
  })

  it('general es campaña', () => {
    expect(inferEmailKind({ category: 'general' })).toBe('marketing')
    expect(inferEmailKind({ category: 'lo-que-sea' })).toBe('marketing')
    expect(inferEmailKind({ category: null })).toBe('marketing')
  })

  it('sin plantilla asume campaña (default seguro)', () => {
    expect(inferEmailKind(null)).toBe('marketing')
    expect(inferEmailKind(undefined)).toBe('marketing')
  })

  it('la categoría se compara sin importar espacios ni mayúsculas', () => {
    expect(inferEmailKind({ category: '  Inscripcion ' })).toBe('transactional')
  })
})

describe('reachesUnsubscribed', () => {
  it('solo el aviso llega a quien se dio de baja', () => {
    expect(reachesUnsubscribed('transactional')).toBe(true)
    expect(reachesUnsubscribed('marketing')).toBe(false)
  })
})

describe('emailKindNotice', () => {
  it('dice qué va a pasar en cada caso', () => {
    expect(emailKindNotice('marketing')).toContain('campaña')
    expect(emailKindNotice('marketing')).toContain('cancelar suscripción')
    expect(emailKindNotice('transactional')).toContain('llega también a quien se dio de baja')
  })
})
