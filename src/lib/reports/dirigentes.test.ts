import { describe, it, expect } from 'vitest'
import {
  buildDirigentesReport, collapseAdminBuckets, monthsBefore, nearestPoint,
  HISTORY_TOLERANCE_DAYS,
  type LeaderRow, type ActiveGroupRow, type PlanRow, type LeaderHistoryPoint,
} from './dirigentes'

const PLANS: PlanRow[] = [
  { code: 'N1', name: 'Nivel 1' },
  { code: 'N2', name: 'Nivel 2' },
  { code: 'DIS1', name: 'Discípulos 1' },
]

function leader(p: Partial<LeaderRow> & { member_id: string }): LeaderRow {
  return {
    is_active: true,
    availability_status: 'available',
    formation_study_codes: [],
    qualified_study_codes: [],
    zone_preference: [],
    ...p,
  }
}

// El caso que pide la ficha: uno con grupo, uno sin, uno en pausa.
const CASO: LeaderRow[] = [
  leader({ member_id: 'con-grupo', formation_study_codes: ['N1', 'N2'], qualified_study_codes: ['N1'], zone_preference: ['Norte'] }),
  leader({ member_id: 'sin-grupo', formation_study_codes: ['N1'], qualified_study_codes: ['N1', 'N2'], zone_preference: ['Norte', 'Sur'] }),
  leader({ member_id: 'en-pausa', is_active: false, availability_status: 'resting', formation_study_codes: ['DIS1'] }),
  leader({ member_id: 'en-revision', is_active: false, availability_status: 'en_revision' }),
  leader({ member_id: 'inactivo', is_active: false, availability_status: 'inactive' }),
]
const GRUPOS: ActiveGroupRow[] = [{ leader_id: 'con-grupo', co_leader_id: null }]

describe('buildDirigentesReport · conteos', () => {
  const r = buildDirigentesReport(CASO, GRUPOS, PLANS)

  it('clasifica cada quien en su bucket', () => {
    expect(r.dando_ahora).toBe(1)
    expect(r.disponibles_sin_grupo).toBe(1)
    expect(r.en_pausa).toBe(1)
    expect(r.en_revision).toBe(1)
    expect(r.inactivos).toBe(1)
  })

  // La invariante que hace confiable el desglose.
  it('los cinco buckets suman el total', () => {
    expect(r.dando_ahora + r.disponibles_sin_grupo + r.en_pausa + r.en_revision + r.inactivos)
      .toBe(r.total)
    expect(r.total).toBe(5)
  })

  it('activos cuenta is_active, no los buckets', () => {
    expect(r.activos).toBe(2)
  })

  it('el co-dirigente también está dando', () => {
    const r2 = buildDirigentesReport(
      [leader({ member_id: 'a' }), leader({ member_id: 'b' })],
      [{ leader_id: 'a', co_leader_id: 'b' }],
      PLANS,
    )
    expect(r2.dando_ahora).toBe(2)
    expect(r2.disponibles_sin_grupo).toBe(0)
  })

  // Dar un estudio es un hecho observable; el estado configurado, una intención.
  it('tener grupo abierto manda sobre el estado configurado', () => {
    const r2 = buildDirigentesReport(
      [leader({ member_id: 'x', is_active: false, availability_status: 'resting' })],
      [{ leader_id: 'x', co_leader_id: null }],
      PLANS,
    )
    expect(r2.dando_ahora).toBe(1)
    expect(r2.en_pausa).toBe(0)
  })

  it('sin dirigentes no revienta', () => {
    const v = buildDirigentesReport([], [], PLANS)
    expect(v.total).toBe(0)
    expect(v.capacitados).toEqual([])
    expect(v.por_zona).toEqual([])
  })
})

// Estas dos NO son métricas del cuerpo de dirigentes: son EST-1 roto en los
// datos. En producción dieron 15 y 4 el 2026-08-21.
describe('calidad de datos', () => {
  it('cuenta a quien lleva grupo abierto sin ficha de dirigente', () => {
    const r = buildDirigentesReport(
      [leader({ member_id: 'con-ficha' })],
      [{ leader_id: 'con-ficha', co_leader_id: 'fantasma' }],
      PLANS,
    )
    expect(r.dando_sin_ficha).toBe(1)
    // Y no lo mete en ningún bucket: el reporte recorre study_leaders.
    expect(r.total).toBe(1)
    expect(r.dando_ahora).toBe(1)
  })

  it('cuenta a quien lleva grupo abierto estando inactivo', () => {
    const r = buildDirigentesReport(
      [leader({ member_id: 'a', is_active: false, availability_status: 'inactive' })],
      [{ leader_id: 'a', co_leader_id: null }],
      PLANS,
    )
    expect(r.dando_inactivos).toBe(1)
    expect(r.dando_ahora).toBe(1)
    expect(r.inactivos).toBe(0)
  })

  it('con los datos sanos las dos quedan en cero', () => {
    const r = buildDirigentesReport(
      [leader({ member_id: 'a' })], [{ leader_id: 'a', co_leader_id: null }], PLANS)
    expect(r.dando_sin_ficha).toBe(0)
    expect(r.dando_inactivos).toBe(0)
  })
})

