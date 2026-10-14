import { describe, it, expect } from 'vitest'
import { saldo, porSemana, revisarFactura, sePuedeCerrar, nombreDelMes, mesActual, esMesValido, type Factura } from './adelantos'

const f = (over: Partial<Factura> = {}): Factura => ({
  semana: '2026-10-07', encargado: 'Ana', fecha: '2026-10-07', proveedor: 'Soda La Esquina',
  numero_factura: '00100001010000012345', monto: 25000, estado: 'liquidada', ...over,
})

describe('FIN-12 · «te quedan ₡X de ₡Y»', () => {
  it('resta lo gastado', () => {
    expect(saldo(200000, [f({ monto: 25000 }), f({ monto: 30000 })])).toMatchObject({ gastado: 55000, restante: 145000, sobregiro: false })
  })

  it('LO PENDIENTE TAMBIÉN RESTA: ya está comprometido', () => {
    // Un saldo que no las cuenta invita a gastar lo que ya se debe.
    const s = saldo(100000, [f({ monto: 60000 }), f({ monto: 50000, estado: 'pendiente' })])
    expect(s).toMatchObject({ gastado: 60000, pendiente: 50000, restante: -10000, sobregiro: true })
  })

  it('el sobregiro se MARCA, no se bloquea', () => {
    expect(saldo(10000, [f({ monto: 15000 })]).sobregiro).toBe(true)
  })

  it('porcentaje gastado, tope 100', () => {
    expect(saldo(100000, [f({ monto: 25000 })]).porcentaje).toBe(25)
    expect(saldo(100000, [f({ monto: 250000 })]).porcentaje).toBe(100)
    expect(saldo(0, []).porcentaje).toBe(0)
  })

  it('sin basura de flotante ni cero negativo', () => {
    const s = saldo(0.3, [f({ monto: 0.1 }), f({ monto: 0.2 })])
    expect(s.restante).toBe(0)
    expect(Object.is(s.restante, -0)).toBe(false)
  })
})

describe('FIN-12 · por semana, como en el Excel', () => {
  it('agrupa por fecha de charla con su encargado y total', () => {
    const s = porSemana([f({ semana: '2026-10-14', encargado: 'Luis', monto: 10000 }), f({ semana: '2026-10-07', monto: 25000 }), f({ semana: '2026-10-07', monto: 5000, encargado: null })])
    expect(s.map(x => [x.semana, x.encargado, x.total])).toEqual([['2026-10-07', 'Ana', 30000], ['2026-10-14', 'Luis', 10000]])
  })

  it('sin facturas, sin semanas', () => {
    expect(porSemana([])).toEqual([])
  })
})

describe('FIN-12 · qué no se deja guardar', () => {
  it('una factura bien', () => {
    expect(revisarFactura(f(), '2026-10')).toEqual([])
  })

  it('una semana de OTRO mes descuadra los dos meses', () => {
    expect(revisarFactura(f({ semana: '2026-11-04' }), '2026-10').some(p => p.mensaje.includes('no es del mes'))).toBe(true)
  })

  it('sin proveedor, monto cero, fechas rotas', () => {
    expect(revisarFactura(f({ proveedor: ' ' }), '2026-10').some(p => p.campo === 'proveedor')).toBe(true)
    expect(revisarFactura(f({ monto: 0 }), '2026-10').some(p => p.campo === 'monto')).toBe(true)
    expect(revisarFactura(f({ fecha: 'ayer' }), '2026-10').some(p => p.campo === 'fecha')).toBe(true)
  })

  it('el número de factura es OPCIONAL: hay sodas que no dan factura electrónica', () => {
    expect(revisarFactura(f({ numero_factura: null }), '2026-10')).toEqual([])
  })
})

describe('FIN-12 · cerrar el mes', () => {
  it('con todo liquidado, sí', () => {
    expect(sePuedeCerrar('abierto', [f()])).toEqual({ ok: true })
  })

  it('CON PENDIENTES NO: el saldo final decide la reposición y mentiría', () => {
    const r = sePuedeCerrar('abierto', [f({ estado: 'pendiente' })])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('1 factura pendiente')
  })

  it('dos veces no', () => {
    expect(sePuedeCerrar('cerrado', []).ok).toBe(false)
  })

  it('sin facturas también se puede cerrar (un mes sin gastos existe)', () => {
    expect(sePuedeCerrar('abierto', []).ok).toBe(true)
  })
})

describe('FIN-12 · el mes', () => {
  it('se nombra en español', () => {
    expect(nombreDelMes('2026-09')).toBe('Setiembre 2026')
    expect(nombreDelMes('2026-10')).toBe('Octubre 2026')
  })

  it('el mes actual es en hora de Costa Rica', () => {
    // A las 23:30 del 31 de octubre en CR todavía es octubre, aunque en UTC
    // ya sea 1 de noviembre.
    expect(mesActual(new Date('2026-11-01T05:30:00Z'))).toBe('2026-10')
    expect(mesActual(new Date('2026-11-01T06:30:00Z'))).toBe('2026-11')
  })

  it('valida la forma', () => {
    expect(esMesValido('2026-10')).toBe(true)
    expect(esMesValido('2026-13')).toBe(false)
    expect(esMesValido('octubre')).toBe(false)
  })
})
