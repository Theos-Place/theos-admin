import { describe, it, expect } from 'vitest'
import {
  esCampoDeComprobante, pideComprobante, adjuntoComprobante, estadoDePagoAlInscribirse,
  type CampoDelFormulario,
} from './pago-al-inscribirse'

/** El campo real del formulario del 10 de octubre. */
const COMPROBANTE: CampoDelFormulario = {
  id: 'f-comp', field_type: 'image',
  label: 'Adjuntar imagen del comprobante de pago:', is_required: true,
}
const FECHA: CampoDelFormulario = {
  id: 'f-fecha', field_type: 'date', label: 'Fecha en que se realizó el pago:', is_required: true,
}

describe('reconocer el campo del comprobante', () => {
  it('reconoce el del formulario del 10 de octubre', () => {
    expect(esCampoDeComprobante(COMPROBANTE)).toBe(true)
  })

  it('un campo de FECHA del pago NO es el comprobante', () => {
    // Dice «pago» en la etiqueta y no prueba nada: cualquiera escribe una fecha.
    expect(esCampoDeComprobante(FECHA)).toBe(false)
  })

  it('tampoco un texto que diga comprobante', () => {
    expect(esCampoDeComprobante({
      id: 'x', field_type: 'text', label: 'Número de comprobante', is_required: true,
    })).toBe(false)
  })

  it('ni una imagen que sea otra cosa', () => {
    // Si bastara el tipo, la foto del carnet valdría como pago.
    for (const label of ['Foto del carnet', 'Permiso del menor firmado', 'Tu foto de perfil']) {
      expect(esCampoDeComprobante({ id: 'x', field_type: 'image', label, is_required: true }), label)
        .toBe(false)
    }
  })

  it('acepta las formas en que la gente lo nombra de verdad, con y sin tildes', () => {
    for (const label of ['Recibo', 'Comprobante', 'Captura del SINPE', 'Depósito bancario',
                         'Comprobante de la transferencia']) {
      expect(esCampoDeComprobante({ id: 'x', field_type: 'image', label, is_required: true }), label)
        .toBe(true)
    }
  })
})

describe('¿el formulario exige probar el pago?', () => {
  it('sí cuando el comprobante es obligatorio', () => {
    expect(pideComprobante([COMPROBANTE, FECHA])).toBe(true)
  })

  it('NO cuando es opcional: quien no lo sube, no pagó', () => {
    expect(pideComprobante([{ ...COMPROBANTE, is_required: false }])).toBe(false)
  })

  it('NO en un formulario sin comprobante — una actividad gratuita', () => {
    expect(pideComprobante([
      { id: 'a', field_type: 'text', label: '¿Cómo te enteraste?', is_required: true },
    ])).toBe(false)
  })
})

describe('el estado con el que nace la inscripción', () => {
  const con = (v: unknown) => [{ field_id: 'f-comp', value_text: v as string }]

  it('EL CASO DE FLORIANA: comprobante pedido y adjunto → nace PAGADA', () => {
    expect(estadoDePagoAlInscribirse({
      campos: [COMPROBANTE, FECHA],
      respuestas: con('form-uploads/abc.jpg'),
    })).toBe('paid')
  })

  it('actividad GRATUITA o que se paga en la puerta → sigue pendiente', () => {
    /**
     * Es la mitad que no se puede perder. El mismo camino crea inscripciones
     * de actividades sin costo; un `paid` por default diría que pagó quien no
     * pagó, y eso no se nota hasta que alguien cuadra la plata.
     */
    expect(estadoDePagoAlInscribirse({
      campos: [{ id: 'a', field_type: 'text', label: 'Alergias', is_required: false }],
      respuestas: [{ field_id: 'a', value_text: 'ninguna' }],
    })).toBe('pending')
  })

  it('comprobante pedido pero VACÍO → pendiente, no pagada', () => {
    for (const v of ['', '   ', null, undefined]) {
      expect(estadoDePagoAlInscribirse({ campos: [COMPROBANTE], respuestas: con(v) }),
        JSON.stringify(v)).toBe('pending')
    }
  })

  it('sin ninguna respuesta tampoco', () => {
    expect(estadoDePagoAlInscribirse({ campos: [COMPROBANTE], respuestas: [] })).toBe('pending')
  })

  it('un adjunto guardado como lista cuenta, y la lista vacía no', () => {
    expect(adjuntoComprobante([COMPROBANTE],
      [{ field_id: 'f-comp', value_json: ['a.jpg'] }])).toBe(true)
    expect(adjuntoComprobante([COMPROBANTE],
      [{ field_id: 'f-comp', value_json: [] }])).toBe(false)
  })

  it('un adjunto en OTRO campo no cuenta como comprobante', () => {
    // La foto del carnet no paga la actividad.
    expect(adjuntoComprobante(
      [COMPROBANTE, { id: 'carnet', field_type: 'image', label: 'Foto del carnet' }],
      [{ field_id: 'carnet', value_text: 'carnet.jpg' }],
    )).toBe(false)
  })

  it('con el comprobante OPCIONAL, adjuntarlo no alcanza para nacer pagada', () => {
    /**
     * Es deliberado y vale explicarlo: si el campo es opcional, el formulario
     * no está diciendo «esto cuesta». Puede ser un adjunto de cortesía, y
     * marcar `paid` por él sería inventar un cobro que nadie definió.
     */
    expect(estadoDePagoAlInscribirse({
      campos: [{ ...COMPROBANTE, is_required: false }],
      respuestas: con('recibo.jpg'),
    })).toBe('pending')
  })
})
