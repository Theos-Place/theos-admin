import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  resumenDeNuevos, filtrarNuevos, serieMensual, serieAnual, type PersonaNueva,
} from './personas-nuevas'

// La edad se calcula contra "hoy", así que hoy se fija.
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-21T12:00:00Z')) })
afterEach(() => { vi.useRealTimers() })

const p = (x: Partial<PersonaNueva> & { member_id: string }): PersonaNueva => ({
  nombre: x.member_id, birth_date: null, phone: null, fecha: '2026-08-10',
  canal: 'charla', origen: 'Charla Cartago', volvio: false, seMatriculo: false,
  esServidor: false, ...x,
})

describe('resumenDeNuevos', () => {
  it('quien no tiene fecha de nacimiento NO entra al promedio', () => {
    // Contarlo como 0 años hundiría el promedio y nadie sabría por qué.
    const r = resumenDeNuevos([
      p({ member_id: 'a', birth_date: '1996-09-21' }), // 30
      p({ member_id: 'b', birth_date: '2006-09-21' }), // 20
      p({ member_id: 'c' }),
    ])
    expect(r.edadPromedio).toBe(25)
    expect(r.sinEdad).toBe(1)
    expect(r.total).toBe(3)
  })

  it('si nadie tiene fecha, la edad es null y no 0', () => {
    const r = resumenDeNuevos([p({ member_id: 'a' })])
    expect(r.edadPromedio).toBeNull()
    expect(r.edadMediana).toBeNull()
  })

  it('la mediana con cantidad par promedia las dos del medio', () => {
    const r = resumenDeNuevos([
      p({ member_id: 'a', birth_date: '2006-09-21' }), // 20
      p({ member_id: 'b', birth_date: '1996-09-21' }), // 30
    ])
    expect(r.edadMediana).toBe(25)
  })

  it('cuenta retención y la reporta en porcentaje', () => {
    const r = resumenDeNuevos([
      p({ member_id: 'a', volvio: true }),
      p({ member_id: 'b', volvio: true, seMatriculo: true }),
      p({ member_id: 'c' }),
      p({ member_id: 'd' }),
    ])
    expect(r.volvieron).toBe(2)
    expect(r.pctVolvieron).toBe(50)
    expect(r.pctSeMatricularon).toBe(25)
  })

  it('sin nadie, los porcentajes son null y no 0%', () => {
    const r = resumenDeNuevos([])
    expect(r.total).toBe(0)
    expect(r.pctVolvieron).toBeNull()
    expect(r.porCanal).toEqual([])
  })

  it('el desglose por canal deja fuera los canales sin nadie', () => {
    const r = resumenDeNuevos([p({ member_id: 'a' }), p({ member_id: 'b', canal: 'estudio' })])
    expect(r.porCanal).toEqual([{ canal: 'charla', n: 1 }, { canal: 'estudio', n: 1 }])
  })
})

describe('filtrarNuevos', () => {
  const gente = [
    p({ member_id: 'joven', birth_date: '2006-09-21', esServidor: true }),   // 20
    p({ member_id: 'mayor', birth_date: '1976-09-21', canal: 'estudio', origen: 'Discípulos 1' }), // 50
    p({ member_id: 'sinfecha' }),
  ]

  it('sin fecha de nacimiento queda FUERA de un filtro de edad', () => {
    // No se puede afirmar que tenga entre 18 y 30 si no se sabe.
    expect(filtrarNuevos(gente, { edadMin: 18, edadMax: 30 }).map(x => x.member_id)).toEqual(['joven'])
  })

  it('sin filtro de edad, quien no tiene fecha sigue en la lista', () => {
    expect(filtrarNuevos(gente, {}).length).toBe(3)
  })

  it('filtra por canal y por origen', () => {
    expect(filtrarNuevos(gente, { canal: 'estudio' }).map(x => x.member_id)).toEqual(['mayor'])
    expect(filtrarNuevos(gente, { origen: 'Discípulos 1' }).map(x => x.member_id)).toEqual(['mayor'])
  })

  it('servidor false filtra a los que NO lo son, no desactiva el filtro', () => {
    expect(filtrarNuevos(gente, { servidor: false }).map(x => x.member_id)).toEqual(['mayor', 'sinfecha'])
    expect(filtrarNuevos(gente, { servidor: true }).map(x => x.member_id)).toEqual(['joven'])
    expect(filtrarNuevos(gente, { servidor: null }).length).toBe(3)
  })
})

describe('serieMensual', () => {
  it('incluye los meses en cero: un hueco se leería como "sin dato"', () => {
    const s = serieMensual([{ anio: 2026, mes: 9, n: 5 }], new Date(Date.UTC(2026, 8, 21)), 3)
    expect(s.map(x => x.periodo)).toEqual(['2026-07', '2026-08', '2026-09'])
    expect(s.map(x => x.n)).toEqual([0, 0, 5])
  })

  it('cruza el fin de año hacia atrás', () => {
    const s = serieMensual([], new Date(Date.UTC(2026, 0, 15)), 3)
    expect(s.map(x => x.periodo)).toEqual(['2025-11', '2025-12', '2026-01'])
  })

  it('suma los canales del mismo mes', () => {
    const s = serieMensual(
      [{ anio: 2026, mes: 9, n: 3 }, { anio: 2026, mes: 9, n: 4 }],
      new Date(Date.UTC(2026, 8, 21)), 1,
    )
    expect(s[0].n).toBe(7)
  })
})

describe('serieAnual', () => {
  it('ordena de menor a mayor y corta antes de 2020', () => {
    const s = serieAnual([{ anio: 2026, n: 3 }, { anio: 2019, n: 9 }, { anio: 2021, n: 5 }])
    expect(s.map(x => x.etiqueta)).toEqual(['2021', '2026'])
  })

  it('suma los meses de un mismo año', () => {
    expect(serieAnual([{ anio: 2026, n: 3 }, { anio: 2026, n: 4 }])[0].n).toBe(7)
  })
})
