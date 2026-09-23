import { describe, it, expect } from 'vitest'
import { estudioMasReciente, type DirigenteGrupo } from './dirigentes'

describe('estudioMasReciente', () => {
  const g = (over: Partial<DirigenteGrupo>): DirigenteGrupo => ({
    plan_code: 'DIS1', plan_name: 'Discípulos 1', group_id: 'g', group_name: 'Grupo',
    students_count: 0, status: 'finalizado', date: null, ...over,
  })

  it('el que está EN CURSO gana, aunque uno finalizado sea posterior', () => {
    // La pregunta es qué hace hoy, no qué terminó último.
    const r = estudioMasReciente({
      estudios_activos: [g({ plan_code: 'DIS2', status: 'en_curso', date: '2026-01-01' })],
      estudios_completados: [g({ plan_code: 'DIS1', date: '2026-08-01' })],
    })
    expect(r?.plan_code).toBe('DIS2')
  })

  it('sin grupo en curso, el finalizado más reciente', () => {
    const r = estudioMasReciente({
      estudios_activos: [],
      estudios_completados: [g({ plan_code: 'VIEJO', date: '2024-01-01' }), g({ plan_code: 'NUEVO', date: '2026-05-01' })],
    })
    expect(r?.plan_code).toBe('NUEVO')
  })

  it('con varios en curso, el que empezó después', () => {
    const r = estudioMasReciente({
      estudios_activos: [g({ plan_code: 'A', status: 'en_curso', date: '2026-02-01' }), g({ plan_code: 'B', status: 'en_curso', date: '2026-07-01' })],
      estudios_completados: [],
    })
    expect(r?.plan_code).toBe('B')
  })

  it('sin nada devuelve null, y aguanta que no exista el dirigente', () => {
    expect(estudioMasReciente({ estudios_activos: [], estudios_completados: [] })).toBeNull()
    expect(estudioMasReciente(undefined)).toBeNull()
  })

  it('las fechas nulas no rompen el orden ni ganan', () => {
    const r = estudioMasReciente({
      estudios_activos: [],
      estudios_completados: [g({ plan_code: 'SIN_FECHA', date: null }), g({ plan_code: 'CON_FECHA', date: '2020-01-01' })],
    })
    expect(r?.plan_code).toBe('CON_FECHA')
  })
})
