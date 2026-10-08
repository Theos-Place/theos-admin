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
    expect(QUERIES).toMatch(/linkResponseToRegistration\(supabase, formId, input\.member_id, responseId, estado\)/)
  })

  it('los CAMPOS salen de la base, no del navegador', () => {
    /**
     * Es lo único que impide que alguien se marque pagado solo. Del cliente
     * viene si el campo trae algo; que el formulario EXIJA comprobante lo
     * dice `form_fields`, que el cliente no escribe.
     */
    expect(QUERIES).toContain(".from('form_fields').select('id, field_type, label, is_required')")
  })

  it('y la regla vive en su módulo, no repetida acá', () => {
    expect(QUERIES).not.toContain('esCampoDeComprobante')
    expect(QUERIES).not.toContain('comprobante|recibo')
  })
})
