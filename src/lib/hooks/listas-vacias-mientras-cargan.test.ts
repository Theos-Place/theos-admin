import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * EL OTRO LADO DEL CAMBIO DEL 2026-10-08.
 *
 * `estadoDeLista` dejó de mostrar las filas viejas mientras llega el filtro
 * nuevo, porque contradecían el botón apretado («si escojo fallidos, aun así
 * me lista entregados»). El precio es que ahora la lista SÍ queda vacía un
 * instante — y una tabla en blanco, sin una palabra, se lee como «no hay
 * nada», que es una respuesta falsa.
 *
 * Así que cada pantalla que usa el hook tiene que distinguir «no hay» de
 * «todavía no llegó». Las cuatro ya lo hacían antes del cambio; este test
 * existe para que la quinta no se olvide.
 */
const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const PANTALLAS = [
  'src/app/(admin)/comunicaciones/[id]/page.tsx',
  'src/app/(admin)/servidores/aplicaciones/page.tsx',
  'src/app/(admin)/finanzas/pagos/page.tsx',
  'src/app/(admin)/estudios/grupos/page.tsx',
]

describe('la lista vacía dice si está cargando', () => {
  for (const ruta of PANTALLAS) {
    it(`${ruta.split('/').slice(-2).join('/')} distingue «cargando» de «no hay»`, () => {
      const src = sinComentarios(ruta)
      expect(src, 'usa el hook').toContain('usePaginatedList')
      // En el bloque de lista vacía tiene que consultarse el loading.
      const i = src.indexOf('.length === 0')
      expect(i, 'tiene estado vacío').toBeGreaterThan(-1)
      const bloque = src.slice(i, i + 700)
      expect(bloque.toLowerCase()).toMatch(/loading|cargando/)
    })
  }

  it('y el hook sigue ofreciendo el escape para un buscador letra a letra', () => {
    const regla = sinComentarios('src/lib/hooks/lista-paginada.ts')
    expect(regla).toContain('conservarMientrasCarga = false')
  })
})
