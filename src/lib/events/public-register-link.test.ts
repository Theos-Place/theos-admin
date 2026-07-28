import { describe, it, expect } from 'vitest'
import { registerDeepLink, loginRedirectTo } from './public-register-link'

describe('public-register-link (EVE-1)', () => {
  it('deep link abre la inscripción del evento en /eventos', () => {
    expect(registerDeepLink('abc-123')).toBe('/eventos?register=abc-123')
  })

  it('login-gate lleva de vuelta al deep link tras autenticarse', () => {
    const dest = registerDeepLink('abc-123')
    expect(loginRedirectTo(dest)).toBe(`/login?redirect=${encodeURIComponent('/eventos?register=abc-123')}`)
  })
})
