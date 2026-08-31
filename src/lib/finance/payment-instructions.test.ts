import { describe, it, expect } from 'vitest'
import {
  SINPE_TELEFONO, CUENTA_BAC, detalleSugerido, instruccionesHtml, instruccionesUnaLinea,
} from './payment-instructions'

describe('detalleSugerido', () => {
  it('une curso y persona', () => {
    expect(detalleSugerido('Nivel 1', 'Ana Rojas')).toBe('Nivel 1 — Ana Rojas')
  })

  it('con uno solo, no deja el guion colgando', () => {
    expect(detalleSugerido('Nivel 1', null)).toBe('Nivel 1')
    expect(detalleSugerido(null, 'Ana Rojas')).toBe('Ana Rojas')
    expect(detalleSugerido('  ', '  ')).toBe('')
  })
})

describe('instruccionesHtml', () => {
  it('lleva los tres datos de pago', () => {
    const html = instruccionesHtml()
    expect(html).toContain(SINPE_TELEFONO)
    expect(html).toContain(CUENTA_BAC.numero)
    expect(html).toContain(CUENTA_BAC.iban)
  })

  it('con detalle, lo muestra listo para copiar', () => {
    expect(instruccionesHtml('Nivel 1 — Ana Rojas')).toContain('Nivel 1 — Ana Rojas')
  })

  it('sin detalle, igual explica qué escribir', () => {
    // El caso importa: si no sabemos el curso, la instrucción no puede
    // desaparecer — es la razón por la que finanzas puede identificar el pago.
    const html = instruccionesHtml()
    expect(html).toMatch(/nombre del curso o evento/i)
    expect(html).toMatch(/persona inscrita/i)
  })

  it('no deja un "undefined" a la vista', () => {
    for (const html of [instruccionesHtml(), instruccionesHtml(''), instruccionesHtml('  ')]) {
      expect(html).not.toMatch(/undefined|null/)
    }
  })
})

describe('instruccionesUnaLinea', () => {
  it('cabe en un aviso y no pierde los datos', () => {
    const l = instruccionesUnaLinea()
    expect(l).toContain(SINPE_TELEFONO)
    expect(l).toContain(CUENTA_BAC.numero)
    expect(l.length).toBeLessThan(90)
  })
})
