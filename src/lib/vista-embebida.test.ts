import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { esVistaEmbebida, urlParaEmbeber, PARAM_EMBEBIDO } from './vista-embebida'
import { EMBEDDABLE_PREFIXES } from './embed'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('la vista embebida', () => {
  it('acepta 1 y true, que es lo que alguien escribe sin pensarlo', () => {
    expect(esVistaEmbebida('1')).toBe(true)
    expect(esVistaEmbebida('true')).toBe(true)
  })

  it('un parámetro a medias NO esconde nada', () => {
    // Un `?embed=` vacío escondiendo el encabezado sería un cambio invisible
    // que nadie pidió.
    for (const v of ['', '0', 'false', 'sí', null, undefined]) {
      expect(esVistaEmbebida(v), String(v)).toBe(false)
    }
  })

  it('la URL lo agrega sin romper los parámetros que ya trae', () => {
    expect(urlParaEmbeber('https://x/puestos')).toBe('https://x/puestos?embed=1')
    expect(urlParaEmbeber('https://x/calendario?view=monthly'))
      .toBe('https://x/calendario?view=monthly&embed=1')
  })

  it('y no lo duplica', () => {
    const u = 'https://x/puestos?embed=1'
    expect(urlParaEmbeber(u)).toBe(u)
  })
})

describe('las dos páginas embebibles esconden su encabezado', () => {
  /**
   * EL CASO (2026-10-06): cada página trae su propia banda —«Theos Place —
   * Eventos», «Oportunidades de servicio»— y dentro del sitio, que ya tiene
   * header, se veían dos pegados.
   */
  const PAGINAS: Record<string, string> = {
    '/puestos': 'src/app/(public)/puestos/page.tsx',
    '/calendario': 'src/app/(public)/calendario/page.tsx',
  }

  it('cubre TODAS las rutas embebibles, no solo las que me acordé', () => {
    // Si mañana se agrega una a EMBEDDABLE_PREFIXES y trae encabezado, este
    // test obliga a decidir qué hacer con él.
    expect(Object.keys(PAGINAS).sort()).toEqual([...EMBEDDABLE_PREFIXES].sort())
  })

  for (const [ruta, archivo] of Object.entries(PAGINAS)) {
    it(`${ruta} lee el parámetro y condiciona su encabezado`, () => {
      const src = sinComentarios(archivo)
      expect(src).toContain('esVistaEmbebida(')
      expect(src).toContain('PARAM_EMBEBIDO')
      expect(src).toContain('{!embebida && (')
    })
  }

  it('el encabezado se ESCONDE, no se borra', () => {
    // La página suelta lo necesita: quien abre el link directo llegaría a una
    // lista sin título ni contexto.
    const p = sinComentarios(PAGINAS['/puestos'])
    expect(p).toContain('Oportunidades de servicio')
    const c = sinComentarios(PAGINAS['/calendario'])
    expect(c).toContain('Theos Place — Eventos')
  })

  it('NO se detecta el iframe por JS: eso parpadea en cada carga', () => {
    // `window.self !== window.top` no existe al renderizar en el servidor, así
    // que el encabezado se pintaría y después desaparecería — para todo el
    // mundo, en la página suelta también.
    for (const archivo of Object.values(PAGINAS)) {
      expect(sinComentarios(archivo), archivo).not.toContain('window.top')
    }
  })

  it('el generador del admin ya pone el parámetro en el código que copia', () => {
    const g = sinComentarios('src/app/(admin)/eventos/embed/page.tsx')
    expect(g).toContain(`\${PARAM_EMBEBIDO}=1`)
  })

  it(`y el parámetro se llama «${PARAM_EMBEBIDO}»`, () => {
    // Fijado porque va escrito en el sitio de Theos: cambiarlo rompe iframes
    // que ya están pegados en páginas que no controlamos.
    expect(PARAM_EMBEBIDO).toBe('embed')
  })
})
