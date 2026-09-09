import { describe, it, expect } from 'vitest'
import {
  unidadSobreviviente, planificarFusion, gruposAFusionar, casoDeVinculo,
  type Unidad, type FilaFamilia,
} from './fusion-familias'

const u = (id: string, created_at: string, name = id): Unidad => ({ id, created_at, name })
const f = (
  family_unit_id: string, member_id: string, relation: string | null, created_at: string,
  linked_by: string | null = null,
): FilaFamilia => ({ family_unit_id, member_id, relation, created_at, linked_by })

describe('unidadSobreviviente', () => {
  it('gana la más antigua', () => {
    expect(unidadSobreviviente([
      u('nueva', '2026-09-09T20:27:00Z'),
      u('vieja', '2026-06-08T23:26:00Z'),
    ])?.id).toBe('vieja')
  })

  it('con la misma fecha desempata el id, para no depender del orden', () => {
    const mismo = '2026-01-01T00:00:00Z'
    expect(unidadSobreviviente([u('b', mismo), u('a', mismo)])?.id).toBe('a')
    expect(unidadSobreviviente([u('a', mismo), u('b', mismo)])?.id).toBe('a')
  })

  it('sin unidades no hay sobreviviente', () => {
    expect(unidadSobreviviente([])).toBeNull()
  })
})

describe('planificarFusion — el caso Chavarría / Hernández', () => {
  // La familia vieja tiene a los hijos de ella; la nueva, al marido y al hijo
  // de él. Marielena figura en las dos, con distinta relación.
  const VIEJA = u('A', '2026-06-08T23:26:00Z', 'Familia Chavarria')
  const NUEVA = u('B', '2026-09-09T20:27:00Z', 'Familia Chavarria Calvosa')
  const FILAS = [
    f('A', 'daniela', 'Hijo/a', '2026-06-08T23:26:00Z'),
    f('A', 'francessa', 'Hijo/a', '2026-06-08T23:26:00Z'),
    f('A', 'marielena', 'Otro', '2026-06-08T23:26:00Z'),
    f('B', 'fernando', 'Titular', '2026-09-09T20:27:00Z'),
    f('B', 'marielena', 'Cónyuge', '2026-09-09T20:27:00Z'),
    f('B', 'fernando_felipe', 'Hijo/a', '2026-09-09T20:32:00Z'),
  ]

  const plan = planificarFusion([VIEJA, NUEVA], FILAS)

  it('sobrevive la unidad más antigua', () => {
    expect(plan.sobrevive).toBe('A')
    expect(plan.seEliminan).toEqual(['B'])
  })

  it('queda UNA familia con los cinco: los hijos de ella y el de él juntos', () => {
    expect(plan.integrantesFinales.map(i => i.member_id).sort())
      .toEqual(['daniela', 'fernando', 'fernando_felipe', 'francessa', 'marielena'])
  })

  it('a Marielena le queda la relación MÁS RECIENTE, no la vieja', () => {
    // 'Otro' era del vínculo de junio; 'Cónyuge' es lo que alguien afirmó ayer.
    expect(plan.integrantesFinales.find(i => i.member_id === 'marielena')?.relation).toBe('Cónyuge')
  })

  it('cada quien se muda con su propia relación', () => {
    const porId = Object.fromEntries(plan.integrantesFinales.map(i => [i.member_id, i.relation]))
    expect(porId.fernando).toBe('Titular')
    expect(porId.fernando_felipe).toBe('Hijo/a')
    expect(porId.daniela).toBe('Hijo/a')
  })

  it('solo se mueve lo que estaba en la unidad que desaparece', () => {
    expect(plan.movimientos.map(m => m.member_id).sort())
      .toEqual(['fernando', 'fernando_felipe', 'marielena'])
    for (const m of plan.movimientos) expect(m.hacia).toBe('A')
  })

  it('conserva linked_by de quien lo tuviera', () => {
    const conAutor = planificarFusion([VIEJA, NUEVA], [
      ...FILAS.filter(x => x.member_id !== 'fernando'),
      f('B', 'fernando', 'Titular', '2026-09-09T20:27:00Z', 'operadora'),
    ])
    expect(conAutor.movimientos.find(m => m.member_id === 'fernando')?.linked_by).toBe('operadora')
  })

  it('el plan no depende del orden en que lleguen las unidades ni las filas', () => {
    const alReves = planificarFusion([NUEVA, VIEJA], [...FILAS].reverse())
    expect(alReves).toEqual(plan)
  })
})

