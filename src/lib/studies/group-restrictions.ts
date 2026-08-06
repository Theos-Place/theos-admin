// GRU-2 · Restricción opcional de audiencia POR GRUPO.
//
// A quién se le OFRECE este grupo. Es del grupo, no del plan: dos grupos de la
// misma capacitación pueden tener restricciones distintas, o uno tenerla y el
// otro no. Los compromisos de la etapa (donador, servidor, asistencia,
// prerequisito, invitación) viven en el plan y se evalúan aparte — la
// restricción se SUMA, nunca reemplaza.
//
// Se guarda con el MISMO shape del filtro avanzado del padrón (FilterState) para
// no tener dos modelos de la misma cosa: mismo constructor de condiciones,
// mismas etiquetas (condition-labels.ts) y el mismo resolvedor server-side
// (resolveAdvancedConditions). Este archivo es puro: valida, describe y decide.
import type { FilterCondition, ConditionGroup } from '@/types/filters'
import { conditionLabel } from '@/lib/condition-labels'
import { buildUnits, unitKey } from '@/lib/filter-units'

/** Tipos de condición permitidos en la restricción de un grupo.
 *
 *  Decisión 2026-08-06: solo las que describen una AUDIENCIA. Quedan fuera
 *  asistencia, inscripción a eventos, formularios, estado de cuenta y fecha de
 *  creación — no dicen "a quién va dirigido este grupo", y son justo las caras
 *  de resolver. Si alguna hace falta, se agrega acá y aparece sola en la UI. */
export const ALLOWED_RESTRICTION_TYPES = [
  'leader', 'service', 'study', 'age', 'marital', 'donor',
] as const

export type RestrictionType = (typeof ALLOWED_RESTRICTION_TYPES)[number]

export function isAllowedRestrictionType(type: string): type is RestrictionType {
  return (ALLOWED_RESTRICTION_TYPES as readonly string[]).includes(type)
}

/** Lo que se guarda en study_groups.enrollment_restrictions. Mismo shape que el
 *  filtro del padrón más el operador top-level por unidad. */
export type GroupRestriction = {
  conditions: FilterCondition[]
  groups: ConditionGroup[]
  ops: Record<string, 'AND' | 'OR'>
}

export const EMPTY_RESTRICTION: GroupRestriction = { conditions: [], groups: [], ops: {} }

/** ¿Este grupo restringe a alguien? Una restricción sin condiciones es lo mismo
 *  que no tener restricción — así el "guardar vacío" limpia en vez de bloquear. */
export function hasRestriction(r: GroupRestriction | null | undefined): boolean {
  return !!r && r.conditions.length > 0
}

/** Normaliza lo que venga de la BD o del cliente: descarta lo que no tenga forma
 *  de condición y lo que no sea un tipo permitido, y tira los grupos/ops que
 *  quedaron apuntando a condiciones inexistentes. Devuelve null si no queda
 *  nada — el caller guarda NULL y el grupo vuelve a ser abierto. */
export function normalizeRestriction(raw: unknown): GroupRestriction | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Partial<GroupRestriction>
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
export function restrictionSummary(r: GroupRestriction | null | undefined): string {
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

/** Mensaje del bloqueo, para la UI y para el 409 del endpoint. Dice POR QUÉ, no
 *  "no cumplís los requisitos". */
export function restrictionBlockedMessage(r: GroupRestriction | null | undefined): string {
  const resumen = restrictionSummary(r)
  return resumen
    ? `Este grupo es solo para: ${resumen}.`
    : 'Este grupo tiene una restricción de audiencia que no cumplís.'
}

/** Código del 409 cuando alguien no cumple la restricción del grupo. */
export const RESTRICTION_ERROR_CODE = 'restriccion_grupo'
