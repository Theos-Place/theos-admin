import { describe, it, expect } from 'vitest'
import { buildCharlaReport, type CharlaAggRow } from './charla-attendance'

describe('año calendario contra año ISO', () => {
  // El 3 de enero de 2021 cae en la semana 53 de 2020: 13 check-ins reales de
  // la base salían como "semana 53 de 2021", y 2021 no tiene semana 53.
  const filas: CharlaAggRow[] = [
    { yr: 2026, iso_yr: 2026, title: 'Charla Meridiano Martes', wk: 52, mo: 12, checkins: 100 },
    { yr: 2026, iso_yr: 2026, title: 'Charla Meridiano Martes', wk: 53, mo: 12, checkins: 80 },
    // Enero de 2027 que pertenece a la semana 53 de 2026.
    { yr: 2027, iso_yr: 2026, title: 'Charla Meridiano Martes', wk: 53, mo: 1, checkins: 13 },
    { yr: 2027, iso_yr: 2027, title: 'Charla Meridiano Martes', wk: 1, mo: 1, checkins: 50 },
  ]

  it('la serie semanal de 2026 incluye los días de enero de 2027 de esa semana', () => {
    const r = buildCharlaReport(filas, { year: 2026 })
    expect(r.weekly.find(w => w.week === 53)?.total).toBe(93)
  })

  it('2027 no hereda una semana 53 que no le toca', () => {
    const r = buildCharlaReport(filas, { year: 2027 })
    expect(r.weekly.map(w => w.week)).toEqual([1])
  })

  it('el TOTAL del año sigue siendo calendario: enero de 2027 cuenta en 2027', () => {
    // Un total anual que se corriera con el calendario ISO no cuadraría con
    // finanzas ni con nada que la gente cuente de enero a diciembre.
    const cards = buildCharlaReport(filas, { year: 2026 }).annualCards
    expect(cards.find(c => c.year === 2026)?.total).toBe(180)
    expect(cards.find(c => c.year === 2027)?.total).toBe(63)
  })
})
