import { describe, it, expect } from 'vitest'
import { renderMarkdown } from './markdown'

describe('renderMarkdown', () => {
  it('títulos y párrafos', () => {
    expect(renderMarkdown('# Hola\n\nUn párrafo.')).toBe('<h1>Hola</h1>\n<p>Un párrafo.</p>')
    expect(renderMarkdown('## Dos\n### Tres')).toBe('<h2>Dos</h2>\n<h3>Tres</h3>')
  })

  it('junta las líneas de un mismo párrafo', () => {
    expect(renderMarkdown('linea uno\nlinea dos')).toBe('<p>linea uno linea dos</p>')
  })

  it('negrita, cursiva y código en línea', () => {
    expect(renderMarkdown('**fuerte** y *suave* y `codigo`'))
      .toBe('<p><strong>fuerte</strong> y <em>suave</em> y <code>codigo</code></p>')
  })

  it('listas con guiones y numeradas', () => {
    expect(renderMarkdown('- uno\n- dos')).toBe('<ul>\n<li>uno</li>\n<li>dos</li>\n</ul>')
    expect(renderMarkdown('1. uno\n2. dos')).toBe('<ol>\n<li>uno</li>\n<li>dos</li>\n</ol>')
  })

  it('cierra la lista al volver a texto', () => {
    expect(renderMarkdown('- uno\n\nTexto')).toBe('<ul>\n<li>uno</li>\n</ul>\n<p>Texto</p>')
  })

  it('citas y divisores', () => {
    expect(renderMarkdown('> Ojo con esto')).toBe('<blockquote>Ojo con esto</blockquote>')
    expect(renderMarkdown('---')).toBe('<hr />')
  })

  it('varias líneas de cita seguidas son UNA sola cita', () => {
    expect(renderMarkdown('> Una ficha inactiva no desaparece:\n> su historial queda.'))
      .toBe('<blockquote>Una ficha inactiva no desaparece: su historial queda.</blockquote>')
  })

  it('dos citas separadas por una línea vacía siguen siendo dos', () => {
    expect(renderMarkdown('> Uno\n\n> Dos'))
      .toBe('<blockquote>Uno</blockquote>\n<blockquote>Dos</blockquote>')
  })

  it('la cita se cierra al volver a texto normal', () => {
    expect(renderMarkdown('> Cita\nTexto'))
      .toBe('<blockquote>Cita</blockquote>\n<p>Texto</p>')
  })

  it('enlaces internos y externos', () => {
    expect(renderMarkdown('[matrícula](/matricula)')).toBe('<p><a href="/matricula">matrícula</a></p>')
    const ext = renderMarkdown('[sitio](https://theosplace.org)')
    expect(ext).toContain('target="_blank"')
    expect(ext).toContain('rel="noopener noreferrer"')
  })

  it('imágenes (las infografías)', () => {
    expect(renderMarkdown('![Ciclo](/ayuda/infografias/x.svg)'))
      .toBe('<p><img src="/ayuda/infografias/x.svg" alt="Ciclo" loading="lazy" /></p>')
  })

  it('bloques de código', () => {
    expect(renderMarkdown('```\nuno\ndos\n```')).toBe('<pre><code>uno\ndos</code></pre>')
  })

  it('escapa el HTML del texto (no se inyecta nada desde el .md)', () => {
    const html = renderMarkdown('<script>alert(1)</script> y <b>b</b>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<b>')
  })

  it('el código en línea no interpreta lo de adentro', () => {
    expect(renderMarkdown('`**no negrita**`')).toBe('<p><code>**no negrita**</code></p>')
  })

  it('vacío devuelve vacío', () => {
    expect(renderMarkdown('')).toBe('')
    expect(renderMarkdown('\n\n')).toBe('')
  })
})
