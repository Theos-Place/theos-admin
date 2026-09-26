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

/**
 * «Inactivo» al lado de un grupo en curso, en la misma fila.
 *
 * Lo vio Floriana en staging el 2026-09-25 y no es un dato malo: es que el
 * estado salía SOLO de estar en el comité, ignorando el inciso (a) de PAR-2
 * («dirige o co-dirige un grupo en curso o en matrícula»). Basta con asignarle
 * un grupo a alguien que todavía no está en el comité —un caso normal— para
 * que la pantalla se contradiga a sí misma.
 *
 * Producción estaba consistente el mismo día (114 dando, los 114 en el comité)
 * porque nada lo había roto todavía, no porque algo lo impidiera.
 */
describe('buildDirigentes · nadie puede estar «inactivo dando ahora»', () => {
  const grupo = (over: Record<string, unknown> = {}) => ({
    id: 'g1', name: 'Nivel 2. Fulano', study_type_id: 'N2', status: 'en_curso',
    leader_id: 'm1', leader_name: 'Fulano', co_leader_id: null, co_leader_name: null,
    zone: '', participants: [], start_date: '2026-09-01', end_date: null,
    ...over,
  }) as unknown as Parameters<typeof buildDirigentes>[0][number]

  it('con un grupo EN CURSO queda activo aunque no esté en el comité', () => {
    const [d] = buildDirigentes([grupo()], [], [], [])
    expect(d.estudios_activos).toHaveLength(1)
    expect(d.status).toBe('activo')
  })

  it('también con uno EN MATRÍCULA: ya tiene el grupo a cargo', () => {
    // Es la decisión de ESTADOS_DIRIGIENDO, confirmada dos veces. Si algún día
    // cambia, este test cambia con ella y no antes.
    const [d] = buildDirigentes([grupo({ status: 'en_matricula' })], [], [], [])
    expect(d.status).toBe('activo')
  })

  it('el CO-dirigente también: el grupo es de los dos', () => {
    const [d] = buildDirigentes(
      [grupo({ leader_id: null, leader_name: null, co_leader_id: 'm2', co_leader_name: 'Mengana' })],
      [], [], [])
    expect(d.member_id).toBe('m2')
    expect(d.status).toBe('activo')
  })

  it('sin grupo a cargo y fuera del comité, sigue inactivo', () => {
    const [d] = buildDirigentes([grupo({ status: 'finalizado' })], [], [], [])
    expect(d.estudios_activos).toHaveLength(0)
    expect(d.status).toBe('inactivo')
  })

  it('EL INVARIANTE: ninguna fila con grupos activos puede decir «inactivo»', () => {
    const lista = buildDirigentes([
      grupo(),
      grupo({ id: 'g2', status: 'en_matricula', leader_id: 'm2', leader_name: 'Dos' }),
      grupo({ id: 'g3', status: 'finalizado', leader_id: 'm3', leader_name: 'Tres' }),
    ], [], [], [])
    for (const d of lista) {
      if (d.estudios_activos.length > 0) expect(d.status, d.member_name).toBe('activo')
    }
  })

  it('pero el matiz administrativo NO se pisa: en pausa sigue en pausa', () => {
    // 'resting' y 'en_revision' los pone una persona a propósito. Derivarlos
    // borraría una decisión, que es peor que mostrar una contradicción.
    const config = new Map([['m1', { formacion: [], disponibilidad: [], availability_status: 'en_revision' as const }]])
    const [d] = buildDirigentes([grupo()], [], [], [], config)
    expect(d.status).toBe('activo')
    expect(d.availability_status).toBe('en_revision')
  })
})
