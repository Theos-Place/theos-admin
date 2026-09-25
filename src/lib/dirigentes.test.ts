import { describe, it, expect } from 'vitest'
import { buildDirigentes, estudioMasReciente, type DirigenteGrupo } from './dirigentes'

describe('estudioMasReciente', () => {
  const g = (over: Partial<DirigenteGrupo>): DirigenteGrupo => ({
    plan_code: 'DIS1', plan_name: 'Discípulos 1', group_id: 'g', group_name: 'Grupo',
    students_count: 0, status: 'finalizado', date: null, zone: null, ...over,
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

/**
 * La zona de un grupo sale del CAMPO `zone`, nunca de su nombre.
 *
 * Por convención los grupos se llaman «SCJ — Este SJ», con la zona escrita a
 * mano, y cuando el grupo se muda nadie lo renombra. El caso que lo destapó
 * (reportado por Floriana el 2026-09-24): el grupo de Stanley Benavides se
 * llamaba «SCJ — Este SJ» con `zone = la-sabana` y ubicación en Pavas, y la
 * pantalla de dirigentes mostraba el nombre. Al medirlo había 7 grupos activos
 * así, y en 6 la ubicación le daba la razón al campo, no al nombre.
 */
describe('buildDirigentes · la zona viene del campo, no del nombre', () => {
  const grupo = (over: Record<string, unknown>) => ({
    id: 'g1', name: 'SCJ — Este SJ', study_type_id: 'SCJ', status: 'en_curso',
    leader_id: 'm1', leader_name: 'Stanley Benavides', co_leader_id: null, co_leader_name: null,
    zone: 'la-sabana', participants: [], start_date: '2026-10-01', end_date: null,
    ...over,
  }) as unknown as Parameters<typeof buildDirigentes>[0][number]

  it('lleva el código de zona aunque el nombre diga otra cosa', () => {
    const [d] = buildDirigentes([grupo({})], [], [], [])
    expect(d.estudios_activos[0].group_name).toBe('SCJ — Este SJ')
    expect(d.estudios_activos[0].zone).toBe('la-sabana')
  })

  it('sin zona queda en null y no en cadena vacía', () => {
    // El adapter pone '' cuando la columna es NULL; que llegue como null deja
    // que la pantalla decida con un simple `if` en vez de comparar contra ''.
    const [d] = buildDirigentes([grupo({ zone: '' })], [], [], [])
    expect(d.estudios_activos[0].zone).toBeNull()
  })

  it('el co-dirigente ve la misma zona que el dirigente', () => {
    const [a, b] = buildDirigentes(
      [grupo({ co_leader_id: 'm2', co_leader_name: 'Cinthya Ramos' })], [], [], [],
    ).sort((x, y) => x.member_id.localeCompare(y.member_id))
    expect(a.estudios_activos[0].zone).toBe('la-sabana')
    expect(b.estudios_activos[0].zone).toBe('la-sabana')
  })
})
