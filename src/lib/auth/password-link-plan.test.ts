import { describe, it, expect } from 'vitest'
import { linkAttemptOrder, shouldTryOtherKind } from './password-link-plan'

describe('linkAttemptOrder', () => {
  it('con cuenta: primero recuperar', () => {
    expect(linkAttemptOrder(true)).toEqual(['recovery', 'invite'])
  })

  it('sin cuenta: primero invitar (la crea)', () => {
    expect(linkAttemptOrder(false)).toEqual(['invite', 'recovery'])
  })

  it('siempre hay un segundo intento: la pista puede estar mal', () => {
    expect(linkAttemptOrder(true).length).toBe(2)
    expect(linkAttemptOrder(false).length).toBe(2)
  })
})

describe('shouldTryOtherKind', () => {
  it('reintenta cuando el usuario ya existe', () => {
    expect(shouldTryOtherKind('User already registered')).toBe(true)
    expect(shouldTryOtherKind('A user with this email address has already been registered')).toBe(true)
  })

  it('reintenta cuando el usuario no existe', () => {
    expect(shouldTryOtherKind('User not found')).toBe(true)
    expect(shouldTryOtherKind('no user found with that email')).toBe(true)
  })

  it('NO reintenta ante otros errores (un SMTP caído no se arregla cambiando el tipo)', () => {
    expect(shouldTryOtherKind('Error sending email: connection refused')).toBe(false)
    expect(shouldTryOtherKind('rate limit exceeded')).toBe(false)
    expect(shouldTryOtherKind('')).toBe(false)
    expect(shouldTryOtherKind(null)).toBe(false)
  })
})
