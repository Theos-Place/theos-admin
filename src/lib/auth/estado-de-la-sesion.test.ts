import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { estadoDeLaSesion, SIN_FICHA_ASOCIADA } from './estado-de-la-sesion'

describe('estadoDeLaSesion', () => {
  it('EL BUG DE UX-5: sin cargar todavía NO es "no hay cuenta"', () => {
    // Los dos casos de abajo tienen memberId null. Preguntar solo por el
    // miembro los confunde, y eso es lo que mostraba el mensaje de error a
    // alguien que acababa de entrar bien.
    expect(estadoDeLaSesion({ loaded: false, memberId: null })).toBe('cargando')
    expect(estadoDeLaSesion({ loaded: true, memberId: null })).toBe('sin_ficha')
  })

  it('con ficha, lista', () => {
    expect(estadoDeLaSesion({ loaded: true, memberId: 'm-1' })).toBe('lista')
  })

  it('undefined se trata como sin ficha, no como cargando', () => {
    // El campo puede no venir en el payload; una vez que /api/auth/me contestó,
    // la respuesta es la respuesta.
    expect(estadoDeLaSesion({ loaded: true, memberId: undefined })).toBe('sin_ficha')
  })

  it('cargando manda aunque ya haya miembro', () => {
    // No debería pasar, pero si pasa se espera: el estado a medio resolver no
    // es fuente de verdad para nada.
    expect(estadoDeLaSesion({ loaded: false, memberId: 'm-1' })).toBe('cargando')
  })

  it('el mensaje dice qué hacer, no solo que está mal', () => {
    expect(SIN_FICHA_ASOCIADA).toMatch(/theosplace\.org/)
  })
})

/**
 * Las pantallas que dependen de la ficha no pueden volver a preguntar solo por
 * el miembro. No hay render tests en este repo (vitest corre en 'node'), así
 * que se lee el fuente —mismo enfoque que checkin-endpoints.test.ts—: lo que se
 * quiere blindar es la DECISIÓN, y es una línea fácil de "simplificar" sin ver
 * el parpadeo.
 */
describe('las pantallas de la ficha usan los tres estados', () => {
  const PANTALLAS = [
    'src/app/(admin)/matricula/page.tsx',
    'src/app/(admin)/mis-pagos/page.tsx',
  ]

  it('todas pasan por estadoDeLaSesion', () => {
    for (const p of PANTALLAS) {
      expect(readFileSync(p, 'utf8'), p).toContain('estadoDeLaSesion({')
    }
  })

  it('ninguna muestra el mensaje con un simple "no hay miembro"', () => {
    // La forma exacta del bug: un return de JSX colgado de !memberId, sin mirar
    // si la sesión ya cargó.
    for (const p of PANTALLAS) {
      const texto = readFileSync(p, 'utf8')
      expect(texto, p).not.toMatch(/if \(!(effectiveMemberId|selfId|memberId)\) \{\s*\n\s*return \(/)
    }
  })

  it('el texto de "sin ficha" sale de la constante, no escrito a mano', () => {
    for (const p of PANTALLAS) {
      const texto = readFileSync(p, 'utf8')
      expect(texto, p).toContain('SIN_FICHA_ASOCIADA')
      expect(texto, p).not.toContain('No hay un miembro asociado a tu cuenta')
    }
  })
})
