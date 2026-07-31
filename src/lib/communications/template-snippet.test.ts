import { describe, it, expect } from 'vitest'
import { templateSnippet } from './template-snippet'

describe('templateSnippet', () => {
  it('saca las etiquetas y deja el texto', () => {
    expect(templateSnippet('<p class="greeting">Hola, {nombre}</p>')).toBe('Hola, {nombre}')
  })

  it('ignora los comentarios (son notas para quien edita)', () => {
    const body = '<!-- NO borres {link_formulario} -->\n<p>Te invitamos</p>'
    expect(templateSnippet(body)).toBe('Te invitamos')
  })

  it('ignora <style> y <script>', () => {
    expect(templateSnippet('<style>.a{color:red}</style><p>Texto</p>')).toBe('Texto')
    expect(templateSnippet('<script>alert(1)</script><p>Texto</p>')).toBe('Texto')
  })

  it('no pega palabras al cerrar bloques', () => {
    expect(templateSnippet('<p>Uno</p><p>Dos</p>')).toBe('Uno Dos')
    expect(templateSnippet('Uno<br />Dos')).toBe('Uno Dos')
  })

  it('traduce las entidades más comunes', () => {
    expect(templateSnippet('<p>&iquest;C&oacute;mo aplicar? Or&aacute; &amp; le&eacute;</p>'))
      .toBe('¿Cómo aplicar? Orá & leé')
  })

  it('limpia las marcas de WhatsApp', () => {
    expect(templateSnippet('*Hola* _mundo_')).toBe('Hola mundo')
  })

  it('corta con puntos suspensivos', () => {
    const largo = templateSnippet('<p>' + 'palabra '.repeat(40) + '</p>', 20)
    expect(largo.endsWith('…')).toBe(true)
    expect(largo.length).toBeLessThanOrEqual(20)
  })

  it('cuerpo vacío o solo markup → cadena vacía', () => {
    expect(templateSnippet('')).toBe('')
    expect(templateSnippet(null)).toBe('')
    expect(templateSnippet('<div><span></span></div>')).toBe('')
  })
})
