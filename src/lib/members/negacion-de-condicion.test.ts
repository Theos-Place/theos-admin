import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { negarCondicion, pasaLaCondicion, type CondicionResuelta } from './negacion-de-condicion'

const set = (...ids: string[]) => new Set(ids)
const TODOS = ['a', 'b', 'c', 'd']
const quienesPasan = (r: CondicionResuelta) => TODOS.filter(id => pasaLaCondicion(r, id))

/**
 * PAR-5b · Negar cualquier condición (pedido de Ari: «cursando un estudio
 * EXCEPTO niveles», «excluir a quienes llevan X»).
 */
describe('negar una condición la invierte exacto', () => {
  it('una condición de inclusión pasa a excluir a los mismos', () => {
    const r: CondicionResuelta = { include: [set('a', 'b')], exclude: [] }
    expect(quienesPasan(r)).toEqual(['a', 'b'])
    expect(quienesPasan(negarCondicion(r))).toEqual(['c', 'd'])
  })

  it('una de exclusión pasa a incluir — el caso de «no llevó X»', () => {
    // `not_taken` ya se resolvía como exclude, así que negarlo devuelve
    // justamente «sí lo llevó». Medido en producción: 19.049 y 4.936, que suman
    // el padrón activo.
    const r: CondicionResuelta = { include: [], exclude: [set('a', 'b')] }
    expect(quienesPasan(r)).toEqual(['c', 'd'])
    expect(quienesPasan(negarCondicion(r))).toEqual(['a', 'b'])
  })

  it('negar dos veces deja todo como estaba', () => {
    const r: CondicionResuelta = { include: [set('a')], exclude: [set('d')] }
    expect(negarCondicion(negarCondicion(r))).toEqual(r)
  })

  it('las dos mitades PARTEN el universo, sin huecos ni repetidos', () => {
    // La propiedad que de verdad importa, y la que se verificó contra
    // producción para cinco tipos de condición distintos.
    const r: CondicionResuelta = { include: [set('a', 'c')], exclude: [] }
    const si = quienesPasan(r)
    const no = quienesPasan(negarCondicion(r))
    expect([...si, ...no].sort()).toEqual(TODOS)
    expect(si.filter(id => no.includes(id))).toEqual([])
  })

  it('un conjunto vacío niega a TODOS, no a nadie', () => {
    // El borde que rompía la negación de asistencia cuando el filtro de sedes
    // no resolvía ningún uuid: empujaba un set vacío a `include` sin mirar
    // `negate`, así que «no asistió a nada» no devolvía a nadie.
    const r: CondicionResuelta = { include: [set()], exclude: [] }
    expect(quienesPasan(r)).toEqual([])
    expect(quienesPasan(negarCondicion(r))).toEqual(TODOS)
  })

  it('isActiveOverride se invierte con el resto', () => {
    // Si se negara el conjunto y no la bandera, la consulta base seguiría
    // buscando lo contrario de lo pedido y el resultado saldría vacío.
    expect(negarCondicion({ include: [set('a')], exclude: [], isActiveOverride: true }).isActiveOverride).toBe(false)
    expect(negarCondicion({ include: [set('a')], exclude: [], isActiveOverride: false }).isActiveOverride).toBe(true)
  })

  it('sin bandera, sigue sin bandera — no se inventa un false', () => {
    expect(negarCondicion({ include: [set('a')], exclude: [] }).isActiveOverride).toBeUndefined()
  })
})

/**
 * El intercambio vale mientras cada condición aporte UN SOLO conjunto. Con dos
 * en `include`, negar sería ¬(A∧B) = ¬A ∨ ¬B y el intercambio da ¬A ∧ ¬B, que
 * devolvería de menos sin avisar.
 */
describe('el supuesto en el que se apoya la negación', () => {
  const src = readFileSync('src/lib/supabase/queries/members.ts', 'utf8')
  const resolver = src.slice(
    src.indexOf('export async function resolveAdvancedConditions'),
    src.indexOf('perCondition.push('),
  )

  it('ningún case acumula dos conjuntos en la misma rama', () => {
    // Heurística deliberadamente burda: si el número de `push` crece, hay que
    // mirar si alguno quedó en la MISMA rama que otro. No prueba la propiedad,
    // pero obliga a leer este comentario antes de romperla.
    const pushes = [...resolver.matchAll(/res\.(include|exclude)\.push/g)].length
    // 20 → 24 con PAR-7 (2026-09-25). Se revisaron los cuatro nuevos y cada
    // camino aporta UNO: `leader_state` y el par `leader_trained`/
    // `leader_available` tienen un solo push cada uno, y `leader_teaching`
    // tiene dos pero en ramas excluyentes (la de «cualquier estudio» hace
    // `break` antes de llegar a la otra). El supuesto sigue en pie.
    expect(pushes, 'cambió la cantidad de push: revisá que ningún case aporte DOS sets en la MISMA rama').toBe(24)
  })

  it('el resolver usa el helper y no una copia a mano', () => {
    expect(src).toContain('negarCondicion(res)')
    expect(src).toContain("from '@/lib/members/negacion-de-condicion'")
  })

  it('asistencia e inscripción ya NO niegan por su cuenta', () => {
    // Tenían su propio `target` mirando `c.negate`; con la negación general
    // eso habría sido un doble negativo.
    expect(resolver).not.toContain('c.negate ? res.exclude.push')
  })
})
