// El correo de "tu cuenta ya está lista" NO puede llevar token: ese es el
// arreglo de fondo del 2026-08-04. Los enlaces de Supabase Auth vencen (máximo
// 24 h, ahora 2 h por configuración) y son de un solo uso, así que entre que un
// administrador lo manda y la persona lo abre, llega muerto — o lo consume un
// escáner de enlaces del correo corporativo.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { accountReadyBody, loginUrlFor } from './account-ready'

const SITE = 'https://admin.theosplace.org'
const html = accountReadyBody('Floriana', loginUrlFor(SITE), 'floriana@theosplace.org')

describe('correo de instrucciones para entrar', () => {
  it('no contiene NINGÚN token ni ruta de canje', () => {
    for (const rastro of ['token_hash', 'token=', '/auth/continuar', '/auth/confirm', 'type=invite', 'type=recovery']) {
      expect(html).not.toContain(rastro)
    }
  })

  it('el único enlace de la app es el login pelado', () => {
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)]
      .map(m => m[1])
      .filter(h => h.startsWith('http'))
    expect(hrefs.length).toBeGreaterThan(0)
    for (const h of hrefs) expect(h).toBe(`${SITE}/login`)
    expect(loginUrlFor(SITE)).toBe(`${SITE}/login`)
  })

  it('lleva el paso a paso y el correo con el que hay que pedirlo', () => {
    expect(html).toContain('Creá tu contraseña acá')
    expect(html).toContain('floriana@theosplace.org')
    expect(html).toContain('Hola, Floriana')
  })

  it('sin nombre, saluda igual', () => {
    expect(accountReadyBody(null, loginUrlFor(SITE), 'x@y.com')).toContain('Hola')
  })
})

describe('los caminos de administración no mandan links con token', () => {
  // Guarda de regresión: si alguien vuelve a meter inviteUserByEmail o el correo
  // con token en estos dos caminos, el link vencido regresa.
  const sinComentarios = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  const rutas = [
    'src/lib/auth/invite.ts',
    'src/app/api/members/[id]/resend-activation/route.ts',
  ]

  for (const ruta of rutas) {
    it(`${ruta} manda el correo sin token`, () => {
      // Se miran las LLAMADAS, no los comentarios: los dos archivos explican en
      // prosa de qué se vinieron (y esa explicación tiene que poder quedarse).
      const src = sinComentarios(readFileSync(ruta, 'utf8'))
      expect(src).toContain('sendAccountReadyEmail(')
      expect(src).not.toContain('inviteUserByEmail(')
      expect(src).not.toContain('sendPasswordLink(')
    })
  }
})
