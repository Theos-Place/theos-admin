import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * EL CAMINO del estado de pago, de punta a punta.
 *
 * La regla puede estar perfecta y no llegar nunca al `insert`. Es lo que
 * pasó con EST-26 el 2026-10-07: las dos puntas con test y el medio botando
 * el dato.
 */
const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const QUERIES = sinComentarios('src/lib/supabase/queries/forms.ts')

describe('pago al inscribirse · el cableado', () => {
  it('el insert usa el estado calculado, no un literal', () => {
    expect(QUERIES).toContain('payment_status: estadoDePago,')
    expect(QUERIES).not.toContain("payment_status: 'pending',")
    expect(QUERIES).not.toContain("payment_status: 'paid',")
  })

  it('quien llama lo calcula con `estadoDePagoAlInscribirse`', () => {
    expect(QUERIES).toContain('estadoDePagoAlInscribirse({')
    expect(QUERIES).toContain('estado, pago, comprobante,')
  })

  it('los CAMPOS salen de la base, no del navegador', () => {
    /**
     * Es lo único que impide que alguien se marque pagado solo. Del cliente
     * viene si el campo trae algo; que el formulario EXIJA comprobante lo
     * dice `form_fields`, que el cliente no escribe.
     */
    expect(QUERIES).toContain(".from('form_fields').select('id, field_type, label, is_required')")
  })

  it('la regla vive en su módulo: acá se LLAMA, no se reescribe', () => {
    /**
     * `esCampoDeComprobante` sí aparece —hace falta para sacar el nombre del
     * archivo adjunto—, y eso está bien: es reusar la regla. Lo que no puede
     * aparecer es su CONTENIDO, el regex de etiquetas, porque esa copia es la
     * que se queda atrás cuando alguien agrega una palabra nueva.
     */
    expect(QUERIES).toContain('esCampoDeComprobante')
    expect(QUERIES).not.toContain('comprobante|recibo')
    expect(QUERIES).not.toContain('sinpe|deposito')
  })
})

describe('pago al inscribirse · la fila de payments', () => {
  it('se crea el pago, no solo la inscripción', () => {
    /**
     * EL BUG DE LAS DOS TABLAS. El tab del evento lee
     * `event_registrations.payment_status`; la tabla de pagos y el perfil de
     * cada persona leen `payments`. Marcar solo la primera dejaba el evento
     * diciendo «pagado» y los otros dos «pendiente».
     */
    expect(QUERIES).toContain('crearPagoDeLaInscripcion')
    expect(QUERIES).toContain("from('payments').insert(")
  })

  it('nace aprobado, tomado del módulo y no escrito acá', () => {
    expect(QUERIES).toContain('status: input.pago.status')
    expect(QUERIES).toContain('review_status: input.pago.review_status')
    expect(QUERIES).not.toContain("review_status: 'en_revision'")
  })

  it('el comprobante se COPIA al bucket que lee finanzas', () => {
    // El formulario guarda en `form-uploads` y la pantalla de pagos lee
    // `payment-receipts`: un receipt_path al primero no se abre.
    expect(QUERIES).toContain("from('form-uploads').download(")
    expect(QUERIES).toContain("from('payment-receipts')")
  })

  it('si la copia del comprobante falla, el pago se crea IGUAL', () => {
    /**
     * Que finanzas vea un pago sin adjunto es molesto; que no vea el pago es
     * la plata perdida. La copia va en su propio try y no corta el insert.
     */
    const fn = QUERIES.slice(QUERIES.indexOf('async function crearPagoDeLaInscripcion'))
    const cuerpo = fn.slice(0, fn.indexOf("from('payments').insert("))
    expect(cuerpo).toContain('catch')
  })

  it('el pago queda enlazado a la inscripción', () => {
    // Sin esto, aprobar o rechazar el pago no toca la inscripción.
    expect(QUERIES).toContain('event_registration_id:')
  })

  it('el MONTO sale del evento, no del navegador', () => {
    expect(QUERIES).toContain("select('requires_payment, payment_amount, title')")
    expect(QUERIES).toContain('pagoDeInscripcion({ campos: listaCampos, respuestas, evento })')
  })
})