describe('capacitados vs disponibles por estudio', () => {
  const r = buildDirigentesReport(CASO, GRUPOS, PLANS)

  // Son columnas distintas y el reporte las separa a propósito.
  it('capacitados sale de formación', () => {
    expect(r.capacitados).toEqual([
      { code: 'N1', name: 'Nivel 1', total: 2 },
      { code: 'DIS1', name: 'Discípulos 1', total: 1 },
      { code: 'N2', name: 'Nivel 2', total: 1 },
    ])
  })

  it('disponibles sale de disponibilidad, y da otro número', () => {
    expect(r.disponibles_por_estudio).toEqual([
      { code: 'N1', name: 'Nivel 1', total: 2 },
      { code: 'N2', name: 'Nivel 2', total: 1 },
    ])
    expect(r.disponibles_por_estudio).not.toEqual(r.capacitados)
  })

  it('un código repetido cuenta una vez', () => {
    const r2 = buildDirigentesReport(
      [leader({ member_id: 'a', formation_study_codes: ['N1', 'N1', 'N1'] })], [], PLANS)
    expect(r2.capacitados).toEqual([{ code: 'N1', name: 'Nivel 1', total: 1 }])
  })

  it('un código sin plan cae al propio código, no se pierde', () => {
    const r2 = buildDirigentesReport(
      [leader({ member_id: 'a', formation_study_codes: ['XX'] })], [], PLANS)
    expect(r2.capacitados).toEqual([{ code: 'XX', name: 'XX', total: 1 }])
  })
})

describe('por zona', () => {
  const r = buildDirigentesReport(CASO, GRUPOS, PLANS)

  it('un dirigente con dos zonas cuenta en las dos', () => {
    const norte = r.por_zona.find(z => z.zona === 'Norte')
    const sur = r.por_zona.find(z => z.zona === 'Sur')
    expect(norte).toEqual({ zona: 'Norte', activos: 2, dando_ahora: 1, disponibles_sin_grupo: 1 })
    expect(sur).toEqual({ zona: 'Sur', activos: 1, dando_ahora: 0, disponibles_sin_grupo: 1 })
  })

  // Por eso el desglose por zona NO suma el total: se avisa en el módulo.
  it('las zonas suman más que los activos porque se solapan', () => {
    expect(r.por_zona.reduce((s, z) => s + z.activos, 0)).toBeGreaterThan(r.activos)
  })

  it('un inactivo no cuenta como capacidad de su zona', () => {
    const r2 = buildDirigentesReport(
      [leader({ member_id: 'a', is_active: false, zone_preference: ['Norte'] })], [], PLANS)
    expect(r2.por_zona).toEqual([])
  })

  it('sin zona declarada se agrupa aparte', () => {
    const r2 = buildDirigentesReport([leader({ member_id: 'a' })], [], PLANS)
    expect(r2.por_zona[0].zona).toBe('Sin zona declarada')
  })
})

describe('monthsBefore', () => {
  it('resta meses', () => {
    expect(monthsBefore('2026-08-21', 3)).toBe('2026-05-21')
    expect(monthsBefore('2026-08-21', 6)).toBe('2026-02-21')
  })

  it('cruza el año', () => {
    expect(monthsBefore('2026-02-15', 3)).toBe('2025-11-15')
  })

  // El día 31 no se puede desbordar al mes siguiente.
  it('un 31 cae al último día del mes destino', () => {
    expect(monthsBefore('2026-03-31', 1)).toBe('2026-02-28')
    expect(monthsBefore('2024-03-31', 1)).toBe('2024-02-29')
    expect(monthsBefore('2026-05-31', 1)).toBe('2026-04-30')
  })
})

describe('evolución', () => {
  const punto = (captured_on: string, activos: number): LeaderHistoryPoint =>
    ({ captured_on, activos, dando_ahora: 0, disponibles_sin_grupo: 0 })

  it('sin historia no hay comparación', () => {
    const r = buildDirigentesReport(CASO, GRUPOS, PLANS, [], '2026-08-21')
    expect(r.evolucion.hace_3_meses).toBeNull()
    expect(r.evolucion.hace_6_meses).toBeNull()
  })

  it('agarra el punto más cercano al objetivo', () => {
    const h = [punto('2026-05-19', 100), punto('2026-05-22', 111), punto('2026-02-20', 90)]
    const r = buildDirigentesReport(CASO, GRUPOS, PLANS, h, '2026-08-21')
    expect(r.evolucion.hace_3_meses?.activos).toBe(111)  // 2026-05-22, a 1 día
    expect(r.evolucion.hace_6_meses?.activos).toBe(90)
  })

  // Lo importante: preferir "sin dato" antes que comparar contra algo lejano.
  it('un punto demasiado lejos no se usa', () => {
    const lejos = nearestPoint([punto('2026-01-01', 50)], '2026-08-21', 3)
    expect(lejos).toBeNull()
  })

  it('justo en el borde de tolerancia sí entra', () => {
    const objetivo = monthsBefore('2026-08-21', 3)   // 2026-05-21
    const borde = new Date(Date.parse(`${objetivo}T00:00:00Z`) - HISTORY_TOLERANCE_DAYS * 86400000)
      .toISOString().slice(0, 10)
    expect(nearestPoint([punto(borde, 7)], '2026-08-21', 3)?.activos).toBe(7)
  })
})

describe('collapseAdminBuckets (DIR-6)', () => {
  const r = buildDirigentesReport(CASO, GRUPOS, PLANS)
  const c = collapseAdminBuckets(r)

  it('pausa y revisión se van a inactivos', () => {
    expect(c.en_pausa).toBe(0)
    expect(c.en_revision).toBe(0)
    expect(c.inactivos).toBe(r.inactivos + r.en_pausa + r.en_revision)
  })

  it('el total sigue cuadrando después de colapsar', () => {
    expect(c.dando_ahora + c.disponibles_sin_grupo + c.en_pausa + c.en_revision + c.inactivos)
      .toBe(c.total)
  })

  it('no toca lo que no es matiz', () => {
    expect(c.activos).toBe(r.activos)
    expect(c.dando_ahora).toBe(r.dando_ahora)
    expect(c.capacitados).toEqual(r.capacitados)
  })
})
