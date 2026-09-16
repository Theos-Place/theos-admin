import { describe, it, expect } from 'vitest'
import { avisoDeDevolucion } from './aviso-de-devolucion'

describe('avisoDeDevolucion', () => {
  it('EL BUG: un pago por comprobante ya NO dice que fue por tarjeta', () => {
    // Irene Arias Vargas, ₡15.000. El aviso era binario (SINPE o tarjeta) y
    // 'comprobante' —el método de casi todos los pagos— caía en el else.
    const a = avisoDeDevolucion('comprobante')
    expect(a.texto).not.toMatch(/tarjeta/i)
    expect(a.texto).toMatch(/comprobante/i)
  })

  it('NINGÚN método promete que la plata sale sola', () => {
    // Lo peligroso no era el nombre: era prometer procesamiento automático por
    // una pasarela que no está activa. Finanzas podía dar por encaminada una
    // devolución que nadie iba a mover. Negar lo automático SÍ se vale ("NO es
    // automática"); lo que no puede aparecer es la promesa.
    for (const m of ['comprobante', 'sinpe', 'cash', 'card', 'scholarship'] as const) {
      expect(avisoDeDevolucion(m).texto, m).not.toMatch(/se procesar[áa] autom/i)
      expect(avisoDeDevolucion(m).texto, m).not.toMatch(/pasarela/i)
      expect(avisoDeDevolucion(m).tono, m).toBe('manual')
    }
  })

  it('cada método se nombra por lo que realmente fue', () => {
    expect(avisoDeDevolucion('sinpe').texto).toMatch(/SINPE/)
    expect(avisoDeDevolucion('cash').texto).toMatch(/efectivo/i)
    expect(avisoDeDevolucion('card').texto).toMatch(/tarjeta/i)
  })

  it('una beca avisa que no entró plata', () => {
    const a = avisoDeDevolucion('scholarship')
    expect(a.texto).toMatch(/beca/i)
    expect(a.texto).toMatch(/no entró plata/i)
  })

  it('sin método no se inventa uno', () => {
    for (const m of [null, undefined]) {
      expect(avisoDeDevolucion(m).texto).toMatch(/no quedó registrado/i)
      expect(avisoDeDevolucion(m).texto).not.toMatch(/tarjeta|SINPE/i)
    }
  })

  it('todos dicen que finanzas lo coordina a mano', () => {
    for (const m of ['comprobante', 'sinpe', 'cash', 'card'] as const) {
      expect(avisoDeDevolucion(m).texto, m).toMatch(/finanzas/i)
    }
  })
})
