import { describe, it, expect } from 'vitest'
import {
  splitAmount, monthlyDueDates, planInstallments, isOverdue, overdueBlockMessage, financeOverdueSummary, biweeklyDueDates, dueDates,
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

describe('financeOverdueSummary', () => {
  it('cuenta personas y tractos, y suma el total', () => {
    const r = financeOverdueSummary([
      { member_id: 'a', amount: 5000, currency: 'CRC' },
      { member_id: 'a', amount: 3000, currency: 'CRC' },
      { member_id: 'b', amount: 2000, currency: 'CRC' },
    ])
    // 2 personas (a aparece dos veces), 3 tractos.
    expect(r.members).toBe(2)
    expect(r.installments).toBe(3)
    expect(r.totals).toContain('10')   // 5000+3000+2000 = 10 000
  })

  it('sin tractos vencidos queda en cero', () => {
    const r = financeOverdueSummary([])
    expect(r.members).toBe(0)
    expect(r.installments).toBe(0)
    expect(r.totals).toBe('')
  })

  it('no mezcla monedas en un total único', () => {
    const r = financeOverdueSummary([
      { member_id: 'a', amount: 5000, currency: 'CRC' },
      { member_id: 'b', amount: 20, currency: 'EUR' },
    ])
    expect(r.totals).toContain('+')
    expect(r.members).toBe(2)
  })
})

// ── FIN-8 · frecuencia quincenal ────────────────────────────────────────────
describe('biweeklyDueDates', () => {
  it('cada 15 días exactos desde el primero', () => {
    expect(biweeklyDueDates('2026-01-05', 4))
      .toEqual(['2026-01-05', '2026-01-20', '2026-02-04', '2026-02-19'])
  })

  it('cruza el fin de mes sin corrimientos', () => {
    // Del 25 de enero: +15 = 9 de febrero, +30 = 24 de febrero.
    expect(biweeklyDueDates('2026-01-25', 3))
      .toEqual(['2026-01-25', '2026-02-09', '2026-02-24'])
  })

  it('cruza el fin de AÑO', () => {
    expect(biweeklyDueDates('2026-12-20', 3))
      .toEqual(['2026-12-20', '2027-01-04', '2027-01-19'])
  })

  it('aguanta el tope de 24 tractos sin desviarse', () => {
    const d = biweeklyDueDates('2026-03-01', 24)
    expect(d).toHaveLength(24)
    // El último es exactamente 23 quincenas después: 345 días.
    const dias = (Date.parse(d[23]) - Date.parse(d[0])) / 86400000
    expect(dias).toBe(23 * 15)
  })

  it('el intervalo es SIEMPRE de 15 días, nunca 14 ni 16', () => {
    // La otra lectura de "quincenal" —los días 15 y 30— da saltos desiguales.
    // Esta no: el test lo fija para que nadie la cambie sin darse cuenta.
    const d = biweeklyDueDates('2026-01-31', 12)
    for (let i = 1; i < d.length; i++) {
      expect((Date.parse(d[i]) - Date.parse(d[i - 1])) / 86400000, `tracto ${i}`).toBe(15)
    }
  })

  it('febrero no lo descuadra (año bisiesto incluido)', () => {
    expect(biweeklyDueDates('2028-02-20', 2)).toEqual(['2028-02-20', '2028-03-06'])
  })

  it('rechaza lo inválido igual que la mensual', () => {
    expect(biweeklyDueDates('no-es-fecha', 3)).toEqual([])
    expect(biweeklyDueDates('2026-01-05', 0)).toEqual([])
    expect(biweeklyDueDates('2026-01-05', 1.5)).toEqual([])
  })
})

describe('planInstallments con frecuencia', () => {
  it('sin frecuencia sigue siendo MENSUAL — no se rompe quien ya llamaba', () => {
    const sinNada = planInstallments({ total: 30000, count: 3, firstDue: '2026-01-10' })
    const explicito = planInstallments({ total: 30000, count: 3, firstDue: '2026-01-10', frequency: 'mensual' })
    expect(sinNada).toEqual(explicito)
    expect(sinNada.map(t => t.due_date)).toEqual(['2026-01-10', '2026-02-10', '2026-03-10'])
  })

  it('quincenal reparte los mismos montos en otras fechas', () => {
    const mensual = planInstallments({ total: 30000, count: 3, firstDue: '2026-01-10' })
    const quincenal = planInstallments({ total: 30000, count: 3, firstDue: '2026-01-10', frequency: 'quincenal' })
    expect(quincenal.map(t => t.amount)).toEqual(mensual.map(t => t.amount))
    expect(quincenal.map(t => t.due_date)).toEqual(['2026-01-10', '2026-01-25', '2026-02-09'])
  })

  it('la suma sigue dando el total exacto con cualquier frecuencia', () => {
    for (const frequency of ['mensual', 'quincenal'] as const) {
      const t = planInstallments({ total: 100000, count: 7, firstDue: '2026-05-31', frequency })
      expect(t.reduce((a, x) => a + x.amount, 0), frequency).toBe(100000)
    }
  })
})

describe('lo que consume los vencimientos no sabe de frecuencias', () => {
  // FIN-8 pedía revisar que nada asumiera "un tracto por mes". No lo asume
  // nadie: isOverdue y el resumen comparan FECHAS, no cuentan meses. Este test
  // lo fija, porque el día que alguien meta aritmética de meses acá los
  // arreglos quincenales se romperían en silencio.
  it('isOverdue solo mira si la fecha ya pasó', () => {
    const hoy = '2026-03-10'
    // Dos tractos quincenales consecutivos: uno vencido, el otro no.
    const [a, b] = biweeklyDueDates('2026-03-01', 2)   // 01-mar y 16-mar
    expect(isOverdue({ due_date: a, status: 'pending' }, hoy)).toBe(true)
    expect(isOverdue({ due_date: b, status: 'pending' }, hoy)).toBe(false)
  })

  it('un tracto ya pagado nunca está vencido, sea de la frecuencia que sea', () => {
    for (const f of ['mensual', 'quincenal'] as const) {
      const [d] = dueDates('2020-01-01', 1, f)
      expect(isOverdue({ due_date: d, status: 'paid' }, '2026-03-10'), f).toBe(false)
    }
  })
})
