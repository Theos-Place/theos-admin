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

describe('ítems de lista partidos en varias líneas (bug 2026-08-04)', () => {
  it('la continuación indentada NO reinicia la numeración', () => {
    const html = renderMarkdown([
      '1. Primero.',
      '2. Segundo, con un renglón que sigue',
      '   en la línea de abajo.',
      '3. Tercero.',
    ].join('\n'))
    // Una sola lista: si se cerrara y abriera otra, el 3 saldría como 1.
    expect(html.match(/<ol>/g) ?? []).toHaveLength(1)
    expect(html.match(/<li>/g) ?? []).toHaveLength(3)
    expect(html).toContain('Segundo, con un renglón que sigue en la línea de abajo.')
    expect(html).not.toContain('<p>en la línea de abajo.</p>')
  })

  it('lo mismo con viñetas', () => {
    const html = renderMarkdown([
      '- Uno, que sigue',
      '  acá abajo.',
      '- Dos.',
    ].join('\n'))
    expect(html.match(/<ul>/g) ?? []).toHaveLength(1)
    expect(html.match(/<li>/g) ?? []).toHaveLength(2)
    expect(html).toContain('Uno, que sigue acá abajo.')
  })

  it('la continuación conserva el formato (negrita, enlaces)', () => {
    const html = renderMarkdown([
      '1. Algo,',
      '   con **negrita** y [un enlace](/ayuda).',
    ].join('\n'))
    expect(html).toContain('<strong>negrita</strong>')
    expect(html).toContain('<a href="/ayuda">un enlace</a>')
  })

  it('una línea SIN indentar sí cierra la lista', () => {
    const html = renderMarkdown([
      '1. Un ítem.',
      'Un párrafo aparte.',
    ].join('\n'))
    expect(html).toContain('</ol>')
    expect(html).toContain('<p>Un párrafo aparte.</p>')
  })

  it('una línea en blanco corta la lista, como siempre', () => {
    const html = renderMarkdown('1. Uno.\n\n1. Otra lista.')
    expect(html.match(/<ol>/g) ?? []).toHaveLength(2)
  })
})

describe('formato que cruza el corte de línea (bug 2026-08-04)', () => {
  it('una negrita que abre en un renglón y cierra en el siguiente se renderiza', () => {
    const html = renderMarkdown([
      '- Pide ser **donante** y **servir en un',
      '  comité**.',
    ].join('\n'))
    expect(html).toContain('<strong>servir en un comité</strong>')
    expect(html).not.toContain('**')
  })

  it('un enlace partido también', () => {
    const html = renderMarkdown([
      '1. Mirá la [guía del',
      '   estudiante](/ayuda/el-camino-del-estudiante).',
    ].join('\n'))
    expect(html).toContain('<a href="/ayuda/el-camino-del-estudiante">guía del estudiante</a>')
  })
})

// ── Tablas (2026-08-06) ─────────────────────────────────────────────────────
// Antes no se soportaban: las filas caían todas en un mismo párrafo con los
// pipes a la vista (se vio en la guía de datos de prueba).
describe('tablas', () => {
  const md = [
    '| Nombre | Rol |',
    '|---|---|',
    '| Ana | miembro |',
    '| Dora | **dirigente** |',
  ].join('\n')

  it('arma thead y tbody', () => {
    const html = renderMarkdown(md)
    expect(html).toContain('<table>')
    expect(html).toContain('<thead><tr><th>Nombre</th><th>Rol</th></tr></thead>')
    expect(html).toContain('<td>Ana</td><td>miembro</td>')
  })

  it('formatea dentro de las celdas', () => {
    expect(renderMarkdown(md)).toContain('<td><strong>dirigente</strong></td>')
  })

  it('va envuelta para que se desplace sola en el celular', () => {
    expect(renderMarkdown(md)).toContain('<div class="tabla-scroll">')
  })

  it('acepta la separadora con alineaciones', () => {
    const conAlineacion = '| a | b |\n|:--|--:|\n| 1 | 2 |'
    expect(renderMarkdown(conAlineacion)).toContain('<table>')
  })

  it('sin fila separadora NO es tabla: sale como párrafo', () => {
    const html = renderMarkdown('| esto | no es tabla |')
    expect(html).not.toContain('<table>')
    expect(html).toContain('<p>')
  })

  it('lo que sigue después de la tabla es un párrafo aparte', () => {
    const html = renderMarkdown(`${md}\n\nDespués de la tabla.`)
    expect(html).toContain('<p>Después de la tabla.</p>')
    expect(html.indexOf('</table>')).toBeLessThan(html.indexOf('<p>Después'))
  })

  it('una tabla no se come el título siguiente', () => {
    const html = renderMarkdown(`${md}\n\n## Otra sección`)
    expect(html).toContain('<h2>Otra sección</h2>')
  })
})

describe('videos de tutoriales (.mp4 plegado)', () => {
  it('una línea de imagen .mp4 sale como <details> con <video> sin autodescarga', () => {
    const html = renderMarkdown('![Ver el flujo completo](/ayuda/tutoriales/matricula/matricula.mp4)')
    expect(html).toContain('<details class="video-tutorial">')
    expect(html).toContain('<summary>Ver el flujo completo</summary>')
    expect(html).toContain('preload="none"')
    expect(html).toContain('src="/ayuda/tutoriales/matricula/matricula.mp4"')
  })
  it('las imágenes normales siguen saliendo como <img>', () => {
    expect(renderMarkdown('![foto](/x.png)')).toContain('<img src="/x.png"')
  })
  it('un .mp4 DENTRO de un párrafo no se convierte (solo como bloque propio)', () => {
    const html = renderMarkdown('texto antes ![v](/x.mp4) texto después')
    expect(html).not.toContain('<video')
  })
})
