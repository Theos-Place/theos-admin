import { describe, it, expect } from 'vitest'
import { buildUnits, evaluateUnits, parseGroupsParam, parseOpsParam } from './filter-units'
import type { FilterCondition, ConditionGroup } from '@/types/filters'

// FIL-3: la combinación server-side de condiciones y grupos AND/OR debe ser
// espejo exacto de la del cliente. Se prueba con `passes` sintético.

const cond = (id: number): FilterCondition =>
  ({ id, group: 'donor', type: 'donor', value: 'yes' }) as FilterCondition

// Universo base y conjuntos que "cumplen" cada condición.
const BASE = ['m1', 'm2', 'm3', 'm4', 'm5']
const MATCH: Record<number, Set<string>> = {
  1: new Set(['m1', 'm2']),        // A
  2: new Set(['m3']),              // B
  3: new Set(['m1', 'm3', 'm4']),  // C
}
const passes = (id: string, condId: number) => MATCH[condId]?.has(id) ?? true

describe('evaluateUnits (FIL-3)', () => {
  it('sin grupos: AND entre todas (comportamiento histórico)', () => {
    expect(evaluateUnits(BASE, [cond(1), cond(3)], [], {}, passes)).toEqual(['m1'])
  })

  it('(A OR B) AND C', () => {
    const groups: ConditionGroup[] = [{ id: 10, members: [1, 2], op: 'OR' }]
    // A∪B = {m1,m2,m3}; ∩C = {m1,m3}
    expect(evaluateUnits(BASE, [cond(1), cond(2), cond(3)], groups, {}, passes)).toEqual(['m1', 'm3'])
  })

  it('grupo AND interno equivale a condiciones sueltas', () => {
    const groups: ConditionGroup[] = [{ id: 10, members: [1, 3], op: 'AND' }]
    expect(evaluateUnits(BASE, [cond(1), cond(3)], groups, {}, passes)).toEqual(['m1'])
  })

  it('OR top-level une contra el universo base', () => {
    // unidad c1 (AND base) luego c2 con op OR → {m1,m2} ∪ {m3}
    expect(evaluateUnits(BASE, [cond(1), cond(2)], [], { c2: 'OR' }, passes)).toEqual(['m1', 'm2', 'm3'])
  })

  it('negación dentro de un OR (passes ya refleja el anti-join)', () => {
    // condición 4 = "NO cumple C": pasa quien NO está en MATCH[3]
    const passesNeg = (id: string, condId: number) =>
      condId === 4 ? !MATCH[3].has(id) : passes(id, condId)
    const groups: ConditionGroup[] = [{ id: 10, members: [2, 4], op: 'OR' }]
    // B ∪ ¬C = {m3} ∪ {m2,m5} = {m2,m3,m5}
    expect(evaluateUnits(BASE, [cond(2), cond(4)], groups, {}, passesNeg)).toEqual(['m2', 'm3', 'm5'])
  })

  it('condición sin resolución conocida pasa (no filtra)', () => {
    expect(evaluateUnits(BASE, [cond(99)], [], {}, passes)).toEqual(BASE)
  })

  it('buildUnits pone el grupo donde aparece su primera condición', () => {
    const groups: ConditionGroup[] = [{ id: 10, members: [2, 3], op: 'OR' }]
    const units = buildUnits([cond(1), cond(2), cond(3)], groups)
    expect(units.map(u => u.kind)).toEqual(['condition', 'group'])
  })
})

describe('parseGroupsParam / parseOpsParam', () => {
  it('acepta grupos bien formados y descarta el resto', () => {
    const raw = JSON.stringify([
      { id: 1, members: [1, 2], op: 'OR' },
      { id: 'x', members: [1], op: 'OR' },      // id inválido
      { id: 2, members: ['a'], op: 'AND' },     // members inválidos
      { id: 3, members: [3], op: 'XOR' },       // op inválido
    ])
    expect(parseGroupsParam(raw)).toEqual([{ id: 1, members: [1, 2], op: 'OR' }])
    expect(parseGroupsParam('no-json')).toBeUndefined()
    expect(parseGroupsParam(null)).toBeUndefined()
  })

  it('acepta solo claves c<id>/g<id> con AND|OR', () => {
    expect(parseOpsParam(JSON.stringify({ c1: 'OR', g2: 'AND', zz: 'OR', c3: 'XOR' })))
      .toEqual({ c1: 'OR', g2: 'AND' })
    expect(parseOpsParam(JSON.stringify([]))).toBeUndefined()
    expect(parseOpsParam(null)).toBeUndefined()
  })
})
