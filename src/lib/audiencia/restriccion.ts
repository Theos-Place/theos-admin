// Restricción de audiencia: A QUIÉN se le ofrece algo.
//
// Nació con GRU-2 para los grupos de estudio y FRM-5 la necesitó igual para los
// formularios, así que vive acá y no en studies/. La pregunta es la misma —"¿a
// quién va dirigido esto?"— y tener dos modelos de lo mismo garantiza que se
// desincronicen.
//
// Se guarda con el MISMO shape del filtro avanzado del padrón (FilterState) para
// no tener dos modelos de la misma cosa: mismo constructor de condiciones,
// mismas etiquetas (condition-labels.ts) y el mismo resolvedor server-side
// (resolveAdvancedConditions). Este archivo es puro: valida, describe y decide.
//
// Lo que es de CADA dueño —el mensaje del bloqueo, el código de error— vive en
// su propio módulo: `lib/studies/group-restrictions.ts` y `lib/forms/audiencia.ts`.
import type { FilterCondition, ConditionGroup } from '@/types/filters'
import { conditionLabel } from '@/lib/condition-labels'
import { buildUnits, unitKey } from '@/lib/filter-units'

/** Tipos de condición permitidos en una restricción de audiencia.
 *
 *  Decisión 2026-08-06: solo las que describen una AUDIENCIA. Quedan fuera
 *  asistencia, inscripción a eventos, formularios, estado de cuenta y fecha de
 *  creación — no dicen "a quién va dirigido este grupo", y son justo las caras
 *  de resolver. Si alguna hace falta, se agrega acá y aparece sola en la UI. */
export const ALLOWED_RESTRICTION_TYPES = [
  'leader', 'service', 'study', 'age', 'marital', 'donor',
  /**
   * PAR-7 · Los filtros de dirigente también sirven de audiencia: el caso que
   * lo pidió es un formulario dirigido a «los disponibles para dar Niveles».
   *
   * Esta lista es un PERMISO, no una consecuencia: una condición nueva del
   * padrón NO entra sola. Se agregan estas cuatro a propósito porque un grupo o
   * un formulario dirigido a dirigentes es una pregunta real.
   *
   * `leader_state` entra con una advertencia: una restricción que diga «en
   * revisión» la puede escribir solo quien ve ese estado, pero después la
   * evalúa el servidor para cualquiera que abra el formulario. No filtra menos
   * ni de más — simplemente, quien la escribió es quien decidió.
   */
  'leader_state', 'leader_trained', 'leader_teaching', 'leader_available',
] as const

export type RestrictionType = (typeof ALLOWED_RESTRICTION_TYPES)[number]

export function isAllowedRestrictionType(type: string): type is RestrictionType {
  return (ALLOWED_RESTRICTION_TYPES as readonly string[]).includes(type)
}

/** Lo que se guarda en la columna jsonb del dueño (study_groups.enrollment_restrictions,
 *  forms.audience_restrictions). Mismo shape que el filtro del padrón más el
 *  operador top-level por unidad. */
export type Restriccion = {
  conditions: FilterCondition[]
  groups: ConditionGroup[]
  ops: Record<string, 'AND' | 'OR'>
}

export const EMPTY_RESTRICTION: Restriccion = { conditions: [], groups: [], ops: {} }

/** ¿Restringe a alguien? Una restricción sin condiciones es lo mismo que no
 *  tener restricción — así el "guardar vacío" limpia en vez de bloquear. */
export function hasRestriction(r: Restriccion | null | undefined): boolean {
  return !!r && r.conditions.length > 0
}

/** Normaliza lo que venga de la BD o del cliente: descarta lo que no tenga forma
 *  de condición y lo que no sea un tipo permitido, y tira los grupos/ops que
 *  quedaron apuntando a condiciones inexistentes. Devuelve null si no queda
 *  nada — el caller guarda NULL y el grupo vuelve a ser abierto. */
export function normalizeRestriction(raw: unknown): Restriccion | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Partial<Restriccion>
  const conditions = (Array.isArray(o.conditions) ? o.conditions : [])
    .filter((c): c is FilterCondition =>
      !!c && typeof c === 'object'
      && typeof (c as FilterCondition).id === 'number'
      && typeof (c as FilterCondition).type === 'string'
      && isAllowedRestrictionType((c as FilterCondition).type))
  if (conditions.length === 0) return null

  const condIds = new Set(conditions.map(c => c.id))
  const groups = (Array.isArray(o.groups) ? o.groups : [])
    .filter((g): g is ConditionGroup =>
      !!g && typeof g === 'object'
      && typeof g.id === 'number'
      && Array.isArray(g.members)
      && (g.op === 'AND' || g.op === 'OR'))
    .map(g => ({ ...g, members: g.members.filter(m => condIds.has(m)) }))
    // Un grupo de una sola condición no agrupa nada: se disuelve.
    .filter(g => g.members.length > 1)

  const validKeys = new Set([
    ...conditions.map(c => unitKey({ kind: 'condition', id: c.id })),
    ...groups.map(g => unitKey({ kind: 'group', id: g.id, members: g.members, op: g.op })),
  ])
  const ops: Record<string, 'AND' | 'OR'> = {}
  for (const [k, v] of Object.entries((o.ops ?? {}) as Record<string, unknown>)) {
    if (validKeys.has(k) && (v === 'AND' || v === 'OR')) ops[k] = v
  }

  return { conditions, groups, ops }
}

/** Resumen legible de la restricción, con las MISMAS etiquetas del padrón.
 *  Ejemplos: "Dirigente", "Dirigente y Completó: Nivel 1",
 *            "(Dirigente o Comité: Alabanza) y Completó: Nivel 1". */
export function restrictionSummary(r: Restriccion | null | undefined): string {
  if (!hasRestriction(r)) return ''
  const { conditions, groups, ops } = r!
  const byId = new Map(conditions.map(c => [c.id, c]))
  const units = buildUnits(conditions, groups)

  const partes = units.map((u, i) => {
    const texto = u.kind === 'condition'
      ? conditionLabel(byId.get(u.id)!)
      : `(${u.members.map(m => byId.get(m)).filter(Boolean).map(c => conditionLabel(c!))
          .join(u.op === 'AND' ? ' y ' : ' o ')})`
    // El operador de una unidad la une con LO ANTERIOR; el de la primera no existe.
    const op = i === 0 ? '' : (ops[unitKey(u)] === 'OR' ? ' o ' : ' y ')
    return `${op}${texto}`
  })
  return partes.join('')
}
