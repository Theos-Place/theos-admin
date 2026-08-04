import { describe, it, expect } from 'vitest'
import { renderEmail } from './baseLayout'

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
