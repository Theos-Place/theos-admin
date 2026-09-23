import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * QA-1/N4 · Toda sección declara su título de pestaña.
 *
 * EL PROBLEMA. Solo 15 de 132 archivos `page`/`layout` declaraban `metadata`,
 * y los que lo hacían eran layouts de MÓDULO: las 23 pantallas de estudios se
 * llamaban todas «Estudios». En el historial del navegador y en una pestaña
 * anclada no se distinguen.
 *
 * POR QUÉ NO SE ARREGLA PÁGINA POR PÁGINA. `metadata` solo funciona en un
 * componente de servidor y 112 de las 132 páginas son `'use client'`. Darle a
 * cada una su layout serían 112 archivos que no hacen nada más que eso. El
 * detalle fino lo pone `useTituloDePantalla` (ver `lib/ui/titulo-de-pantalla`).
 *
 * Lo que este test fija es el PISO: ninguna sección se queda con el título
 * genérico de la app. Una carpeta nueva bajo un grupo de rutas tiene que traer
 * su `layout.tsx` con `metadata`, o su página tiene que declararlo ella misma.
 */

const GRUPOS = ['(admin)', '(public)', '(auth)']
const DECLARA = /export\s+(const|async function)\s+(metadata|generateMetadata)/

const tienePagina = (dir: string): boolean =>
  readdirSync(dir, { withFileTypes: true }).some(e =>
    e.isFile() ? e.name === 'page.tsx' : tienePagina(join(dir, e.name)))

describe('títulos de pestaña', () => {
  it('cada sección declara el suyo', () => {
    const sinTitulo: string[] = []
    for (const grupo of GRUPOS) {
      const base = join('src/app', grupo)
      if (!existsSync(base)) continue
      for (const e of readdirSync(base, { withFileTypes: true })) {
        if (!e.isDirectory() || e.name.startsWith('_')) continue
        const dir = join(base, e.name)
        if (!tienePagina(dir)) continue
        const layout = join(dir, 'layout.tsx')
        const pagina = join(dir, 'page.tsx')
        const declara =
          (existsSync(layout) && DECLARA.test(readFileSync(layout, 'utf8'))) ||
          (existsSync(pagina) && DECLARA.test(readFileSync(pagina, 'utf8')))
        if (!declara) sinTitulo.push(dir)
      }
    }
    expect(
      sinTitulo,
      'Estas secciones heredan el título genérico. Agregales un layout.tsx de ' +
      'servidor con `export const metadata = { title: "…" }`.',
    ).toEqual([])
  })

  it('la plantilla del layout raíz sigue siendo la que componen los helpers', () => {
    expect(readFileSync('src/app/layout.tsx', 'utf8')).toContain("template: '%s | Theos Place'")
  })
})
