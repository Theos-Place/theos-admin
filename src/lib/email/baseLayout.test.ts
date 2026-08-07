import { describe, it, expect } from 'vitest'
import { renderEmail, inlineButtonColors } from './baseLayout'

describe('renderEmail · preheader', () => {
  const PRE = '<div data-preheader style="display:none;">Texto de la bandeja</div>'

  it('iza el preheader al inicio del <body>, antes del logo', () => {
    const html = renderEmail(`${PRE}\n<p>Hola</p>`)
    const iBody = html.indexOf('<body>')
    const iPre = html.indexOf('data-preheader')
    const iLogo = html.indexOf('alt="Theos Place"')
    expect(iPre).toBeGreaterThan(iBody)
    expect(iPre).toBeLessThan(iLogo)
  })

  it('no lo duplica: sale una sola vez y no queda dentro del cuerpo', () => {
    const html = renderEmail(`${PRE}<p>Hola</p>`)
    expect(html.split('data-preheader').length - 1).toBe(1)
    // El contenido del cuerpo sigue intacto.
    expect(html).toContain('<p>Hola</p>')
  })

  it('sin preheader el layout no cambia', () => {
    const html = renderEmail('<p>Hola</p>')
    expect(html).toContain('<p>Hola</p>')
    expect(html).not.toContain('data-preheader')
  })
})

// ── Color del texto de los botones (2026-08-06) ─────────────────────────────
// El <style> del layout ya lo declara blanco, pero varios clientes lo tiran y
// pintan el enlace de azul: botón coral con letra azul.
describe('inlineButtonColors', () => {
  it('le pone blanco en línea a un botón sin style', () => {
    const out = inlineButtonColors('<a class="cta-button" href="https://x">Ir →</a>')
    expect(out).toContain('style="color:#ffffff; text-decoration:none;"')
    expect(out).toContain('href="https://x"')
  })

  it('funciona con la clase antes o después del href', () => {
    expect(inlineButtonColors('<a href="https://x" class="cta-button">Ir</a>'))
      .toContain('color:#ffffff')
    expect(inlineButtonColors('<a class="cta-secondary" href="https://x">Ir</a>'))
      .toContain('color:#ffffff')
  })

  it('NO pisa un style escrito a mano', () => {
    const html = '<a class="cta-button" style="color:#161440" href="https://x">Ir</a>'
    expect(inlineButtonColors(html)).toBe(html)
  })

  it('no toca los enlaces normales', () => {
    const html = '<p>Escribinos a <a href="mailto:x@y.com">x@y.com</a></p>'
    expect(inlineButtonColors(html)).toBe(html)
  })

  it('renderEmail lo aplica solo', () => {
    expect(renderEmail('<a class="cta-button" href="https://x">Ir</a>'))
      .toContain('style="color:#ffffff; text-decoration:none;"')
  })
})

// ── EST-13 · Tabla de conteos de la retroalimentación ───────────────────────
describe('estilos de la tabla de puntajes', () => {
  const html = renderEmail('<table class="score-table"><tr><td class="score-crit">x</td></tr></table>')

  it('las clases viven en el layout, no en el cuerpo', () => {
    // Un <style> dentro del body lo ignoran varios clientes de correo.
    expect(html).toContain('.score-table')
    expect(html).toContain('.score-crit')
    expect(html).toContain('.scale-legend')
  })

  it('tiene variante responsive: 6 columnas no entran en un celular', () => {
    const media = html.slice(html.indexOf('@media'))
    expect(media).toContain('.score-table')
  })

  it('el cuerpo pasa tal cual, con el header y el footer del sistema', () => {
    expect(html).toContain('class="score-table"')
    expect(html).toContain('class="wrapper"')
  })
})
