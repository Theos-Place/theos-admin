// DIR-6 · Estados administrativos del dirigente.
//
// Activo/inactivo no alcanza: al coordinador le importa POR QUÉ alguien no está
// activo. Un descanso acordado y una situación bajo evaluación se gestionan
// distinto, y hoy los dos se ven igual.
//
// SE REUTILIZA `study_leaders.availability_status` en vez de agregar un campo
// paralelo. La columna ya existía con cuatro valores, pero en la práctica solo
// se usaban dos —available (126) e inactive (359)— porque ninguna pantalla la
// editaba: era un espejo de is_active. `resting` ya estaba, así que "en pausa"
// es solo una ETIQUETA nueva sobre un valor viejo; lo único que se agrega es
// `en_revision`.
//
// CONFIDENCIALIDAD: "en revisión" dice que hay una situación abierta con una
// persona. Fuera del grupo que la gestiona, un dirigente en pausa o en revisión
// se ve simplemente como inactivo — mismo criterio que la retro de DIR-5.

import type { RoleId } from '@/types/auth'

export const LEADER_STATUSES = ['available', 'assigned', 'resting', 'en_revision', 'inactive'] as const
export type LeaderStatus = typeof LEADER_STATUSES[number]

/** Quién ve y edita el matiz. Lista corta y a propósito: 'direccion' NO está,
 *  aunque tenga el módulo estudios completo. Es la misma decisión de DIR-5 —
 *  quién ve información delicada sobre una persona se resuelve nombrando roles,
 *  no heredando privilegio. */
export const LEADER_ADMIN_ROLES: RoleId[] = ['coordinador_dirigentes', 'coordinador_estudios', 'admin']

export function canSeeLeaderAdminStatus(roles: readonly string[] | null | undefined): boolean {
  return (roles ?? []).some(r => (LEADER_ADMIN_ROLES as readonly string[]).includes(r))
}

/** Los dos estados que solo existen para quien administra dirigentes. */
export const ADMIN_ONLY_STATUSES: LeaderStatus[] = ['resting', 'en_revision']

export const LEADER_STATUS_LABEL: Record<LeaderStatus, string> = {
  available:   'Disponible',
  assigned:    'Asignado',
  // "En pausa", no "Descansando": es un acuerdo administrativo, no un estado
  // de ánimo, y así lo nombra el coordinador.
  resting:     'En pausa',
  en_revision: 'En revisión',
  inactive:    'Inactivo',
}

/**
 * El estado tal como lo puede ver ESTE observador.
 *
 * Para quien no administra dirigentes, los matices colapsan a 'inactive'. No es
 * una etiqueta distinta sobre el mismo dato: es otro dato, y por eso la función
 * devuelve el valor colapsado en vez de solo cambiar el texto — así lo que sale
 * por el API ya viene saneado y no depende de que la UI se acuerde.
 */
export function visibleLeaderStatus(
  status: string | null | undefined,
  canSeeNuance: boolean,
): LeaderStatus {
  const s = (status ?? 'available') as LeaderStatus
  if (!LEADER_STATUSES.includes(s)) return 'available'
  if (canSeeNuance) return s
  return (ADMIN_ONLY_STATUSES as readonly string[]).includes(s) ? 'inactive' : s
}

/** ¿Este estado impide activar o asignar grupo? */
export function blocksAssignment(status: string | null | undefined): boolean {
  return status === 'en_revision'
}

/** El mensaje cuando se intenta asignarle un grupo a alguien en revisión.
 *  No dice de qué se lo está revisando: eso es del coordinador, no del sistema. */
export const EN_REVISION_BLOCK_MESSAGE =
  'Este dirigente está en revisión; contactá al coordinador de dirigentes.'

/**
 * ¿Se puede pasar a este estado desde la UI?
 *
 * 'assigned' queda fuera: lo derivaría el sistema de tener un grupo activo, y
 * dejarlo elegir a mano crearía un estado que se contradice con la realidad.
 * Nadie lo usa hoy (0 filas) y esto no lo empieza a usar.
 */
export const SETTABLE_STATUSES: LeaderStatus[] = ['available', 'resting', 'en_revision', 'inactive']
