import { describe, it, expect } from 'vitest'
import { unirSeries, type PuntoSemanal } from './comparar-series'

const p = (week: number, total: number, partial = false): PuntoSemanal => ({ week, total, partial })

describe('unirSeries', () => {
  it('junta las dos series por semana', () => {
    expect(unirSeries([p(1, 10), p(2, 20)], [p(1, 5), p(2, 7)])).toEqual([
      { week: 1, total: 10, partial: false, comparado: 5 },
      { week: 2, total: 20, partial: false, comparado: 7 },
    ])
  })

  it('EL CASO DE USO: la comparada arranca tarde y el "antes" se conserva', () => {
    // Meridiano Miércoles abre en la semana 3; las semanas 1 y 2 de Martes son
    // justamente el antes que se quiere ver.
    const r = unirSeries([p(1, 100), p(2, 90), p(3, 60)], [p(3, 40)])
    expect(r.map(x => x.comparado)).toEqual([null, null, 40])
    expect(r.map(x => x.total)).toEqual([100, 90, 60])
  })

  it('las semanas que solo tiene la comparada también entran, con total null', () => {
    // Una sede que abre cuando la otra ya cerró. El total va en null y NO en 0:
    // Recharts no dibuja la barra, mientras que un 0 se leería como "vinieron
    // cero esa semana", que es distinto de "esa semana no existe para esta sede".
    const r = unirSeries([p(1, 10)], [p(2, 5)])
    expect(r).toEqual([
      { week: 1, total: 10, partial: false, comparado: null },
      { week: 2, total: null, partial: false, comparado: 5 },
    ])
  })

  it('sin dato es null y NO cero', () => {
    // Recharts corta la línea en null, que es lo honesto. Un 0 dibujaría una
    // caída a cero que nunca pasó.
    expect(unirSeries([p(1, 10), p(2, 20)], [p(1, 5)])[1].comparado).toBeNull()
  })

  it('las semanas salen ordenadas aunque lleguen desordenadas', () => {
    expect(unirSeries([p(3, 1), p(1, 1)], [p(2, 1)]).map(x => x.week)).toEqual([1, 2, 3])
  })

  it('conserva la marca de semana parcial de la principal', () => {
    // Es la que pinta la barra en tono claro; perderla haría leer un feriado
    // como una caída real.
    expect(unirSeries([p(1, 10, true)], [])[0].partial).toBe(true)
  })

  it('sin comparada, es la serie principal con comparado en null', () => {
    expect(unirSeries([p(1, 10)], [])).toEqual([{ week: 1, total: 10, partial: false, comparado: null }])
  })

  it('dos series vacías no rompen', () => {
    expect(unirSeries([], [])).toEqual([])
  })
})
