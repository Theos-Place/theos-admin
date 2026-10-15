import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// 2026-10-15 · La cartelera de puestos dentro de theosplace.org: que no se
// note que es un iframe.
const pagina = readFileSync('src/app/(public)/puestos/page.tsx', 'utf8')
const hook = readFileSync('src/hooks/useAlturaParaElSitio.ts', 'utf8')

describe('puestos embebidos', () => {
  it('fondo blanco cuando va embebida', () => {
    expect(pagina).toMatch(/embebida \? 'bg-white' : 'min-h-screen bg-surface-low'/)
  })
  it('embebida no mide lo que mide la ventana: el alto se retroalimentaba sin fin', () => {
    expect(pagina).not.toMatch(/'min-h-screen', embebida/)
  })
  it('le avisa su alto al sitio, solo embebida', () => {
    expect(pagina).toMatch(/useAlturaParaElSitio\(embebida\)/)
    expect(pagina).toMatch(/ref=\{medirParaElSitio\}/)
    expect(hook).toMatch(/tipo: 'theos:altura'/)
  })
  it('embebida, el detalle se abre en la tarjeta y no en un modal', () => {
    expect(pagina).toMatch(/embebida \? setExpandido\(/)
  })
  it('el fragmento para el sitio existe y revisa el origen', () => {
    const doc = readFileSync('docs/embeber-en-el-sitio.md', 'utf8')
    expect(doc).toContain("e.origin !== 'https://admin.theosplace.org'")
    expect(doc).toContain("'theos:altura'")
  })
})
