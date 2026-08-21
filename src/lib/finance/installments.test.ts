import { describe, it, expect } from 'vitest'
import {
  splitAmount, monthlyDueDates, planInstallments, isOverdue, overdueBlockMessage,
} from './installments'

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

describe('splitAmount', () => {
  // La condición que pide la spec: los tractos SUMAN el total.
  it('reparte parejo cuando divide exacto', () => {
    expect(splitAmount(15000, 3, 'CRC')).toEqual([5000, 5000, 5000])
  })

  it('cuando no divide exacto, la suma sigue dando el total', () => {
    const t = splitAmount(10000, 3, 'CRC')
    expect(t).toEqual([3334, 3333, 3333])
    expect(sum(t)).toBe(10000)
  })

  it('el sobrante va a los primeros tractos', () => {
    const t = splitAmount(100, 3, 'CRC')
    expect(t).toEqual([34, 33, 33])
    expect(sum(t)).toBe(100)
  })

  it('respeta los céntimos en monedas con decimales', () => {
    const t = splitAmount(100, 3, 'EUR')
    expect(t).toEqual([33.34, 33.33, 33.33])
    expect(sum(t)).toBeCloseTo(100, 10)
  })

  it('un solo tracto es el total', () => {
    expect(splitAmount(7500, 1, 'CRC')).toEqual([7500])
  })

  it('cierra la suma en muchos tractos y montos feos', () => {
    for (const [total, count, cur] of [
      [12345, 7, 'CRC'], [99999, 24, 'CRC'], [10, 3, 'CRC'], [0.1, 3, 'EUR'],
    ] as Array<[number, number, string]>) {
      const t = splitAmount(total, count, cur)
      expect(t).toHaveLength(count)
      expect(sum(t)).toBeCloseTo(total, 10)
    }
  })

  it('rechaza parámetros inválidos', () => {
    expect(splitAmount(0, 3)).toEqual([])
    expect(splitAmount(-100, 3)).toEqual([])
    expect(splitAmount(1000, 0)).toEqual([])
    expect(splitAmount(1000, 2.5)).toEqual([])
    // Menos plata que tractos: no se puede repartir en colones.
    expect(splitAmount(2, 3, 'CRC')).toEqual([])
  })
})

describe('monthlyDueDates', () => {
  it('avanza un mes por tracto', () => {
    expect(monthlyDueDates('2026-09-15', 3)).toEqual(['2026-09-15', '2026-10-15', '2026-11-15'])
  })

  it('cruza el fin de año', () => {
    expect(monthlyDueDates('2026-11-10', 4)).toEqual(['2026-11-10', '2026-12-10', '2027-01-10', '2027-02-10'])
  })

  // El bug clásico de setMonth: 31 de enero + 1 mes daría 3 de marzo.
  it('el día que no existe cae al último del mes, sin correr el calendario', () => {
    expect(monthlyDueDates('2026-01-31', 4)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
  })

  it('rechaza formatos inválidos', () => {
    expect(monthlyDueDates('15/09/2026', 3)).toEqual([])
    expect(monthlyDueDates('', 3)).toEqual([])
    expect(monthlyDueDates('2026-09-15', 0)).toEqual([])
  })
})

describe('planInstallments', () => {
  it('arma número, monto y vencimiento, y la suma cierra', () => {
    const p = planInstallments({ total: 10000, count: 3, firstDue: '2026-09-01', currency: 'CRC' })
    expect(p).toEqual([
      { number: 1, amount: 3334, due_date: '2026-09-01' },
      { number: 2, amount: 3333, due_date: '2026-10-01' },
      { number: 3, amount: 3333, due_date: '2026-11-01' },
    ])
    expect(sum(p.map(x => x.amount))).toBe(10000)
  })

  it('devuelve vacío si algo no cuadra', () => {
    expect(planInstallments({ total: 0, count: 3, firstDue: '2026-09-01' })).toEqual([])
    expect(planInstallments({ total: 10000, count: 3, firstDue: 'nope' })).toEqual([])
  })
})

describe('isOverdue', () => {
  const HOY = '2026-08-21'

  it('un tracto con vencimiento pasado e impago está vencido', () => {
    expect(isOverdue({ due_date: '2026-08-20', status: 'pending' }, HOY)).toBe(true)
  })

  // La otra mitad de la regla: un tracto futuro al día NO bloquea.
  it('un tracto futuro no está vencido', () => {
    expect(isOverdue({ due_date: '2026-09-01', status: 'pending' }, HOY)).toBe(false)
  })

  it('el que vence HOY todavía no está vencido', () => {
    expect(isOverdue({ due_date: HOY, status: 'pending' }, HOY)).toBe(false)
  })

  it('un tracto ya pagado no bloquea, aunque venciera antes', () => {
    expect(isOverdue({ due_date: '2026-01-01', status: 'paid' }, HOY)).toBe(false)
  })

  it('sin vencimiento no bloquea', () => {
    expect(isOverdue({ due_date: null, status: 'pending' }, HOY)).toBe(false)
  })
})

describe('overdueBlockMessage', () => {
  it('sin tractos vencidos no hay mensaje', () => {
    expect(overdueBlockMessage([])).toBe('')
  })

  it('dice cuántos, cuánto y desde cuándo', () => {
    const msg = overdueBlockMessage([
      { amount: 5000, currency: 'CRC', due_date: '2026-07-15' },
      { amount: 3000, currency: 'CRC', due_date: '2026-08-15' },
    ])
    expect(msg).toContain('2 tractos vencidos')
    expect(msg).toContain('8')           // 5000 + 3000 = 8 000
    expect(msg).toContain('2026')        // fecha del más antiguo
    expect(msg).toMatch(/^Tenés/)
  })

  it('singular con un solo tracto', () => {
    const msg = overdueBlockMessage([{ amount: 5000, currency: 'CRC', due_date: '2026-07-15' }])
    expect(msg).toContain('1 tracto vencido')
    expect(msg).not.toContain('tractos')
  })

  it('en tercera persona cuando lo ve el staff', () => {
    const msg = overdueBlockMessage([{ amount: 5000, currency: 'CRC', due_date: '2026-07-15' }], 'other')
    expect(msg).toMatch(/^Esta persona tiene/)
  })

  // Sumar ₡ con € en un solo total sería mentira: se reportan por separado.
  it('no mezcla monedas en un total único', () => {
    const msg = overdueBlockMessage([
      { amount: 5000, currency: 'CRC', due_date: '2026-07-15' },
      { amount: 20, currency: 'EUR', due_date: '2026-08-15' },
    ])
    expect(msg).toContain('+')
  })
})
