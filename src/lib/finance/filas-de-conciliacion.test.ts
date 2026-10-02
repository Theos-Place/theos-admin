import { describe, it, expect } from 'vitest'
import {
  filasDeConciliacion, totalesPorMoneda, resumenDeConciliacion,
  diaDePagoCR, horaDePagoCR, type PagoParaConciliar,
} from '@/lib/finance/filas-de-conciliacion'

const pago = (p: Partial<PagoParaConciliar> = {}): PagoParaConciliar => ({
  member_name: 'Ana Rojas', entity_name: 'Nivel 1 · Martes Lindora',
  concept: 'matricula', amount: 5000, currency: 'CRC',
  paid_at: '2026-09-28T20:30:00.000Z', ...p,
})

describe('PAG-6 · las filas de la conciliación', () => {
  it('la fecha se escribe en día de Costa Rica, no en UTC', () => {
    // 00:57 UTC del martes es las 6:57 p.m. del LUNES en Costa Rica. Escrito
    // crudo, la hoja le pone al pago el día equivocado y la línea del estado
    // de cuenta no cuadra.
    expect(diaDePagoCR('2026-09-29T00:57:00.000Z')).toBe('2026-09-28')
    expect(horaDePagoCR('2026-09-29T00:57:00.000Z')).toBe('18:57')
  })

  it('y un pago sin fecha no se inventa una', () => {
    expect(filasDeConciliacion([pago({ paid_at: null })])[0].fecha_de_pago).toBe('—')
  })

  it('el monto va como número, para que la hoja lo pueda sumar', () => {
    const f = filasDeConciliacion([pago()])[0]
    expect(f.monto).toBe(5000)
    expect(typeof f.monto).toBe('number')
    expect(f.moneda).toBe('CRC')
  })

  it('INT-3 · los totales van por moneda y NUNCA sumados entre sí', () => {
    const filas = filasDeConciliacion([
      pago({ amount: 5000, currency: 'CRC' }),
      pago({ amount: 10000, currency: 'CRC' }),
      pago({ amount: 25, currency: 'USD' }),
    ])
    expect(totalesPorMoneda(filas)).toEqual({ CRC: 15000, USD: 25 })
  })

  it('la moneda en blanco cuenta como colones, que es lo que es', () => {
    // La columna `currency` se agregó en INT-2: lo histórico la tiene vacía.
    const filas = filasDeConciliacion([pago({ currency: null, amount: 3000 })])
    expect(totalesPorMoneda(filas)).toEqual({ CRC: 3000 })
  })

  it('un pago sin monto NO suma cero: cero diría que no entró plata', () => {
    const filas = filasDeConciliacion([pago({ amount: 1000 }), pago({ amount: null })])
    expect(totalesPorMoneda(filas)).toEqual({ CRC: 1000 })
    expect(resumenDeConciliacion(filas)).toContain('1 sin monto registrado')
  })

  it('el resumen nombra cada moneda por separado', () => {
    const filas = filasDeConciliacion([
      pago({ amount: 5000, currency: 'CRC' }),
      pago({ amount: 25, currency: 'USD' }),
    ])
    const r = resumenDeConciliacion(filas)
    expect(r).toContain('CRC')
    expect(r).toContain('USD')
    expect(r).toContain('+')
    // Lo que NO debe aparecer: un total único de 5025.
    expect(r).not.toContain('5025')
    expect(r).not.toContain('5.025')
  })

  it('lo que falta dice «—» y no queda en blanco', () => {
    const f = filasDeConciliacion([
      pago({ member_name: '', entity_name: '  ', concept: null }),
    ])[0]
    expect(f.nombre).toBe('—')
    expect(f.actividad).toBe('—')
    expect(f.concepto).toBe('—')
  })

  it('sin pagos, el resumen lo dice en vez de reventar', () => {
    expect(resumenDeConciliacion([])).toBe('0 pagos')
  })
})
