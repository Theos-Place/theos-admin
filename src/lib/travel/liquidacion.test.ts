import { describe, it, expect } from 'vitest'
import {
  saldos, aReintegrar, aReembolsar, revisarGastos, gastosFueraDeFecha,
  TEXTO_DECLARACION_JURADA, type GastoEjecutado,
} from './liquidacion'

const gasto = (over: Partial<GastoEjecutado> = {}): GastoEjecutado => ({
  fecha: '2026-11-11', rubro: 'alimentacion', monto: 10000, moneda: 'CRC',
  receipt_path: 'viajes/x/1.png', ...over,
})

describe('FIN-11 · quién le debe a quién', () => {
  it('gastó menos que el anticipo: devuelve la diferencia', () => {
    const s = saldos([gasto({ monto: 60000 })], { monto: 100000, moneda: 'CRC' })
    expect(s).toEqual([{ moneda: 'CRC', gastado: 60000, anticipo: 100000, diferencia: 40000, resultado: 'reintegrar' }])
  })

  it('gastó más: la Asociación le reembolsa', () => {
    const s = saldos([gasto({ monto: 130000 })], { monto: 100000, moneda: 'CRC' })
    expect(s[0].resultado).toBe('reembolsar')
    expect(aReembolsar(s)).toEqual([{ moneda: 'CRC', monto: 30000 }])
  })

  it('justo: cuadra, y no aparece en ninguna de las dos listas', () => {
    const s = saldos([gasto({ monto: 100000 })], { monto: 100000, moneda: 'CRC' })
    expect(s[0].resultado).toBe('cuadra')
    expect(aReintegrar(s)).toEqual([])
    expect(aReembolsar(s)).toEqual([])
  })

  it('sin anticipo, todo lo gastado se reembolsa', () => {
    const s = saldos([gasto({ monto: 45000 })], null)
    expect(s[0]).toMatchObject({ anticipo: 0, resultado: 'reembolsar' })
    expect(aReembolsar(s)).toEqual([{ moneda: 'CRC', monto: 45000 }])
  })

  it('UN ANTICIPO EN DÓLARES Y GASTOS EN COLONES NO SE COMPENSAN', () => {
    // Recibió $200 y gastó ₡150.000: debe los $200 Y le deben los ₡150.000.
    // Restarlos inventa un tipo de cambio y deja un asiento que no cuadra.
    const s = saldos([gasto({ monto: 150000, moneda: 'CRC' })], { monto: 200, moneda: 'USD' })
    expect(s).toEqual([
      { moneda: 'CRC', gastado: 150000, anticipo: 0, diferencia: -150000, resultado: 'reembolsar' },
      { moneda: 'USD', gastado: 0, anticipo: 200, diferencia: 200, resultado: 'reintegrar' },
    ])
    expect(aReintegrar(s)).toEqual([{ moneda: 'USD', monto: 200 }])
    expect(aReembolsar(s)).toEqual([{ moneda: 'CRC', monto: 150000 }])
  })

  it('un anticipo que no se gastó SÍ sale en la cuenta', () => {
    // Si solo miráramos los gastos, los $200 desaparecerían por no haber
    // tiquetes en dólares, y nadie los pediría de vuelta.
    const s = saldos([], { monto: 200, moneda: 'USD' })
    expect(s).toEqual([{ moneda: 'USD', gastado: 0, anticipo: 200, diferencia: 200, resultado: 'reintegrar' }])
  })

  it('sin gastos ni anticipo, no hay saldos', () => {
    expect(saldos([], null)).toEqual([])
  })

  it('no arrastra basura de flotante', () => {
    const s = saldos([gasto({ monto: 0.1 }), gasto({ monto: 0.2 })], { monto: 0.3, moneda: 'CRC' })
    expect(s[0].diferencia).toBe(0)
    expect(s[0].resultado).toBe('cuadra')
  })

  it('el orden es el de MONEDAS', () => {
    const s = saldos([gasto({ moneda: 'USD', monto: 1 }), gasto({ moneda: 'CRC', monto: 1 })], null)
    expect(s.map(x => x.moneda)).toEqual(['CRC', 'USD'])
  })
})

describe('FIN-11 · qué impide enviar la liquidación', () => {
  it('una liquidación bien, pasa', () => {
    expect(revisarGastos([gasto()])).toEqual([])
  })

  it('vacía, no', () => {
    expect(revisarGastos([])[0].mensaje).toContain('no puede ir vacía')
  })

  it('EL COMPROBANTE ES OBLIGATORIO', () => {
    // Sin él, la liquidación es la palabra de quien viajó — que es justo lo
    // que el anexo existe para no tener que aceptar.
    const p = revisarGastos([gasto({ receipt_path: null })])
    expect(p[0].mensaje).toContain('Falta el comprobante')
  })

  it('…salvo que se diga por qué no hay', () => {
    // Un taxi o un parqueo de barrio no dan factura. La excepción queda
    // escrita y visible, no escondida dentro de un monto.
    const p = revisarGastos([gasto({ receipt_path: null })], { sinComprobante: { 0: 'taxi sin factura' } })
    expect(p).toEqual([])
  })

  it('una justificación en blanco no cuenta como justificación', () => {
    const p = revisarGastos([gasto({ receipt_path: null })], { sinComprobante: { 0: '   ' } })
    expect(p[0].mensaje).toContain('Falta el comprobante')
  })

  it('monto en cero, sin fecha o moneda rara', () => {
    expect(revisarGastos([gasto({ monto: 0 })]).some(p => p.mensaje.includes('mayor que cero'))).toBe(true)
    expect(revisarGastos([gasto({ fecha: '' })]).some(p => p.mensaje.includes('fecha'))).toBe(true)
    expect(revisarGastos([gasto({ moneda: 'EUR' as never })]).some(p => p.mensaje.includes('Moneda'))).toBe(true)
  })

  it('dice en cuál fila está el problema', () => {
    const p = revisarGastos([gasto(), gasto({ monto: -1 })])
    expect(p.map(x => x.indice)).toEqual([1])
  })
})

describe('FIN-11 · gastos con fecha rara: avisan, no bloquean', () => {
  const viaje = { sale_at: '2026-11-10T08:00:00Z', vuelve_at: '2026-11-14T20:00:00Z' }

  it('un gasto durante el viaje no avisa', () => {
    expect(gastosFueraDeFecha([gasto({ fecha: '2026-11-12' })], viaje)).toEqual([])
  })

  it('un pasaje comprado tres semanas antes TAMPOCO: es lo normal', () => {
    expect(gastosFueraDeFecha([gasto({ fecha: '2026-10-21' })], viaje)).toEqual([])
  })

  it('pero uno de seis meses antes sí avisa', () => {
    expect(gastosFueraDeFecha([gasto({ fecha: '2026-05-01' })], viaje)).toEqual([0])
  })

  it('una fecha ilegible no se inventa una posición', () => {
    expect(gastosFueraDeFecha([gasto({ fecha: 'cuando sea' })], viaje)).toEqual([])
  })
})

describe('FIN-11 · la declaración jurada', () => {
  it('dice las tres cosas que tiene que decir', () => {
    // Texto del reglamento: vive en el módulo y no en el JSX, para que
    // cambiarlo sea a propósito y en un solo lugar.
    expect(TEXTO_DECLARACION_JURADA).toContain('fe de juramento')
    expect(TEXTO_DECLARACION_JURADA).toContain('otra liquidación')
    expect(TEXTO_DECLARACION_JURADA).toContain('reembolso')
  })
})
