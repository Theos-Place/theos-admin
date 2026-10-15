import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// 2026-10-15 · El formulario de comprobante (archivo + referencia + enviar)
// estaba copiado en la ficha (matrícula e inscripción) y en la inscripción a
// eventos (ReceiptModal). Ahora los dos usan FormularioDeComprobante.
describe('un solo formulario de comprobante', () => {
  it('lo usan el modal de pagos de la ficha y el de la inscripción a eventos', () => {
    for (const f of ['src/components/members/MemberPaymentsList.tsx', 'src/components/events/useEventRegistration.tsx']) {
      expect(readFileSync(f, 'utf8'), f).toContain('<FormularioDeComprobante')
    }
  })
  it('ni el modal de pagos de la ficha ni ReceiptModal arman el POST a mano', () => {
    // Otros tres flujos SÍ lo arman y son distintos a propósito: el
    // comprobante dentro del asistente de matrícula (StudyReceiptModal), pagar
    // varios cobros con uno solo (PagarVariosJuntos) y la confirmación de
    // inscripción a evento, que inscribe y manda el comprobante en un paso.
    const ficha = readFileSync('src/components/members/MemberPaymentsList.tsx', 'utf8')
    expect(ficha).not.toContain("fd.append('reference'")
    const eventos = readFileSync('src/components/events/useEventRegistration.tsx', 'utf8')
    const receipt = eventos.slice(eventos.indexOf('function ReceiptModal'))
    expect(receipt).not.toContain("fd.append('reference'")
  })
})
