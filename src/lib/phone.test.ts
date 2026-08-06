// GRU-3 · Enlace de WhatsApp a partir de un teléfono del padrón.
import { describe, it, expect } from 'vitest'
import { normalizePhone, normalizePhoneOrNull, waLink, DEFAULT_COUNTRY_CODE } from './phone'

describe('normalizePhone', () => {
  it('deja solo dígitos', () => {
    expect(normalizePhone('8888-8888')).toBe('88888888')
    expect(normalizePhone(' (506) 8888 8888 ')).toBe('50688888888')
    expect(normalizePhone(null)).toBe('')
    expect(normalizePhoneOrNull('  -- ')).toBeNull()
  })
})

describe('waLink', () => {
  it('a un número local de 8 dígitos le pone el código de país', () => {
    expect(waLink('8888-8888')).toBe(`https://wa.me/${DEFAULT_COUNTRY_CODE}88888888`)
  })

  it('respeta el número que ya trae código de país', () => {
    expect(waLink('+506 8888 8888')).toBe('https://wa.me/50688888888')
    expect(waLink('1 305 555 1234')).toBe('https://wa.me/13055551234')
  })

  it('sin teléfono no arma un link roto', () => {
    expect(waLink(null)).toBe('#')
    expect(waLink('')).toBe('#')
    expect(waLink('sin número')).toBe('#')
  })
})
