import { describe, it, expect } from 'vitest'
import {
  situacionDelCredito, resumirReclasificaciones, rangoDelPeriodo,
  type FilaDeReclasificacion,
} from './reporte-de-reclasificaciones'

const fila = (over: Partial<FilaDeReclasificacion> = {}): FilaDeReclasificacion => ({
  persona: 'Ana', emitido: '2026-10-05', monto: 5000, currency: 'CRC',
  pago_origen: 'p1', rubro_origen: 'Matrícula · Nivel 3', motivo: 'se fue de viaje',
  usado: null, rubro_destino: null, estado: 'active', vence: '2027-01-22', ...over,
})

describe('FIN-9 · la situación de cada crédito', () => {
  it('distingue usado, vencido y pendiente', () => {
    const hoy = '2026-10-05'
    expect(situacionDelCredito(fila({ estado: 'used', usado: '2026-11-01' }), hoy)).toBe('Usado')
    expect(situacionDelCredito(fila({ vence: '2026-09-30' }), hoy)).toBe('Vencido sin usar')
    expect(situacionDelCredito(fila(), hoy)).toBe('Pendiente de usar')
    expect(situacionDelCredito(fila({ estado: 'revoked' }), hoy)).toBe('Anulado')
  })

  it('un crédito usado NO cuenta como vencido aunque la fecha haya pasado', () => {
    // El orden de las condiciones importa: se usó antes de vencer.
    expect(situacionDelCredito(
      fila({ estado: 'used', usado: '2026-08-01', vence: '2026-09-30' }), '2026-10-05',
    )).toBe('Usado')
  })
})

describe('FIN-9 · los totales, SIEMPRE por moneda', () => {
  it('no suma colones con dólares', () => {
    /**
     * INT-3. En un reporte contable ese número se copia a otro lado, y
     * sumar monedas da una cifra que no significa nada.
     */
    const r = resumirReclasificaciones([
      fila({ currency: 'CRC', monto: 5000 }),
      fila({ currency: 'USD', monto: 100 }),
    ], '2026-10-05')
    expect(r.porMoneda).toHaveLength(2)
    expect(r.porMoneda.find(x => x.currency === 'CRC')?.emitido).toBe(5000)
    expect(r.porMoneda.find(x => x.currency === 'USD')?.emitido).toBe(100)
  })

  it('separa lo usado, lo pendiente y lo vencido', () => {
    const r = resumirReclasificaciones([
      fila({ monto: 1000, estado: 'used', usado: '2026-11-01' }),
      fila({ monto: 2000 }),
      fila({ monto: 3000, vence: '2026-09-01' }),
      fila({ monto: 9000, estado: 'revoked' }),
    ], '2026-10-05')
    const crc = r.porMoneda[0]
    expect(crc.emitido).toBe(15000)
    expect(crc.usado).toBe(1000)
    expect(crc.pendiente).toBe(2000)
    expect(crc.vencido).toBe(3000)
    // El anulado se emitió pero no está en ninguna de las tres: no es plata
    // que Theos deba ni que haya gastado.
    expect(crc.usado + crc.pendiente + crc.vencido).toBe(6000)
  })

  it('«pendiente» es lo que Theos todavía DEBE', () => {
    const r = resumirReclasificaciones([fila({ monto: 7500 })], '2026-10-05')
    expect(r.porMoneda[0].pendiente).toBe(7500)
  })
})

describe('FIN-9 · el período, en hora de Costa Rica', () => {
  it('un mes va del 1 al último día', () => {
    expect(rangoDelPeriodo({ anio: 2026, mes: 2 })).toEqual({
      desde: '2026-02-01T00:00:00.000-06:00',
      hasta: '2026-02-28T23:59:59.999-06:00',
    })
  })

  it('febrero bisiesto no se corta en 28', () => {
    expect(rangoDelPeriodo({ anio: 2028, mes: 2 }).hasta).toContain('2028-02-29')
  })

  it('sin mes, el año entero', () => {
    expect(rangoDelPeriodo({ anio: 2026 })).toEqual({
      desde: '2026-01-01T00:00:00.000-06:00',
      hasta: '2026-12-31T23:59:59.999-06:00',
    })
  })

  it('el offset es el de Costa Rica, no UTC', () => {
    // Sin el -06:00, un crédito emitido el 31 a las 7 p.m. cae en el mes
    // siguiente y el reporte de ese mes no lo trae.
    for (const v of Object.values(rangoDelPeriodo({ anio: 2026, mes: 10 }))) {
      expect(v).toContain('-06:00')
    }
  })
})
