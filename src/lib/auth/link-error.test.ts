import { describe, it, expect } from 'vitest'
import { readAuthLinkError, authLinkMessage, safeNextPath } from './link-error'

describe('readAuthLinkError', () => {
  it('lee el error del fragmento (donde lo pone Supabase)', () => {
    expect(readAuthLinkError({
      hash: '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    })).toEqual({
      error: 'access_denied',
      errorCode: 'otp_expired',
      description: 'Email link is invalid or has expired',
    })
  })

  it('también lo lee del query', () => {
    expect(readAuthLinkError({ search: '?error=access_denied&error_code=otp_expired' }))
      .toMatchObject({ error: 'access_denied', errorCode: 'otp_expired' })
  })

  it('URL sin error → todo null', () => {
    expect(readAuthLinkError({ hash: '', search: '' }))
      .toEqual({ error: null, errorCode: null, description: null })
  })
})

describe('authLinkMessage', () => {
  it('otp_expired: el título dice que YA SE USÓ, no que esté roto', () => {
    const m = authLinkMessage({ error: 'access_denied', errorCode: 'otp_expired' })
    expect(m.kind).toBe('usado_o_vencido')
    expect(m.titulo).toBe('Este enlace ya se usó o venció')
    // Lo primero que se ofrece es iniciar sesión: la cuenta suele estar lista.
    expect(m.acciones[0]).toBe('login')
    expect(m.detalle).toContain('una sola vez')
  })

  it('sin error en la URL (no se pudo abrir sesión) se trata igual de amable', () => {
    const m = authLinkMessage({})
    expect(m.kind).toBe('sin_sesion')
    expect(m.acciones).toEqual(['login', 'pedir_enlace'])
  })

  it('un error distinto sí se trata como link inválido, y ahí manda pedir otro', () => {
    const m = authLinkMessage({ error: 'server_error', errorCode: 'unexpected_failure' })
    expect(m.kind).toBe('invalido')
    expect(m.acciones[0]).toBe('pedir_enlace')
  })

  it('el texto cambia entre invitación y recuperación', () => {
    expect(authLinkMessage({ errorCode: 'otp_expired', error: 'access_denied' }, 'invitacion').detalle)
      .toContain('definiste tu contraseña')
    expect(authLinkMessage({ errorCode: 'otp_expired', error: 'access_denied' }, 'recuperacion').detalle)
      .toContain('cambiaste tu contraseña')
  })

  it('ningún mensaje manda a molestar a un administrador', () => {
    for (const flow of ['invitacion', 'recuperacion'] as const) {
      for (const p of [{}, { error: 'access_denied', errorCode: 'otp_expired' }, { error: 'x', errorCode: 'y' }]) {
        expect(authLinkMessage(p, flow).detalle.toLowerCase()).not.toContain('administrador')
      }
    }
  })
})

describe('safeNextPath', () => {
  it('acepta rutas internas', () => {
    expect(safeNextPath('/completar-perfil')).toBe('/completar-perfil')
    expect(safeNextPath('/recuperar/nueva-contrasena')).toBe('/recuperar/nueva-contrasena')
  })

  it('rechaza dominios externos (redirector abierto)', () => {
    expect(safeNextPath('https://malo.com')).toBe('/completar-perfil')
    expect(safeNextPath('//malo.com')).toBe('/completar-perfil')
    expect(safeNextPath('/\\malo.com')).toBe('/completar-perfil')
  })

  it('vacío o ausente cae al default', () => {
    expect(safeNextPath(null)).toBe('/completar-perfil')
    expect(safeNextPath('')).toBe('/completar-perfil')
    expect(safeNextPath('  ', '/login')).toBe('/login')
  })
})
