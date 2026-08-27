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
  it('con pago pendiente muestra el monto y el link al comprobante', () => {
    const html = renderTemplate(plantilla.html, {
      ...base,
      pago_pendiente: [{ monto: '₡2 000', link_pago: 'https://x/mis-eventos' }],
      sin_pago: [],
    })
    expect(html).toContain('₡2 000')
    expect(html).toContain('https://x/mis-eventos')
    expect(html).toContain('cupo está reservado')
    expect(html).not.toContain('No hay nada más que hacer')
  })

  it('sin pago no menciona comprobante ni monto', () => {
    const html = renderTemplate(plantilla.html, { ...base, pago_pendiente: [], sin_pago: [{}] })
    expect(html).toContain('No hay nada más que hacer')
    expect(html).not.toContain('comprobante')
    expect(html).not.toContain('₡')
  })

  it('siempre trae el evento, la fecha y el lugar', () => {
    const html = renderTemplate(plantilla.html, { ...base, pago_pendiente: [], sin_pago: [{}] })
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
    const sql = readFileSync('supabase/migrations/20260827160000_inscripcion_evento_email.sql', 'utf8')
    expect(sql).toContain(plantilla.html)
    expect(sql).toContain(plantilla.subject)
  })
})
