import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const Q = sinComentarios('src/lib/supabase/queries/forms.ts')

describe('llenar el formulario de un evento INSCRIBE', () => {
  /**
   * EL BUG (producción, 2026-10-06). `linkResponseToRegistration` solo
   * ENLAZABA: si la persona no tenía inscripción, la respuesta quedaba
   * suelta y el evento mostraba cero inscritos. Pasó con «Actividad
   * Servidores»: 70 personas llenaron el formulario —con comprobante de pago
   * adjunto— y el tab se veía vacío.
   *
   * La suposición rota era que el formulario se llena DESPUÉS de
   * inscribirse. En la práctica el formulario ES el link que se comparte.
   */
  it('crea la inscripción cuando no existe, no solo la enlaza', () => {
    expect(Q).toContain("from('event_registrations').insert(")
    expect(Q).toMatch(/const faltan = ids\.filter/)
  })

  it('nace PENDING, nunca pagada', () => {
    // Un `paid` acá le regalaría la entrada a cualquiera que llene un
    // formulario: el cobro y la revisión van por su propio carril.
    const bloque = Q.slice(Q.indexOf('const faltan = ids.filter'))
    expect(bloque).toContain("payment_status: 'pending'")
    expect(bloque).not.toContain("payment_status: 'paid'")
    expect(bloque).not.toContain("payment_status: 'exempted'")
  })

  it('queda enlazada a la respuesta que la creó', () => {
    const bloque = Q.slice(Q.indexOf('const faltan = ids.filter'))
    expect(bloque).toContain('form_response_id: responseId')
  })

  it('relee quién YA tiene inscripción en vez de confiar en el update', () => {
    // Entre las dos consultas la persona puede haberse inscrito por otro
    // lado, y el insert chocaría contra el único.
    expect(Q).toContain('const conInscripcion = new Set(')
  })

  it('y si igual choca, no revienta: la inscripción existe', () => {
    expect(Q).toContain("!== '23505'")
  })

  it('no pisa un enlace que ya estaba puesto', () => {
    // La PRIMERA respuesta es la que queda enlazada.
    expect(Q).toContain(".is('form_response_id', null)")
  })

  it('solo aplica al formulario de inscripción DEL evento', () => {
    // Un formulario de encuesta o de satisfacción no debe inscribir a nadie.
    expect(Q).toContain("eq('registration_form_id', formId)")
    expect(Q).toMatch(/if \(ids\.length === 0\) return/)
  })

  it('sigue siendo best-effort: no tumba el envío del formulario', () => {
    // Si la inscripción falla, la respuesta ya quedó guardada — perderla
    // sería peor que una inscripción que se reconcilia después.
    expect(Q).toMatch(/try \{\s*await linkResponseToRegistration[\s\S]{0,200}\} catch/)
  })
})
