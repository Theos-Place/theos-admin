import { describe, it, expect } from 'vitest'
import { saldosAFavor, totalPorMoneda, plata, type MatriculaConPagos } from './saldo-a-favor'

const f = (over: Partial<MatriculaConPagos>): MatriculaConPagos => ({
  enrollment_id: 'e1', member_id: 'm1', member_name: 'Ana', group_name: 'SCJ',
  costo: 5000, currency: 'CRC', pagado: 5000, ...over,
})

describe('saldosAFavor', () => {
  it('pagó de más: la diferencia queda a favor', () => {
    expect(saldosAFavor([f({ pagado: 20000, costo: 5000 })])[0].saldo).toBe(15000)
  })

  it('el caso del grupo gratis: todo lo pagado queda a favor', () => {
    expect(saldosAFavor([f({ pagado: 5000, costo: 0 })])[0].saldo).toBe(5000)
  })

  it('al día no aparece', () => {
    expect(saldosAFavor([f({ pagado: 5000, costo: 5000 })])).toEqual([])
  })

  it('quien DEBE no aparece: eso es un cobro pendiente, no un saldo', () => {
    expect(saldosAFavor([f({ pagado: 0, costo: 5000 })])).toEqual([])
  })

  it('de mayor a menor, que es como se atiende', () => {
    const r = saldosAFavor([
      f({ enrollment_id: 'a', pagado: 10000, costo: 5000 }),
      f({ enrollment_id: 'b', pagado: 25000, costo: 5000 }),
    ])
    expect(r.map(x => x.enrollment_id)).toEqual(['b', 'a'])
  })
})

describe('totalPorMoneda', () => {
  it('no suma colones con dólares', () => {
    const filas = saldosAFavor([
      f({ enrollment_id: 'a', pagado: 10000, costo: 5000 }),
      f({ enrollment_id: 'b', pagado: 100, costo: 0, currency: 'USD' }),
    ])
    expect(totalPorMoneda(filas)).toEqual([
      { currency: 'CRC', total: 5000 },
      { currency: 'USD', total: 100 },
    ])
  })

  it('sin saldos, sin totales', () => {
    expect(totalPorMoneda([])).toEqual([])
  })
})

describe('plata', () => {
  it('escribe los miles con punto, como en Costa Rica', () => {
    expect(plata(15000, 'CRC')).toBe('₡15.000')
    expect(plata(100, 'USD')).toBe('$100')
  })
})
