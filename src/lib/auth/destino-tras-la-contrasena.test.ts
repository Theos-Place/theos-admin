import { describe, it, expect } from 'vitest'
import { nextConDestino, destinoTrasGuardar, ATERRIZAJE } from './destino-tras-la-contrasena'

describe('nextConDestino', () => {
  it('sin destino, el enlace aterriza donde siempre', () => {
    expect(nextConDestino(ATERRIZAJE.recovery)).toBe('/recuperar/nueva-contrasena')
    expect(nextConDestino(ATERRIZAJE.invite, null)).toBe('/completar-perfil')
  })

  it('cuelga el destino interno', () => {
    expect(nextConDestino(ATERRIZAJE.recovery, '/matricula'))
      .toBe('/recuperar/nueva-contrasena?redirect=%2Fmatricula')
  })

  it('el search del destino viaja codificado y no se mezcla con el nuestro', () => {
    const next = nextConDestino(ATERRIZAJE.recovery, '/mis-pagos?pago=abc')
    expect(next).toBe('/recuperar/nueva-contrasena?redirect=%2Fmis-pagos%3Fpago%3Dabc')
    // Al parsearlo vuelve entero: un solo parámetro, con su query adentro.
    const sp = new URLSearchParams(next.split('?')[1])
    expect([...sp.keys()]).toEqual(['redirect'])
    expect(sp.get('redirect')).toBe('/mis-pagos?pago=abc')
  })

  it('un destino externo NO viaja: el correo de Theos no es un trampolín', () => {
    for (const malo of ['https://evil.com', '//evil.com', 'javascript:alert(1)', '\\\\evil.com', 'matricula']) {
      expect(nextConDestino(ATERRIZAJE.recovery, malo)).toBe('/recuperar/nueva-contrasena')
    }
  })
})

describe('destinoTrasGuardar', () => {
  it('vuelve a donde iba', () => {
    expect(destinoTrasGuardar('/matricula')).toBe('/matricula')
  })

  it('sin destino, al dashboard — NUNCA al login', () => {
    for (const v of [null, undefined, '']) {
      expect(destinoTrasGuardar(v)).toBe('/dashboard')
    }
  })

  it('un destino externo cae al dashboard', () => {
    expect(destinoTrasGuardar('https://evil.com')).toBe('/dashboard')
  })

  it('el login nunca es el destino: ya hay sesión cuando esto corre', () => {
    // Guard de regresión del bug de AUT-3.
    for (const v of [null, '/matricula', 'https://evil.com']) {
      expect(destinoTrasGuardar(v)).not.toBe('/login')
    }
  })
})
