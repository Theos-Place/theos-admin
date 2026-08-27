/**
 * El correo de inscripción a un evento. Lo que se prueba es lo que puede salir
 * mal en silencio: el bloque del pago.
 *
 * Las secciones {{#pago_pendiente}} / {{#sin_pago}} se usan como CONDICIONAL, no
 * como lista. Si alguien pasa un booleano en vez de un array, el motor lo ignora
 * y el bloque desaparece sin error: el correo sale sin decir que falta pagar, y
 * nadie se entera hasta que la persona llega al evento sin haber pagado.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderTemplate } from './render-vars'
import { FALLBACK } from './system-template-fallbacks'

const plantilla = FALLBACK.inscripcion_evento
const base = {
  nombre: 'Ana Soto',
  nombre_evento: 'Entre Mujeres',
  fecha_evento: 'sábado, 22 de agosto de 2026, 08:30 a. m.',
  lugar_evento: 'Sede Home',
}

describe('correo de inscripción a evento', () => {
  it('con comprobante recibido dice que está en revisión, NO que el pago falta', () => {
    const html = renderTemplate(plantilla.html, {
      ...base,
      en_revision: [{ monto: '₡2 000' }],
      sin_pago: [],
    })
    expect(html).toContain('₡2 000')
    expect(html).toContain('Recibimos tu comprobante')
    expect(html).toContain('finanzas lo revisa')
    // El texto viejo le decía a quien acababa de pagar que no había pagado.
    expect(html).not.toMatch(/pendiente el pago|falta.*pag|Sub[ií] el comprobante/i)
    expect(html).not.toContain('No hay nada más que hacer')
  })

  it('sin costo no menciona comprobante ni monto', () => {
    const html = renderTemplate(plantilla.html, { ...base, en_revision: [], sin_pago: [{}] })
    expect(html).toContain('No hay nada más que hacer')
    expect(html).not.toContain('comprobante')
    expect(html).not.toContain('₡')
  })

  it('siempre trae el evento, la fecha y el lugar', () => {
    const html = renderTemplate(plantilla.html, { ...base, en_revision: [], sin_pago: [{}] })
    expect(html).toContain('Entre Mujeres')
    expect(html).toContain('08:30')
    expect(html).toContain('Sede Home')
    expect(html).toContain('Ana Soto')
    // Ningún marcador sin resolver.
    expect(html).not.toMatch(/\{\{|\}\}/)
  })

  it('la plantilla de la BD es la misma que el fallback del código', () => {
    // Si se editan por separado, la gente recibe un correo distinto al que se
    // probó acá — y el fallback solo aparece cuando la BD no tiene la fila, que
    // es justo cuando nadie está mirando.
    // La 160000 la creó; la 180000 la corrigió. Vale la ÚLTIMA.
    const sql = readFileSync('supabase/migrations/20260827180000_inscripcion_evento_en_revision.sql', 'utf8')
    expect(sql).toContain(plantilla.html)

  })
})
