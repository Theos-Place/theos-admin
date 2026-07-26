// FIL-3: unidades del filtro avanzado del padrón. Una "unidad" es una condición
// suelta o un grupo de condiciones (AND/OR interno); las unidades se combinan
// entre sí con el operador top-level de cada una (AND/OR, default AND).
// Módulo puro compartido: la UI (useMemberFilters, QueryBar) y la evaluación
// server-side (queries/members.ts) usan EXACTAMENTE la misma semántica.

import type { FilterCondition, ConditionGroup } from '@/types/filters'

/** Parsea el query param `groups` (JSON): solo grupos bien formados. */
export function parseGroupsParam(raw: string | null): ConditionGroup[] | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return undefined
    const valid = parsed.filter((g): g is ConditionGroup =>
      !!g && typeof g === 'object'
      && typeof g.id === 'number'
      && Array.isArray(g.members) && g.members.every((m: unknown) => typeof m === 'number')
      && (g.op === 'AND' || g.op === 'OR'))
    return valid.length ? valid : undefined
  } catch { return undefined }
}

/** Parsea el query param `ops` (JSON): 'c<id>'/'g<id>' → 'AND'|'OR'. */
export function parseOpsParam(raw: string | null): Record<string, 'AND' | 'OR'> | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined
    const out: Record<string, 'AND' | 'OR'> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (/^[cg]\d+$/.test(k) && (v === 'AND' || v === 'OR')) out[k] = v
    }
    return Object.keys(out).length ? out : undefined
  } catch { return undefined }
}

export type FilterUnit =
  | { kind: 'condition'; id: number }
  | { kind: 'group'; id: number; members: number[]; op: 'AND' | 'OR' }

export function unitKey(u: FilterUnit): string {
  return u.kind === 'condition' ? `c${u.id}` : `g${u.id}`
}

/** Ordena condiciones/grupos en unidades, en el orden de las condiciones
 *  (un grupo aparece donde aparece su primera condición). */
export function buildUnits(conditions: FilterCondition[], groups: ConditionGroup[]): FilterUnit[] {
  const groupedIds = new Set(groups.flatMap(g => g.members))
  const addedGroups = new Set<number>()
  const units: FilterUnit[] = []
  for (const cond of conditions) {
    if (groupedIds.has(cond.id)) {
      const grp = groups.find(g => g.members.includes(cond.id))
      if (grp && !addedGroups.has(grp.id)) {
        addedGroups.add(grp.id)
        units.push({ kind: 'group', id: grp.id, members: grp.members, op: grp.op })
      }
    } else {
      units.push({ kind: 'condition', id: cond.id })
    }
  }
  return units
}

/** Evalúa las unidades sobre un universo base de ids. `passes(id, condId)`
 *  responde si el miembro cumple ESA condición (una condición sin resolución
 *  conocida debe devolver true). Semántica espejo de applyFilters del cliente:
 *  - dentro de un grupo: AND = todas, OR = alguna;
 *  - entre unidades: el operador top-level de cada unidad (la primera es AND);
 *  - un OR top-level UNE contra el universo base, no contra el resultado. */
export function evaluateUnits(
  baseIds: string[],
  conditions: FilterCondition[],
  groups: ConditionGroup[],
  topLevelOps: Record<string, 'AND' | 'OR'>,
  passes: (id: string, conditionId: number) => boolean,
): string[] {
  const units = buildUnits(conditions, groups)
  if (units.length === 0) return baseIds
  const condIds = new Set(conditions.map(c => c.id))

  const testUnit = (id: string, unit: FilterUnit): boolean => {
    if (unit.kind === 'condition') return passes(id, unit.id)
    const members = unit.members.filter(m => condIds.has(m))
    if (unit.op === 'AND') return members.every(m => passes(id, m))
    return members.some(m => passes(id, m))
  }

  let result = baseIds
  units.forEach((unit, i) => {
    const op = i === 0 ? 'AND' : (topLevelOps[unitKey(unit)] ?? 'AND')
    if (op === 'AND') {
      result = result.filter(id => testUnit(id, unit))
    } else {
      const inResult = new Set(result)
      result = [...result, ...baseIds.filter(id => !inResult.has(id) && testUnit(id, unit))]
    }
  })
  return result
}
