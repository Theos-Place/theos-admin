import { describe, it, expect } from 'vitest'
import { escaparLike, patronDeCorreo, esMismoCorreo } from './correo-exacto'

describe('escaparLike', () => {
  it('escapa el guion bajo, que es el comodín que causó el bug', () => {
    expect(escaparLike('paoc_27@hotmail.com')).toBe('paoc\\_27@hotmail.com')
  })

  it('escapa el porcentaje', () => {
    expect(escaparLike('a%b@x.com')).toBe('a\\%b@x.com')
  })

  it('escapa la contrabarra primero, para no romper los otros escapes', () => {
    expect(escaparLike('a\\_b')).toBe('a\\\\\\_b')
  })

  it('deja intacta una dirección sin metacaracteres', () => {
    expect(escaparLike('marco@gmail.com')).toBe('marco@gmail.com')
  })
})

describe('patronDeCorreo', () => {
  it('normaliza espacios y mayúsculas además de escapar', () => {
    expect(patronDeCorreo('  Paoc_27@Hotmail.com ')).toBe('paoc\\_27@hotmail.com')
  })
})

describe('esMismoCorreo', () => {
  it('las dos Paolas NO son la misma persona', () => {
    expect(esMismoCorreo('paoc_27@hotmail.com', 'paocq27@hotmail.com')).toBe(false)
  })

  it('ignora mayúsculas y espacios', () => {
    expect(esMismoCorreo(' PAOC_27@hotmail.com', 'paoc_27@hotmail.com ')).toBe(true)
  })

  it('nulo nunca calza', () => {
    expect(esMismoCorreo(null, 'a@b.com')).toBe(false)
    expect(esMismoCorreo('a@b.com', undefined)).toBe(false)
  })
})

// Guardia: que nadie vuelva a pasar una dirección cruda a ILIKE. El `_` de un
// correo es un comodín y termina encontrando a otra persona (bug de las dos
// Paolas, 2026-09-09).
describe('nadie usa ILIKE con una dirección sin escapar', () => {
  it('todos los .ilike sobre email/recipient pasan por patronDeCorreo', async () => {
    const { execSync } = await import('node:child_process')
    const salida = execSync(
      `grep -rn "\\.ilike('email'\\|\\.ilike('recipient'" src || true`,
      { encoding: 'utf8' },
    )
    const crudos = salida.split('\n')
      .filter(Boolean)
      .filter(l => !l.startsWith('src/lib/email/correo-exacto'))
      // `addr` ya viene de patronDeCorreo en suppression.ts.
      .filter(l => !l.includes('patronDeCorreo') && !l.includes(', addr)'))
    expect(crudos).toEqual([])
  })
})
