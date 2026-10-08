import { describe, it, expect } from 'vitest'
import {
  esFuenteDinamica, etiquetaDeTaller, talleresQueSeOfrecen, FUENTES_DINAMICAS,
  MESES_HACIA_ATRAS,
} from './fuentes-dinamicas'

const HOY = new Date('2026-10-08T12:00:00-06:00')

describe('las fuentes válidas', () => {
  it('la vieja sigue, y la de talleres se suma', () => {
    expect(FUENTES_DINAMICAS).toContain('study_groups_open')
    expect(FUENTES_DINAMICAS).toContain('talleres')
  })

  it('cualquier otra cosa no es una fuente', () => {
    for (const v of ['eventos', '', null, undefined, 'TALLERES']) {
      expect(esFuenteDinamica(v as string), String(v)).toBe(false)
    }
  })
})

describe('la etiqueta de un taller', () => {
  it('lleva la FECHA, porque el mismo taller se repite', () => {
    /**
     * Sin fecha, quien contesta la encuesta de octubre elige la misma opción
     * que la de agosto y los resultados quedan mezclados sin forma de
     * separarlos.
     */
    expect(etiquetaDeTaller({ title: 'Entre Mujeres', starts_at: '2026-08-22T20:30:00Z' }))
      .toBe('Entre Mujeres · 22 ago 2026')
  })

  it('la fecha se arma en hora de COSTA RICA', () => {
    /**
     * Un taller de las 7 p.m. del 16 de octubre es la 1 a.m. del 17 en UTC.
     * Es el mismo corrimiento que ya mordió tres veces en este repo.
     */
    expect(etiquetaDeTaller({ title: 'Taller', starts_at: '2026-10-17T01:00:00Z' }))
      .toContain('16 oct')
  })

  it('sin fecha, va el nombre solo y no un «Invalid Date»', () => {
    expect(etiquetaDeTaller({ title: 'Taller', starts_at: null })).toBe('Taller')
  })
})

describe('qué talleres se ofrecen', () => {
  const T = (title: string, starts_at: string | null) => ({ title, starts_at })

  it('el más reciente va ARRIBA: la encuesta se llena justo después', () => {
    const o = talleresQueSeOfrecen([
      T('Viejo', '2026-02-01T15:00:00Z'),
      T('Nuevo', '2026-10-01T15:00:00Z'),
      T('Medio', '2026-06-01T15:00:00Z'),
    ], HOY)
    expect(o[0]).toContain('Nuevo')
    expect(o[2]).toContain('Viejo')
  })

  it(`recorta los de más de ${MESES_HACIA_ATRAS} meses`, () => {
    // Nadie contesta la retroalimentación de un taller de hace dos años.
    const o = talleresQueSeOfrecen([
      T('Antiguo', '2024-01-01T15:00:00Z'),
      T('Reciente', '2026-09-01T15:00:00Z'),
    ], HOY)
    expect(o).toHaveLength(1)
    expect(o[0]).toContain('Reciente')
  })

  it('un taller SIN fecha se conserva: no se puede afirmar que sea viejo', () => {
    const o = talleresQueSeOfrecen([T('Sin fecha', null)], HOY)
    expect(o).toEqual(['Sin fecha'])
  })

  it('los que todavía no pasaron también entran', () => {
    // La encuesta se prepara antes del taller.
    const o = talleresQueSeOfrecen([T('Futuro', '2026-12-01T15:00:00Z')], HOY)
    expect(o[0]).toContain('Futuro')
  })

  it('un título vacío no genera una opción en blanco', () => {
    expect(talleresQueSeOfrecen([T('  ', '2026-09-01T15:00:00Z')], HOY)).toEqual([])
  })

  it('sin talleres devuelve lista vacía, no revienta', () => {
    expect(talleresQueSeOfrecen([], HOY)).toEqual([])
  })
})
