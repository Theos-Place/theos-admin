// BLQ-1 · Geometría del calendario anual de bloques.
import { describe, it, expect } from 'vitest'
import {
  daysInYear, dayOfYear, positionInYear, monthTicks, bloqueBar, availableYears,
  colorFor, ventanaBar, MESES_ES,
} from './bloque-calendar'

const BLOQUE = {
  id: 'b1',
  nombre: 'c3-26',
  anio: 2026,
  fecha_apertura: '2026-08-31',
  fecha_cierre_matricula: '2026-09-13',
}

describe('la línea del año', () => {
  it('cuenta bien los bisiestos', () => {
    expect(daysInYear(2026)).toBe(365)
    expect(daysInYear(2028)).toBe(366)
    expect(daysInYear(2000)).toBe(366)   // divisible por 400
    expect(daysInYear(1900)).toBe(365)   // divisible por 100, no por 400
  })

  it('el 1 de enero está al principio y el 31 de diciembre casi al final', () => {
    expect(positionInYear('2026-01-01', 2026)).toBe(0)
    expect(positionInYear('2026-12-31', 2026)).toBeGreaterThan(99)
    expect(positionInYear('2026-12-31', 2026)).toBeLessThan(100)
  })

  it('una fecha de otro año no se pinta', () => {
    expect(positionInYear('2025-12-31', 2026)).toBeNull()
    expect(positionInYear('2027-01-05', 2026)).toBeNull()
    expect(positionInYear('no es fecha', 2026)).toBeNull()
  })

  it('los 12 meses, en orden y crecientes', () => {
    const ticks = monthTicks(2026)
    expect(ticks).toHaveLength(12)
    expect(ticks.map(t => t.mes)).toEqual([...MESES_ES])
    expect(ticks[0].pct).toBe(0)
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i].pct).toBeGreaterThan(ticks[i - 1].pct)
    }
  })

  it('dayOfYear cuenta desde 0', () => {
    expect(dayOfYear('2026-01-01', 2026)).toBe(0)
    expect(dayOfYear('2026-02-01', 2026)).toBe(31)
  })
})

describe('la barra de un bloque', () => {
  const bar = bloqueBar(BLOQUE, 2026)!

  it('va del primer folleto al cierre de matrícula, no solo de los días abiertos', () => {
    // preliminar = apertura − 21 días = 2026-08-10; cierre = 2026-09-13.
    const inicio = positionInYear('2026-08-10', 2026)!
    expect(bar.leftPct).toBeCloseTo(inicio, 5)
    const fin = positionInYear('2026-09-13', 2026)!
    expect(bar.leftPct + bar.widthPct).toBeCloseTo(fin, 5)
  })

  it('trae los cuatro hitos, en orden cronológico', () => {
    expect(bar.hitos.map(h => h.key)).toEqual(['preliminar', 'confirmacion', 'apertura', 'final'])
    for (let i = 1; i < bar.hitos.length; i++) {
      expect(bar.hitos[i].pct).toBeGreaterThanOrEqual(bar.hitos[i - 1].pct)
    }
  })

  it('los hitos salen de la regla, no de una copia', () => {
    const porKey = Object.fromEntries(bar.hitos.map(h => [h.key, h.fecha]))
    expect(porKey.preliminar).toBe('2026-08-10')      // apertura − 21
    expect(porKey.confirmacion).toBe('2026-08-17')    // apertura − 14
    expect(porKey.apertura).toBe('2026-08-31')
    expect(porKey.final).toBe('2026-09-13')
  })

  it('un bloque de otro año no se pinta', () => {
    expect(bloqueBar(BLOQUE, 2025)).toBeNull()
    expect(bloqueBar(BLOQUE, 2027)).toBeNull()
  })

  it('un bloque a caballo entre dos años se recorta y se marca', () => {
    const cruzado = { ...BLOQUE, fecha_apertura: '2027-01-10', fecha_cierre_matricula: '2027-01-30' }
    // preliminar = 2026-12-20 → en 2026 empieza y se corta al final.
    const en2026 = bloqueBar(cruzado, 2026)!
    expect(en2026.cortadoAlFinal).toBe(true)
    expect(en2026.leftPct + en2026.widthPct).toBeCloseTo(100, 5)

    const en2027 = bloqueBar(cruzado, 2027)!
    expect(en2027.cortadoAlInicio).toBe(true)
    expect(en2027.leftPct).toBe(0)
  })

  it('un bloque cortísimo igual se ve (ancho mínimo)', () => {
    const cortito = { ...BLOQUE, fecha_apertura: '2026-05-02', fecha_cierre_matricula: '2026-05-02' }
    const b = bloqueBar(cortito, 2026)!
    expect(b.widthPct).toBeGreaterThan(0)
  })
})

describe('selector de año', () => {
  it('ofrece los años con bloques más el actual, del más nuevo al más viejo', () => {
    expect(availableYears([{ anio: 2025 }, { anio: 2026 }, { anio: 2025 }], 2026))
      .toEqual([2026, 2025])
    expect(availableYears([], 2026)).toEqual([2026])
    expect(availableYears([{ anio: 2027 }], 2026)).toEqual([2027, 2026])
  })
})

describe('colores', () => {
  it('se repiten en ciclo y son estables', () => {
    expect(colorFor(0)).toBe(colorFor(4))
    expect(colorFor(1)).not.toBe(colorFor(0))
  })
})

describe('ventanas de matrícula de los grupos (GRU-1)', () => {
  it('se ubican sobre el mismo año', () => {
    const v = ventanaBar({ id: 'g', nombre: 'N1', desde: '2026-07-29', hasta: '2026-10-04' }, 2026)!
    expect(v.leftPct).toBeCloseTo(positionInYear('2026-07-29', 2026)!, 5)
    expect(v.leftPct + v.widthPct).toBeCloseTo(positionInYear('2026-10-04', 2026)!, 5)
  })

  it('una ventana de otro año no se pinta', () => {
    expect(ventanaBar({ id: 'g', nombre: 'N1', desde: '2025-01-01', hasta: '2025-03-01' }, 2026)).toBeNull()
  })
})
