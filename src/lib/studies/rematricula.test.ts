import { describe, it, expect } from 'vitest'
import { decidirRematricula, type PagoDeLaMatricula } from './rematricula'

const pago = (over: Partial<PagoDeLaMatricula> = {}): PagoDeLaMatricula =>
  ({ id: 'p1', concept: 'matricula', status: 'pending', ...over })

describe('decidirRematricula', () => {
  it('EL BUG: quien ya está adentro y pagó no se toca', () => {
    // Daniel Alfaro y Alberto Vargas: pagaron, quedaron enrolled, y la segunda
    // matriculación los devolvió a 'pendiente_de_pago' con otro cobro entero.
    expect(decidirRematricula({
      estadoActual: 'enrolled', pagos: [pago({ status: 'paid' })], requierePago: true,
    })).toEqual({ accion: 'nada_que_hacer' })
  })

  it('EL OTRO BUG: si ya hay un cobro abierto, se reusa en vez de crear otro', () => {
    // Yanil Gutiérrez: tenía un cobro vivo y le nació un segundo.
    expect(decidirRematricula({
      estadoActual: 'pendiente_de_pago', pagos: [pago({ id: 'viejo' })], requierePago: true,
    })).toEqual({ accion: 'reusar_cobro', pagoId: 'viejo' })
  })

  it('en un plan sin costo, estar enrolled ya es todo', () => {
    expect(decidirRematricula({ estadoActual: 'enrolled', pagos: [], requierePago: false }))
      .toEqual({ accion: 'nada_que_hacer' })
  })

  it('REINCORPORAR a alguien dado de baja SÍ rehace la matrícula', () => {
    // Acá la persona no está en el grupo: la matrícula y su cobro son nuevos y
    // corresponden. Es el caso que arregló b2edeaed y no se puede romper.
    for (const estado of ['dropped', 'cancelada', 'withdrawn', 'transferred', 'expirada']) {
      expect(decidirRematricula({
        estadoActual: estado, pagos: [pago({ status: 'cancelado' })], requierePago: true,
      }), estado).toEqual({ accion: 'seguir' })
    }
  })

  it('una matrícula que no existe se hace de cero', () => {
    expect(decidirRematricula({ estadoActual: null, pagos: [], requierePago: true })).toEqual({ accion: 'seguir' })
    expect(decidirRematricula({ estadoActual: undefined, pagos: [], requierePago: true })).toEqual({ accion: 'seguir' })
  })

  it('un cobro CANCELADO no cuenta como cobro vivo', () => {
    // Al dar de baja se cancela el cobro; si contara, la persona quedaría
    // atrapada reusando un cobro que nadie debe.
    expect(decidirRematricula({
      estadoActual: 'pendiente_de_pago', pagos: [pago({ status: 'cancelado' })], requierePago: true,
    })).toEqual({ accion: 'seguir' })
  })

  it('un cobro de OTRO concepto no es el de la matrícula', () => {
    expect(decidirRematricula({
      estadoActual: 'pendiente_de_pago', pagos: [pago({ concept: 'folletos' })], requierePago: true,
    })).toEqual({ accion: 'seguir' })
  })

  it('enrolled pero debiendo: se reusa el cobro, no se crea otro ni se retrocede', () => {
    // Pasa con las matrículas automáticas del cierre, que nacen enrolled con un
    // cobro aparte.
    expect(decidirRematricula({
      estadoActual: 'enrolled', pagos: [pago({ id: 'abierto' })], requierePago: true,
    })).toEqual({ accion: 'reusar_cobro', pagoId: 'abierto' })
  })

  it('con un cobro pagado y otro pendiente, gana el pagado', () => {
    // El estado exacto en que quedaron los tres casos reales. Lo que no puede
    // pasar es que se le cree un tercero.
    expect(decidirRematricula({
      estadoActual: 'enrolled',
      pagos: [pago({ id: 'ok', status: 'paid' }), pago({ id: 'sobrante' })],
      requierePago: true,
    })).toEqual({ accion: 'nada_que_hacer' })
  })
})
