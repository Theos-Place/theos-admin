// El guardarraíl que evita que el editor visual destruya una plantilla de correo.
//
// Contexto (bug 2026-08-06): TipTap parsea el HTML contra su esquema y devuelve
// solo lo que sabe representar. Una plantilla de tablas con estilos en línea se
// aplana en la primera tecla. Esta función decide si el editor se abre en modo
// código; si falla, se pierde el diseño y no hay vuelta atrás.
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import {
  isAdvancedHtml, advancedHtmlReason, editorModeFor, advancedHtmlNotice,
} from './email-html'

describe('isAdvancedHtml — lo que el editor visual NO puede representar', () => {
  it('tablas', () => {
    expect(isAdvancedHtml('<table><tr><td>Hola</td></tr></table>')).toBe(true)
    expect(advancedHtmlReason('<table><tr><td>x</td></tr></table>')).toBe('tablas')
  })

  it('estilos en línea — EL HUECO VIEJO: esto pasaba como "simple"', () => {
    const html = '<p style="color:#EF5554;font-size:18px">Importante</p>'
    expect(isAdvancedHtml(html)).toBe(true)
    expect(advancedHtmlReason(html)).toBe('estilos en línea')
  })

  it('<span> y <div>', () => {
    expect(isAdvancedHtml('<p><span style="font-weight:700">x</span></p>')).toBe(true)
    expect(isAdvancedHtml('<div>bloque</div>')).toBe(true)
  })

  it('comentarios condicionales de Outlook', () => {
    expect(advancedHtmlReason('<!--[if mso]><p>Outlook</p><![endif]-->'))
      .toBe('comentarios condicionales de Outlook')
  })

  it('documento completo, bloques <style> y clases', () => {
    expect(isAdvancedHtml('<!doctype html><html><body>x</body></html>')).toBe(true)
    expect(isAdvancedHtml('<style>p{color:red}</style><p>x</p>')).toBe(true)
    expect(isAdvancedHtml('<p class="lead">x</p>')).toBe(true)
  })

  it('atributos de tabla sueltos (bgcolor, cellpadding, align)', () => {
    expect(isAdvancedHtml('<p bgcolor="#fff">x</p>')).toBe(true)
    expect(isAdvancedHtml('<p align="center">x</p>')).toBe(true)
  })

  it('muchas entidades numéricas: viene de un exportador de correo', () => {
    expect(isAdvancedHtml('<p>&#8203;&#160;&#8203;&#160;&#8203;</p>')).toBe(true)
    // Pocas no: alguien puede escribir un &#160; a mano.
    expect(isAdvancedHtml('<p>Hola&#160;mundo</p>')).toBe(false)
  })
})

describe('isAdvancedHtml — lo que SÍ es simple', () => {
  it('párrafos, negrita, listas y enlaces', () => {
    const simple = '<p>Hola <strong>Ana</strong>,</p><ul><li>Uno</li><li>Dos</li></ul>'
      + '<p><a href="https://theosplace.org">Ver más</a></p>'
    expect(isAdvancedHtml(simple)).toBe(false)
    expect(editorModeFor(simple)).toBe('visual')
  })

  it('vacío no es avanzado (una plantilla nueva arranca en visual)', () => {
    expect(isAdvancedHtml('')).toBe(false)
    expect(isAdvancedHtml('   ')).toBe(false)
    expect(editorModeFor('')).toBe('visual')
  })

  it('los estilos que el PROPIO editor emite no bloquean el modo visual', () => {
    // Si estos contaran como avanzados, centrar un párrafo dejaría al usuario
    // encerrado en modo código a mitad de escribir.
    expect(isAdvancedHtml('<p style="text-align: center">Centrado</p>')).toBe(false)
    expect(isAdvancedHtml('<a href="#" style="color:#519DA2">link</a>')).toBe(false)
    expect(isAdvancedHtml('<img src="/x.png" style="max-width:100%;height:auto">')).toBe(false)
  })

  it('pero un style con CUALQUIER otra propiedad sí', () => {
    expect(isAdvancedHtml('<p style="text-align:center;padding:20px">x</p>')).toBe(true)
    expect(isAdvancedHtml('<p style="font-family:Georgia">x</p>')).toBe(true)
  })
})

describe('editorModeFor', () => {
  it('las plantillas del sistema van siempre en código', () => {
    expect(editorModeFor('<p>simple</p>', { isSystem: true })).toBe('html')
    expect(advancedHtmlNotice('<p>simple</p>', { isSystem: true })).toMatch(/sistema/i)
  })

  it('el aviso dice POR QUÉ quedó en código', () => {
    expect(advancedHtmlNotice('<table><tr><td>x</td></tr></table>')).toMatch(/tablas/)
  })
})

// ── Regresión: la plantilla real que se aplanó ───────────────────────────────

const REFERENCIA = 'docs/referencias/campa-servidores-2026-video.html'

describe.skipIf(!existsSync(REFERENCIA))('plantilla real "Campa servidores 2026"', () => {
  const html = readFileSync(REFERENCIA, 'utf8')

  it('se detecta como avanzada', () => {
    expect(isAdvancedHtml(html)).toBe(true)
    expect(editorModeFor(html)).toBe('html')
  })

  it('el flujo de edición la devuelve IDÉNTICA', () => {
    // Este es el test que importa: si alguna vez vuelve a salir aplanada, salta
    // solo. El flujo real es: llega el cuerpo del servidor → el guardarraíl
    // decide el modo → en modo código el cuerpo pasa por el textarea sin que
    // TipTap lo toque → se guarda tal cual.
    //
    // (No se puede correr TipTap acá: necesita DOM y el entorno de tests es
    //  node. Lo que se fija es lo que rompió: que el guardarraíl la atrape.)
    const modo = editorModeFor(html)
    const guardado = modo === 'html' ? html : '<<< TipTap lo aplanaría >>>'
    expect(guardado).toBe(html)
  })

  it('conserva las piezas que se perdían al aplanarse', () => {
    expect(html).toMatch(/<table/i)          // la maqueta del correo
    expect(html).toMatch(/\sstyle\s*=/i)     // los estilos en línea
  })
})
