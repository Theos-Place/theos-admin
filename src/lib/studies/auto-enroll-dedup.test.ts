import { describe, it, expect } from 'vitest'
import { decidirMatricula, repartirParaMatricula, ESTADOS_ACTIVOS, ESTADOS_A_CONSULTAR } from './auto-enroll-dedup'

describe('decidirMatricula', () => {
  it('quien no tiene nada se matricula normal', () => {
    expect(decidirMatricula({ yaActivo: false, yaAprobado: false }))
      .toEqual({ accion: 'matricular', repite: false })
  })

  it('quien ya está adentro se salta: sería un duplicado', () => {
    expect(decidirMatricula({ yaActivo: true, yaAprobado: false }))
      .toEqual({ accion: 'saltar', motivo: 'ya_matriculado' })
  })

  it('quien ya lo aprobó SÍ se matricula: está repitiendo', () => {
    // El caso de Jessica Sibaja: aprobó el N3 de nuevo teniendo el N4 de 2022.
    const d = decidirMatricula({ yaActivo: false, yaAprobado: true })
    expect(d.accion).toBe('matricular')
    expect(d).toMatchObject({ repite: true })
    if (d.accion === 'matricular' && d.repite) expect(d.nota).toContain('Repite el nivel')
  })

  it('estar adentro manda sobre haberlo aprobado', () => {
    // Ya lo aprobó antes Y ya está matriculado otra vez: no se duplica.
    expect(decidirMatricula({ yaActivo: true, yaAprobado: true }))
      .toEqual({ accion: 'saltar', motivo: 'ya_matriculado' })
  })
})

describe('repartirParaMatricula', () => {
  it('reparte los tres casos de un lote', () => {
    const r = repartirParaMatricula(
      ['nuevo', 'repite', 'yaAdentro'],
      new Set(['yaAdentro']),
      new Set(['repite']),
    )
    expect(r.saltados).toEqual(['yaAdentro'])
    expect(r.matricular).toEqual([
      { memberId: 'nuevo', nota: null },
      { memberId: 'repite', nota: 'Repite el nivel: ya lo tenía aprobado de antes' },
    ])
  })

  it('el cierre real: 6 nuevos y 1 que repite, ninguno saltado', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'jessica']
    const r = repartirParaMatricula(ids, new Set(), new Set(['jessica']))
    expect(r.matricular).toHaveLength(7)
    expect(r.saltados).toEqual([])
    expect(r.matricular.filter(m => m.nota).map(m => m.memberId)).toEqual(['jessica'])
  })

  it('conserva el orden del lote', () => {
    const r = repartirParaMatricula(['z', 'a', 'm'], new Set(), new Set())
    expect(r.matricular.map(m => m.memberId)).toEqual(['z', 'a', 'm'])
  })

  it('lote vacío no revienta', () => {
    expect(repartirParaMatricula([], new Set(), new Set())).toEqual({ matricular: [], saltados: [] })
  })
})

describe('los estados que se consultan', () => {
  it('"activo" NO incluye completed: eso es haberlo aprobado, no estar adentro', () => {
    expect(ESTADOS_ACTIVOS).not.toContain('completed')
    expect(ESTADOS_ACTIVOS).toEqual(['enrolled', 'pendiente_de_pago', 'waitlist'])
  })

  it('se consultan los activos MÁS completed: hay que saber si repite', () => {
    expect(ESTADOS_A_CONSULTAR).toContain('completed')
    for (const s of ESTADOS_ACTIVOS) expect(ESTADOS_A_CONSULTAR).toContain(s)
  })
})
