// FRM-1 parte B · Quién puede gestionar UN evento. Puro (sin Supabase), mismo
// molde que groupViewerScope y formViewerScope: el caller resuelve los datos y
// esta función decide.
//
//   · 'admin'   → el módulo `eventos` (encargado_eventos, dirección, admin,
//                 solo_lectura) o los roles que administran eventos: TODOS.
//   · 'manager' → encargado de ESE evento (tabla event_managers). Ve y gestiona
//                 su evento —inscripciones, check-in, edición— y su formulario;
//                 ningún otro evento.
//   · 'none'    → nada.
//
// La HERENCIA del formulario vive acá y no en la base: un formulario con
// entity_type='event' lo ve y lo edita el encargado del evento padre. Por eso
// alcanzan dos tablas con FK real (event_managers y form_access_grants) en vez
// de una polimórfica sin integridad — decisión de TI 2026-08-06.
import { hasModulePermission } from './roles'
import type { RoleId } from '@/types/auth'

/** Roles que administran eventos: crean, editan y nombran encargados. */
export const EVENT_ADMIN_ROLES: RoleId[] = ['direccion', 'encargado_staff', 'comunicaciones', 'admin']

export type EventViewerScope = 'admin' | 'manager' | 'none'

/** ¿Los roles dan el módulo de eventos completo? */
export function hasEventsModule(roles: readonly RoleId[] | null | undefined): boolean {
  return hasModulePermission([...(roles ?? [])], 'eventos', 'view')
}

/** ¿Los roles administran eventos (crear, editar, nombrar encargados)? */
export function isEventAdmin(roles: readonly RoleId[] | null | undefined): boolean {
  return (roles ?? []).some(r => EVENT_ADMIN_ROLES.includes(r))
}

export function eventViewerScope(input: {
  roles: readonly RoleId[] | null | undefined
  memberId: string | null
  /** El evento en cuestión (solo se usa su id). */
  event: { id: string } | null
  /** ¿Esta persona está en event_managers de ESE evento? */
  isManager: boolean
}): EventViewerScope {
  if (isEventAdmin(input.roles) || hasEventsModule(input.roles)) return 'admin'
  if (input.event && input.memberId && input.isManager) return 'manager'
  return 'none'
}

/** ¿Puede EDITAR el evento (fechas, cupo, precio) y su formulario?
 *  Decisión 2026-08-06: el encargado sí — organiza la actividad, y tener que
 *  pedirle a otro que le cambie una hora hace el permiso inútil. */
export function canManageEvent(scope: EventViewerScope): boolean {
  return scope === 'admin' || scope === 'manager'
}

/** ¿Puede nombrar y quitar encargados? Solo quien administra eventos: el
 *  encargado recibe el permiso, no lo reparte. */
export function canGrantEventManagers(roles: readonly RoleId[] | null | undefined): boolean {
  return isEventAdmin(roles)
}

/** Mensaje único del 403 cuando alguien no tiene ese evento a cargo. */
export const NO_ES_ENCARGADO = 'No tenés este evento a cargo.'
