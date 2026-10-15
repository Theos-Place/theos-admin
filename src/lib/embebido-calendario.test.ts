import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { SCRIPT_DEL_SITIO } from './vista-embebida'

/**
 * 2026-10-15 · El script del sitio que hacía crecer el iframe de puestos «no
 * servía» con el calendario de actividades: el calendario nunca mandaba su
 * alto. Esto fija las piezas.
 */
const CAL = readFileSync('src/app/(public)/calendario/page.tsx', 'utf8')
const GEN = readFileSync('src/app/(admin)/eventos/embed/page.tsx', 'utf8')
const DOC = readFileSync('docs/embeber-en-el-sitio.md', 'utf8')

describe('calendario embebido en el sitio', () => {
  it('manda su alto, como puestos', () => {
    expect(CAL).toContain('useAlturaParaElSitio(embebida)')
    expect(CAL).toContain('ref={medirParaElSitio}')
  })

  it('embebido NO usa min-h-screen: dentro del iframe crecería sin fin', () => {
    expect(CAL).toContain("className={embebida ? 'font-[system-ui,sans-serif]' : 'min-h-screen font-[system-ui,sans-serif]'}")
  })

  it('al abrir un modal le pide al sitio que baje hasta él', () => {
    expect(CAL).toContain('pedirAlSitioQueMuestre(embebida)')
  })
})

describe('el script del sitio', () => {
  it('atiende los dos mensajes y solo de admin.theosplace.org', () => {
    expect(SCRIPT_DEL_SITIO).toContain("e.origin !== 'https://admin.theosplace.org'")
    expect(SCRIPT_DEL_SITIO).toContain("d.tipo === 'theos:altura'")
    expect(SCRIPT_DEL_SITIO).toContain("d.tipo === 'theos:ver'")
    expect(SCRIPT_DEL_SITIO).toContain('f.contentWindow !== e.source')
  })

  it('el generador de eventos lo incluye, con el iframe sin scroll propio', () => {
    expect(GEN).toContain('${SCRIPT_DEL_SITIO}')
    expect(GEN).toContain('scrolling="no"')
  })

  it('la guía muestra el MISMO texto', () => {
    expect(DOC).toContain(SCRIPT_DEL_SITIO)
  })
})
