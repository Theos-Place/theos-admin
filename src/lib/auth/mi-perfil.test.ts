import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { loginUrlWithDest } from './redirect-target'
import { SIN_FICHA_ASOCIADA } from './estado-de-la-sesion'

const sinComentarios = (r: string) =>
  readFileSync(r, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

const SRC = sinComentarios('src/app/(admin)/mi-perfil/page.tsx')

/**
 * `/mi-perfil` es un enlace estable al perfil propio: el perfil real vive en
 * `/miembros/<uuid>`, así que sin esta ruta no se puede enlazar «tu perfil»
 * desde un correo ni desde una ayuda.
 */
describe('/mi-perfil · a dónde manda', () => {
  it('al perfil del miembro de la sesión', () => {
    expect(SRC).toContain('redirect(`/miembros/${ctx.memberId}${cola}`)')
  })

  it('se resuelve en el SERVIDOR, no con router.replace', () => {
    // El dashboard lo hace en el cliente y por eso destella la página
    // equivocada antes de saltar. Acá la respuesta ya ES la redirección.
    expect(SRC).toContain("from 'next/navigation'")
    expect(SRC).not.toContain('use client')
    expect(SRC).not.toContain('router.replace')
  })

  it('sin sesión, al login guardando a dónde iba', () => {
    // El proxy ya lo hace, pero «no deberíamos llegar acá» no es garantía: si
    // alguien saca la ruta de la lista protegida, sin esto reventaría con un
    // ctx nulo en vez de mandar al login.
    expect(SRC).toContain("loginUrlWithDest('/mi-perfil', cola)")
    expect(loginUrlWithDest('/mi-perfil', '?tab=participacion'))
      .toBe('/login?redirect=' + encodeURIComponent('/mi-perfil?tab=participacion'))
  })

  it('sin ficha MUESTRA el mensaje, no rebota en silencio', () => {
    // El primer intento redirigía a `/?aviso=sin-ficha` y nadie lee ese
    // parámetro: la persona aterrizaba en la portada sin saber por qué.
    expect(SRC).toContain('SIN_FICHA_ASOCIADA')
    expect(SRC).not.toContain('aviso=sin-ficha')
    expect(SIN_FICHA_ASOCIADA).toContain('ti@theosplace.org')
  })
})

describe('/mi-perfil · los query params', () => {
  it('se reenvían TODOS, no una lista blanca', () => {
    // `?tab=` lo usa la notificación de cobro y `?open=` abre un acordeón. Con
    // una lista blanca, el parámetro que alguien agregue mañana se pierde en
    // silencio acá.
    expect(SRC).toContain('new URLSearchParams()')
    expect(SRC).toContain('Object.entries(await searchParams)')
    expect(SRC).not.toMatch(/searchParams\.tab|\['tab'\]/)
  })

  it('un parámetro repetido no se pierde', () => {
    // `?open=a&open=b` llega como array y las dos entradas tienen que viajar.
    expect(SRC).toContain('Array.isArray(v)')
    expect(SRC).toContain('qs.append')
  })

  it('sin parámetros no cuelga un «?» pelado', () => {
    expect(SRC).toContain("qs.toString() ? `?${qs}` : ''")
  })

  it('`searchParams` se espera: en Next 16 es una Promise', () => {
    expect(SRC).toContain('searchParams: Promise<')
    expect(SRC).toContain('await searchParams')
  })
})

describe('/mi-perfil · la ruta está protegida', () => {
  it('NO está en la lista de rutas públicas del proxy', () => {
    // Si estuviera, entraría sin sesión y `getAuthContext()` daría null para
    // todo el mundo.
    const proxy = sinComentarios('src/proxy.ts')
    const m = /const PUBLIC_PREFIXES = \[([^\]]+)\]/.exec(proxy)
    expect(m, 'no se encontró PUBLIC_PREFIXES').toBeTruthy()
    expect(m![1]).not.toContain('mi-perfil')
  })

  it('y el login SÍ acepta /mi-perfil como destino', () => {
    // Está en la lista de «no guardar»? No debería: volver ahí tras entrar es
    // exactamente lo que queremos.
    expect(loginUrlWithDest('/mi-perfil')).not.toBe('/login')
  })
})
