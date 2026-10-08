import { describe, it, expect } from 'vitest'
import {
  esCampoDeComprobante, pideComprobante, adjuntoComprobante, estadoDePagoAlInscribirse,
  pagoDeInscripcion, esCampoDeFechaDePago,
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

describe('el PAGO que acompaña a la inscripción', () => {
  const EVENTO = { requires_payment: true, payment_amount: 10000 }
  const conComprobante = [{ field_id: 'f-comp', value_text: 'recibo.jpg' }]

  it('EL BUG DE LAS DOS TABLAS: no basta con marcar la inscripción', () => {
    /**
     * El 2026-10-07 el evento del 10 de octubre decía «pagado» en su tab y
     * «pendiente» en la tabla de pagos y en el perfil de cada persona,
     * porque el camino automático nunca creaba la fila de `payments`. Diez
     * personas no tenían ninguna.
     */
    const p = pagoDeInscripcion({ campos: [COMPROBANTE, FECHA], respuestas: conComprobante, evento: EVENTO })
    expect(p).not.toBeNull()
    expect(p!.amount).toBe(10000)
  })

  it('nace APROBADO, que es lo que se pidió', () => {
    // El comprobante viene adjunto y el formulario lo exigía: dejarlo en
    // revisión obliga a aprobar a mano ochenta veces lo que ya está probado.
    const p = pagoDeInscripcion({ campos: [COMPROBANTE], respuestas: conComprobante, evento: EVENTO })
    expect(p!.status).toBe('paid')
    expect(p!.review_status).toBe('aprobado')
  })

  it('sin comprobante NO se crea pago, aunque el evento cobre', () => {
    expect(pagoDeInscripcion({
      campos: [COMPROBANTE], respuestas: [], evento: EVENTO,
    })).toBeNull()
  })

  it('en una actividad GRATUITA tampoco, aunque adjunte algo', () => {
    // Un pago de ₡0 no es un pago: ensucia el estado de cuenta con una línea
    // que no significa nada.
    for (const evento of [
      { requires_payment: false, payment_amount: 10000 },
      { requires_payment: true, payment_amount: 0 },
      { requires_payment: true, payment_amount: null },
    ]) {
      expect(pagoDeInscripcion({ campos: [COMPROBANTE], respuestas: conComprobante, evento }),
        JSON.stringify(evento)).toBeNull()
    }
  })

  it('el monto llega como texto desde la base y se usa igual', () => {
    // `payment_amount` es numeric: el driver lo entrega como '10000.00'.
    const p = pagoDeInscripcion({
      campos: [COMPROBANTE], respuestas: conComprobante,
      evento: { requires_payment: true, payment_amount: '10000.00' },
    })
    expect(p!.amount).toBe(10000)
  })

  it('toma la fecha que la persona declaró', () => {
    const p = pagoDeInscripcion({
      campos: [COMPROBANTE, FECHA],
      respuestas: [...conComprobante, { field_id: 'f-fecha', value_text: '2026-10-03' }],
      evento: EVENTO,
    })
    expect(p!.payment_date).toBe('2026-10-03')
  })

  it('y descarta una fecha con cualquier otra forma en vez de guardarla', () => {
    // Una fecha rara acá desordena los reportes de finanzas.
    for (const v of ['03/10/2026', 'ayer', '2026-13-01', '']) {
      const p = pagoDeInscripcion({
        campos: [COMPROBANTE, FECHA],
        respuestas: [...conComprobante, { field_id: 'f-fecha', value_text: v }],
        evento: EVENTO,
      })
      expect(p!.payment_date, v).toBeNull()
    }
  })

  it('la fecha del COMPROBANTE no se confunde con la del pago', () => {
    // `esCampoDeFechaDePago` pide tipo date; el adjunto nunca lo es.
    expect(esCampoDeFechaDePago(COMPROBANTE)).toBe(false)
    expect(esCampoDeFechaDePago(FECHA)).toBe(true)
  })
})