describe('planificarFusion — casos borde', () => {
  it('una sola unidad: no mueve nada pero reporta sus integrantes', () => {
    const p = planificarFusion([u('A', '2026-01-01T00:00:00Z')], [f('A', 'x', 'Titular', '2026-01-01T00:00:00Z')])
    expect(p.sobrevive).toBe('A')
    expect(p.movimientos).toEqual([])
    expect(p.seEliminan).toEqual([])
    expect(p.integrantesFinales).toEqual([{ member_id: 'x', relation: 'Titular' }])
  })

  it('sin unidades no hay plan', () => {
    expect(planificarFusion([], []).sobrevive).toBeNull()
  })

  it('tres unidades se funden en la más antigua de las tres', () => {
    const p = planificarFusion(
      [u('C', '2026-03-01T00:00:00Z'), u('A', '2026-01-01T00:00:00Z'), u('B', '2026-02-01T00:00:00Z')],
      [
        f('A', 'a1', 'Titular', '2026-01-01T00:00:00Z'),
        f('B', 'b1', 'Hijo/a', '2026-02-01T00:00:00Z'),
        f('C', 'c1', 'Otro', '2026-03-01T00:00:00Z'),
      ],
    )
    expect(p.sobrevive).toBe('A')
    expect(p.seEliminan).toEqual(['B', 'C'])
    expect(p.integrantesFinales.map(i => i.member_id)).toEqual(['a1', 'b1', 'c1'])
  })

  it('ignora filas de unidades que no son parte de la fusión', () => {
    const p = planificarFusion(
      [u('A', '2026-01-01T00:00:00Z'), u('B', '2026-02-01T00:00:00Z')],
      [f('A', 'a1', 'Titular', '2026-01-01T00:00:00Z'), f('Z', 'ajeno', 'Otro', '2026-01-01T00:00:00Z')],
    )
    expect(p.integrantesFinales.map(i => i.member_id)).toEqual(['a1'])
  })
})

describe('gruposAFusionar — encadenado', () => {
  it('A comparte con B y B con C: las tres son un solo grupo', () => {
    const filas = [
      f('A', 'p1', null, '2026-01-01T00:00:00Z'),
      f('A', 'compartida_ab', null, '2026-01-01T00:00:00Z'),
      f('B', 'compartida_ab', null, '2026-01-02T00:00:00Z'),
      f('B', 'compartida_bc', null, '2026-01-02T00:00:00Z'),
      f('C', 'compartida_bc', null, '2026-01-03T00:00:00Z'),
    ]
    expect(gruposAFusionar(filas)).toEqual([['A', 'B', 'C']])
  })

  it('grupos independientes no se mezclan', () => {
    const filas = [
      f('A', 'x', null, '2026-01-01T00:00:00Z'), f('B', 'x', null, '2026-01-02T00:00:00Z'),
      f('C', 'y', null, '2026-01-01T00:00:00Z'), f('D', 'y', null, '2026-01-02T00:00:00Z'),
      f('E', 'sola', null, '2026-01-01T00:00:00Z'),
    ]
    expect(gruposAFusionar(filas)).toEqual([['A', 'B'], ['C', 'D']])
  })

  it('sin nadie repetido no hay nada que fusionar', () => {
    expect(gruposAFusionar([
      f('A', 'x', null, '2026-01-01T00:00:00Z'),
      f('B', 'y', null, '2026-01-01T00:00:00Z'),
    ])).toEqual([])
  })

  it('una cadena larga no se parte', () => {
    const filas: FilaFamilia[] = []
    for (let i = 0; i < 30; i++) {
      filas.push(f(`U${i}`, `enlace${i}`, null, '2026-01-01T00:00:00Z'))
      filas.push(f(`U${i + 1}`, `enlace${i}`, null, '2026-01-01T00:00:00Z'))
    }
    const grupos = gruposAFusionar(filas)
    expect(grupos).toHaveLength(1)
    expect(grupos[0]).toHaveLength(31)
  })
})

describe('casoDeVinculo', () => {
  it('ninguno tiene familia → crear', () => {
    expect(casoDeVinculo(null, null)).toBe('crear')
  })

  it('solo uno tiene → sumar, en cualquier sentido', () => {
    expect(casoDeVinculo('A', null)).toBe('sumar_a_una')
    expect(casoDeVinculo(null, 'A')).toBe('sumar_a_una')
  })

  it('los dos tienen familias distintas → fusionar', () => {
    expect(casoDeVinculo('A', 'B')).toBe('fusionar')
  })

  it('ya están en la misma → no-op idempotente', () => {
    expect(casoDeVinculo('A', 'A')).toBe('ya_vinculados')
  })
})
