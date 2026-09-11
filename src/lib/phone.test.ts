// GRU-3 · Enlace de WhatsApp a partir de un teléfono del padrón.
import { describe, it, expect } from 'vitest'
import { normalizePhone, normalizePhoneOrNull, waLink, formatPhoneCR, DEFAULT_COUNTRY_CODE } from './phone'

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

describe('formatPhoneCR (teléfono para leer en un export)', () => {
  it('parte un número de 8 dígitos en dos bloques', () => {
    expect(formatPhoneCR('85665367')).toBe('8566-5367')
  })

  it('limpia lo que venga sucio antes de partirlo', () => {
    expect(formatPhoneCR(' 8566 5367 ')).toBe('8566-5367')
    expect(formatPhoneCR('(506) 8566-5367')).toBe('50685665367')
  })

  it('sin teléfono, cadena vacía — no un guión suelto', () => {
    expect(formatPhoneCR(null)).toBe('')
    expect(formatPhoneCR(undefined)).toBe('')
    expect(formatPhoneCR('')).toBe('')
  })

  it('otro largo se devuelve tal cual: partirlo sería inventar un formato', () => {
    expect(formatPhoneCR('2222333')).toBe('2222333')
    expect(formatPhoneCR('50685665367')).toBe('50685665367')
  })
})
