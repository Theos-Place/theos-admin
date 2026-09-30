import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { rutaSinIdentificadores } from './Telemetria'

/**
 * Las URLs que salen hacia Vercel Analytics no pueden llevar el identificador
 * de una persona. Este sistema tiene 24.000 fichas, varias de menores, y sus
 * rutas son `/miembros/<uuid>`: mandar eso a un tercero es mandar quién entró
 * a ver a quién.
 *
 * La instalación automática de Vercel NO trae esto: pone `<Analytics />` a
 * secas. Por eso el componente está escrito a mano.
 */
describe('las URLs se redactan antes de salir', () => {
  it('quita el uuid de una ficha de miembro', () => {
    expect(rutaSinIdentificadores('/miembros/5fdf2a3f-5c3c-4925-9285-2ac0e2803eb8'))
      .toBe('/miembros/:id')
  })

  it('y el de un grupo de estudio, en cualquier profundidad', () => {
    expect(rutaSinIdentificadores('/estudios/grupos/3ba9f99e-5190-4510-a7c4-ee318716fdd8/cierre'))
      .toBe('/estudios/grupos/:id/cierre')
  })

  it('tira la query string entera', () => {
    // Un `?search=Fonseca` o un `?correo=x@y.com` es tan identificable como el
    // uuid, y no hay forma de saber de antemano qué parámetro va a aparecer.
    expect(rutaSinIdentificadores('/miembros?search=Floriana%20Fonseca&page=2'))
      .toBe('/miembros')
  })

  it('también los ids numéricos largos', () => {
    expect(rutaSinIdentificadores('/formularios/1784264664313/respuestas'))
      .toBe('/formularios/:id/respuestas')
  })

  it('deja intactas las rutas que no identifican a nadie', () => {
    for (const r of ['/dashboard', '/estudios/grupos', '/servidores/puestos', '/login']) {
      expect(rutaSinIdentificadores(r), r).toBe(r)
    }
  })

  it('de una URL absoluta se queda solo con la ruta', () => {
    expect(rutaSinIdentificadores('https://admin.theosplace.org/miembros/5fdf2a3f-5c3c-4925-9285-2ac0e2803eb8'))
      .toBe('/miembros/:id')
  })

  it('una entrada rara no explota ni deja pasar un identificador', () => {
    // `new URL(x, base)` no lanza con basura: la resuelve como ruta relativa.
    // No importa cómo quede el texto — importa que no reviente el envío y que
    // no salga un uuid por el camino raro.
    for (const raro of ['no es una url', '', '///', 'javascript:void(0)']) {
      expect(() => rutaSinIdentificadores(raro), raro).not.toThrow()
    }
    expect(rutaSinIdentificadores('basura/5fdf2a3f-5c3c-4925-9285-2ac0e2803eb8'))
      .toContain(':id')
  })
})

describe('cableado', () => {
  const SRC = readFileSync('src/components/layout/Telemetria.tsx', 'utf8')

  it('Analytics sale SIEMPRE con beforeSend', () => {
    // Sin esto el evento viaja con la url real. Es la única línea que separa
    // esta instalación de la que pondría el instalador automático.
    const i = SRC.indexOf('<Analytics')
    expect(i).toBeGreaterThan(-1)
    expect(SRC.slice(i, i + 220)).toContain('beforeSend')
    expect(SRC.slice(i, i + 220)).toContain('rutaSinIdentificadores')
  })

  it('usa los imports de Next, no los genéricos de React', () => {
    // `@vercel/analytics/react` no agrupa las rutas dinámicas; el de Next sí.
    expect(SRC).toContain("from '@vercel/analytics/next'")
    expect(SRC).toContain("from '@vercel/speed-insights/next'")
  })

  it('está enganchado en el layout raíz', () => {
    // En el raíz y no en el AppShell: así cubre también las pantallas públicas
    // y las de acceso, que quedan fuera del shell.
    expect(readFileSync('src/app/layout.tsx', 'utf8')).toContain('<Telemetria />')
  })
})
