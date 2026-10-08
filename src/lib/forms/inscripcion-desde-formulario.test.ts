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

  it('el estado de pago NO está escrito a mano en el insert', () => {
    /**
     * Hasta el 2026-10-07 acá decía `payment_status: 'pending'` fijo, con este
     * argumento: «un `paid` le regalaría la entrada a cualquiera que llene un
     * formulario». Valía mientras no se mirara el formulario — y dejó las 80
     * inscripciones del 10 de octubre en «pendiente» cuando TODAS traían el
     * comprobante, porque ese formulario lo pide obligatorio.
     *
     * Ahora lo decide `lib/forms/pago-al-inscribirse`, que tiene sus pruebas:
     * `paid` solo si el formulario EXIGE comprobante y la persona lo adjuntó.
     * Lo que este test cuida es que no vuelva un literal — ni el viejo
     * `'pending'`, que taparía la regla, ni un `'paid'`, que sí regalaría la
     * entrada.
     */
    const bloque = Q.slice(Q.indexOf('const faltan = ids.filter'))
    expect(bloque).toContain('payment_status: estadoDePago')
    expect(bloque).not.toContain("payment_status: 'pending'")
    expect(bloque).not.toContain("payment_status: 'paid'")
    expect(bloque).not.toContain("payment_status: 'exempted'")
  })

  it('y el formulario, que es quien decide, se lee de la BASE', () => {
    // Del navegador viene si el campo trae algo; que el formulario EXIJA
    // comprobante lo dice `form_fields`, que el cliente no escribe. Es lo
    // único que impide que alguien se marque pagado solo.
    expect(Q).toContain(".from('form_fields').select('id, field_type, label, is_required')")
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
    // El try abarca ahora también el cálculo del estado de pago, que lee
    // `form_fields`: si esa consulta fallara, tampoco debe tumbar el envío.
    const i = Q.indexOf('await linkResponseToRegistration(supabase')
    expect(i, 'tiene que llamarse').toBeGreaterThan(-1)
    const antes = Q.slice(0, i)
    expect(antes.lastIndexOf('try {')).toBeGreaterThan(antes.lastIndexOf('} catch'))
    expect(Q.slice(i)).toMatch(/\} catch/)
  })
})
