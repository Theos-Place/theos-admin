// Quién puede recibir, ver y trabajar una solicitud de estudios (reubicación /
// interés). Decisión 2026-07-31: además de los coordinadores, se puede asignar a
// cualquier miembro con puesto activo en el COMITÉ DE ESTUDIOS BÍBLICOS — y para
// que eso sirva de algo, el asignado entra a la pantalla y ve SOLO lo suyo.
//
// Puro (sin Supabase): lo usan el guard de la API, la pantalla y el listado de
// asignables, así que la regla es una sola.

import type { RoleId } from '@/types/auth'

/** Nombre del comité en `areas` (area_type='committee'). Se compara sin acentos
 *  ni mayúsculas, así que "Comite de Estudios Biblicos" también matchea. Si el
 *  comité se renombra en la BD, hay que actualizarlo acá. */
export const STUDY_COMMITTEE_AREA_NAME = 'Comité de Estudios Bíblicos'

/** Roles que ven la cola COMPLETA y pueden asignar. */
export const REQUEST_COORDINATOR_ROLES: RoleId[] = [
  'direccion', 'coordinador_estudios', 'coordinador_dirigentes', 'admin',
]

/** 'all' = toda la cola (coordinadores) · 'assigned' = solo lo asignado a esa
 *  persona (comité) · 'none' = no entra. */
export type RequestQueueScope = 'all' | 'assigned' | 'none'

export function normalizeAreaName(name: string): string {
  return name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

export function isStudyCommitteeArea(name: string | null | undefined): boolean {
  return !!name && normalizeAreaName(name) === normalizeAreaName(STUDY_COMMITTEE_AREA_NAME)
}

export function requestQueueScope(input: {
  roles: readonly string[] | null | undefined
  /** ¿Tiene puesto ACTIVO en el comité de estudios bíblicos? */
  inStudyCommittee?: boolean
}): RequestQueueScope {
  const roles = input.roles ?? []
  if (roles.some(r => (REQUEST_COORDINATOR_ROLES as string[]).includes(r))) return 'all'
  if (input.inStudyCommittee) return 'assigned'
  return 'none'
}

/** Asignar (y tomar) sigue siendo de los coordinadores: el comité recibe trabajo,
 *  no lo reparte. */
export function canAssignRequests(roles: readonly string[] | null | undefined): boolean {
  return (roles ?? []).some(r => (REQUEST_COORDINATOR_ROLES as string[]).includes(r))
}

/** ¿A esta persona se le puede asignar una solicitud? */
export function canBeAssigned(input: {
  roles: readonly string[] | null | undefined
  inStudyCommittee?: boolean
}): boolean {
  return requestQueueScope(input) !== 'none'
}

/** ¿Puede trabajar (resolver / rechazar) ESTA solicitud? El del comité, solo la
 *  que le asignaron; el coordinador, cualquiera. */
export function canWorkRequest(
  scope: RequestQueueScope,
  request: { reviewed_by?: string | null },
  memberId: string | null,
): boolean {
  if (scope === 'all') return true
  if (scope === 'none' || !memberId) return false
  return request.reviewed_by === memberId
}
