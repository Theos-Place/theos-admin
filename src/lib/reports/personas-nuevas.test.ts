import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  resumenDeNuevos, filtrarNuevos, serieDelAnio, serieAnual, aniosDeLaSerie, SEMANAS_PARA_VOLVER,
  filtrarSerie, origenesDeCharla, serieAnualPorCanal,
  type PersonaNueva, type FilaDeSerie,
} from './personas-nuevas'
import { SEMANAS_DE_CORTE } from './abandonos'

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

describe('serieDelAnio', () => {
  it('siempre los 12 meses, también los que están en cero', () => {
    // Un hueco se leería como "sin dato", y cero es un dato.
    const s = serieDelAnio([{ anio: 2026, mes: 9, n: 5 }], 2026)
    expect(s).toHaveLength(12)
    expect(s.map(x => x.etiqueta)).toEqual(['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'])
    expect(s[8].n).toBe(5)
    expect(s[0].n).toBe(0)
  })

  it('ignora los otros años', () => {
    const s = serieDelAnio([{ anio: 2025, mes: 9, n: 9 }, { anio: 2026, mes: 9, n: 5 }], 2026)
    expect(s[8].n).toBe(5)
  })

  it('suma los canales del mismo mes', () => {
    const s = serieDelAnio([{ anio: 2026, mes: 3, n: 3 }, { anio: 2026, mes: 3, n: 4 }], 2026)
    expect(s[2].n).toBe(7)
  })

  it('usa "set" y no "sep", como el resto del sistema', () => {
    expect(serieDelAnio([], 2026)[8].etiqueta).toBe('set')
  })

  it('el periodo sirve para pedir el detalle del mes', () => {
    expect(serieDelAnio([], 2026)[0].periodo).toBe('2026-01')
  })
})

describe('aniosDeLaSerie', () => {
  it('del más nuevo al más viejo, sin repetir', () => {
    expect(aniosDeLaSerie([{ anio: 2024 }, { anio: 2026 }, { anio: 2024 }])).toEqual([2026, 2024])
  })

  it('corta antes de 2020', () => {
    expect(aniosDeLaSerie([{ anio: 2019 }, { anio: 2021 }])).toEqual([2021])
  })

  it('sin datos devuelve vacío', () => {
    expect(aniosDeLaSerie([])).toEqual([])
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

describe('SEMANAS_PARA_VOLVER', () => {
  it('es el MISMO corte que usa REP-5 para decir que alguien dejó de venir', () => {
    // Dos ventanas distintas para la misma idea obligan a recordar cuál aplica
    // en cuál pantalla, y los dos reportes se miran juntos.
    expect(SEMANAS_PARA_VOLVER).toBe(SEMANAS_DE_CORTE)
  })

  it('son 5 semanas, o sea los 35 días de la función SQL', () => {
    // SQL no puede importar la constante: si alguien cambia una sin la otra,
    // este test no lo pesca, pero deja escrito cuál es el número que debe estar
    // en `report_personas_nuevas`.
    expect(SEMANAS_PARA_VOLVER * 7).toBe(35)
  })
})

describe('REP-10 · un solo universo para gráficos y tabla', () => {
  const serie: FilaDeSerie[] = [
    { anio: 2026, mes: 1, canal: 'charla', origen: 'Cartago', n: 10 },
    { anio: 2026, mes: 1, canal: 'charla', origen: 'Madrid', n: 5 },
    { anio: 2026, mes: 2, canal: 'estudio', origen: 'Nivel 1', n: 3 },
    { anio: 2025, mes: 6, canal: 'evento', origen: 'Campa', n: 7 },
  ]

  it('filtrar por charla deja fuera al resto', () => {
    expect(filtrarSerie(serie, { origen: 'Cartago' }).reduce((n, x) => n + x.n, 0)).toBe(10)
  })

  it('el mismo filtro sirve para el gráfico mensual y el anual', () => {
    // Era el punto: antes el filtro solo llegaba a la tabla.
    const soloCartago = filtrarSerie(serie, { origen: 'Cartago' })
    expect(serieDelAnio(soloCartago, 2026)[0].n).toBe(10)
    expect(serieAnualPorCanal(soloCartago).reduce((n, x) => n + x.n, 0)).toBe(10)
  })

  it('el selector solo ofrece charlas, no estudios', () => {
    expect(origenesDeCharla(serie)).toEqual(['Cartago', 'Madrid'])
  })

  it('el apilado suma el total de la barra', () => {
    const b = serieAnualPorCanal(serie).find(x => x.etiqueta === '2026')!
    expect(b.charla + b.estudio + b.evento).toBe(b.n)
    expect(b.n).toBe(18)
  })

  it('un canal desconocido cuenta como charla y no desaparece del gráfico', () => {
    const raro = serieAnualPorCanal([{ anio: 2026, mes: 1, canal: 'vaya uno a saber', origen: null, n: 4 }])
    expect(raro[0].charla).toBe(4)
    expect(raro[0].n).toBe(4)
  })

  it('corta antes de 2020, igual que el gráfico anual', () => {
    expect(serieAnualPorCanal([{ anio: 2019, mes: 1, canal: 'charla', origen: null, n: 9 }])).toEqual([])
  })
})
