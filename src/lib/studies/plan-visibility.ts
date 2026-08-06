// EST-11 · Qué planes de estudio se ven y en qué orden. Puro: lo usan la página
// del plan, el endpoint que sirve los planes y la matrícula.
//
// 1) DESACTIVADOS: los ve solo quien administra estudios. Para el resto —incluido
//    el rol miembro— no salen en gris: NO SALEN. Y no viajan en el payload
//    tampoco, para que no alcance con adivinar la URL.
// 2) CAMPAÑAS SIEMPRE AL FINAL, después de todas las etapas.
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import type { RoleId } from '@/types/auth'

/** Orden canónico de las etapas. Fuente única: si acá cambia, cambia en todos
 *  lados. Campañas van últimas — son estudios especiales, no una etapa más del
 *  camino. */
export const STAGE_ORDER = ['niveles', 'inicial', 'intermedia', 'avanzada', 'campaña'] as const

export type PlanStage = (typeof STAGE_ORDER)[number]

/** Posición de una etapa en el orden canónico. Una etapa desconocida va al
 *  final, nunca en medio. */
export function stageRank(stage: string | null | undefined): number {
  const i = (STAGE_ORDER as readonly string[]).indexOf(stage ?? '')
  return i === -1 ? STAGE_ORDER.length : i
}

/** ¿Estos roles pueden ver los estudios DESACTIVADOS? */
export function canSeeArchivedPlans(roles: readonly RoleId[] | null | undefined): boolean {
  return (roles ?? []).some(r => STUDY_ADMIN_ROLES.includes(r))
}

type PlanLike = { is_archived?: boolean | null; is_active?: boolean | null }

/** ¿Este plan está desactivado? Acepta las dos formas: el tipo de dominio usa
 *  `is_archived`, la fila de BD usa `is_active`. */
export function isArchivedPlan(p: PlanLike): boolean {
  if (typeof p.is_archived === 'boolean') return p.is_archived
  if (typeof p.is_active === 'boolean') return !p.is_active
  return false
}

/** Filtra los desactivados para quien no puede verlos. */
export function visiblePlans<T extends PlanLike>(plans: readonly T[], canSeeArchived: boolean): T[] {
  return canSeeArchived ? [...plans] : plans.filter(p => !isArchivedPlan(p))
}

/** Comparador por etapa (campañas al final) y, dentro de una etapa, los
 *  desactivados de últimos. El orden fino dentro de cada etapa lo pone quien
 *  llama — acá solo se garantiza lo que es regla del sistema. */
export function byStageThenArchived<T extends PlanLike & { stage?: string | null }>(a: T, b: T): number {
  const arch = Number(isArchivedPlan(a)) - Number(isArchivedPlan(b))
  if (arch !== 0) return arch
  return stageRank(a.stage) - stageRank(b.stage)
}
