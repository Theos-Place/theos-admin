import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  ESTUDIANDO_AHORA, estaEstudiando, estudiantesDelGrupo, ocupanCupo,
  esDirigenteDelGrupo,
} from './conteo-de-participantes'
import { ESTADOS_DE_INSCRIPCION } from './estados-de-inscripcion'

const sinComentarios = (r: string) =>
  readFileSync(r, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

const p = (member_id: string, status: string) => ({ member_id, status })
/** Un grupo de niveles en curso como los reales: 3 estudiando, 1 que ya
 *  terminó dentro del grupo abierto, 1 retirado, y la dirigente matriculada. */
const GRUPO = { leader_id: 'dir', co_leader_id: null }
const FILAS = [
  p('a', 'enrolled'), p('b', 'enrolled'), p('c', 'pendiente_de_pago'),
  p('d', 'completed'), p('e', 'dropped'), p('dir', 'enrolled'),
]

describe('EST-20 · quién cuenta como estudiante', () => {
  it('son 3: los dos matriculados y el que debe el pago', () => {
    // La matrícula es efectiva de inmediato y el pago va aparte (2026-08-04):
    // quien debe no deja de estar estudiando.
    expect(estudiantesDelGrupo(FILAS, GRUPO).map(x => x.member_id)).toEqual(['a', 'b', 'c'])
  })

  it('quien YA TERMINÓ dentro de un grupo en curso no cuenta como estudiando', () => {
    // Son exactamente los 5 que hacían la diferencia entre 380 y 385:
    // Carla Obando, Mariana Castro, Mariela Hernandez, Sergio Ortega y
    // Sergio Rojas, todos `completed` en grupos que siguen abiertos.
    expect(estaEstudiando('completed')).toBe(false)
    expect(estudiantesDelGrupo([p('d', 'completed')], GRUPO)).toEqual([])
  })

  it('el dirigente no es estudiante de su propio grupo', () => {
    // El sexto de la diferencia: Sofía Solís, matriculada en su Nivel 3.
    expect(esDirigenteDelGrupo('dir', GRUPO)).toBe(true)
    expect(estudiantesDelGrupo(FILAS, GRUPO).some(x => x.member_id === 'dir')).toBe(false)
  })

  it('pero SÍ ocupa cupo quien ya terminó: son preguntas distintas', () => {
    // El «x/y» habla de campos libres; el resumen habla de gente. Mezclarlas
    // es lo que produjo dos números para lo mismo.
    expect(ocupanCupo(FILAS).map(x => x.member_id)).toEqual(['a', 'b', 'c', 'd', 'dir'])
  })

  it('un retirado no cuenta de ninguna forma', () => {
    expect(estaEstudiando('dropped')).toBe(false)
    expect(ocupanCupo([p('e', 'dropped')])).toEqual([])
  })

  it('es lista BLANCA: un estado desconocido queda fuera, no adentro', () => {
    // Contar por negación es lo que le mandó el aviso de inicio a 16 personas
    // retiradas. Un estado nuevo tiene que quedar fuera hasta que alguien
    // decida, no entrar porque nadie lo nombró.
    for (const inventado of ['withdrawn', 'activo', 'en_curso', '']) {
      expect(estaEstudiando(inventado), inventado).toBe(false)
    }
  })

  it('todos los estados que nombra existen de verdad', () => {
    for (const e of ESTUDIANDO_AHORA) {
      expect(ESTADOS_DE_INSCRIPCION as readonly string[], e).toContain(e)
    }
  })
})

describe('EST-20 · la página y el Excel cuentan LO MISMO', () => {
  const PANTALLA = sinComentarios('src/app/(admin)/estudios/grupos/page.tsx')
  const QUERIES = sinComentarios('src/lib/supabase/queries/studies.ts')
  const SQL = readFileSync(
    'supabase/migrations/20260929120000_est20_resumen_de_estudios.sql', 'utf8')

  it('el Excel ya no cuenta por negación', () => {
    // `filter(p => p.status !== 'withdrawn')` sobre el estado de DOMINIO era
    // la causa: ahí `completed` y `enrolled` son lo mismo.
    expect(PANTALLA).not.toContain("status !== 'withdrawn'")
  })

  it('y usa el número que viene del servidor', () => {
    const i = PANTALLA.indexOf("key: 'participants_count'")
    expect(i).toBeGreaterThan(-1)
    expect(PANTALLA.slice(i, i + 400)).toContain('g.estudiando')
  })

  it('el servidor lo calcula con la función compartida', () => {
    expect(QUERIES).toContain('estudiantesDelGrupo(g.enrollments, g)')
  })

  it('el RPC del resumen nombra los MISMOS estados que el módulo', () => {
    // Las dos listas son copias en lenguajes distintos. Si alguien agrega un
    // estado en TypeScript y se olvida del SQL, los dos números vuelven a
    // separarse y nadie se entera hasta que alguien baje el Excel.
    const m = /e\.status in \(([^)]+)\)\)\s*$/m.exec(SQL)
      ?? /g\.status in \('en_curso','en_matricula'\) and e\.status in \(([^)]+)\)/.exec(SQL)
    expect(m, 'no se encontró la lista de estados del RPC').toBeTruthy()
    const enSql = [...m![1].matchAll(/'([a-z_]+)'/g)].map(x => x[1]).sort()
    expect(enSql).toEqual([...ESTUDIANDO_AHORA].sort())
  })

  it('el RPC excluye a los dirigentes, igual que el módulo', () => {
    expect(SQL).toContain('e.member_id = g.leader_id or e.member_id = g.co_leader_id')
    expect(SQL).toContain('filter (where not coalesce(is_leader, false))')
  })

  it('y trae el bloque «por iniciar», que antes no salía en ningún lado', () => {
    // 11 grupos de niveles con 54 personas que existían y nadie veía.
    expect(SQL).toContain("'en_curso','en_matricula'")
    expect(SQL).toContain("g.status in ('en_curso','en_matricula','finalizado')")
  })
})
