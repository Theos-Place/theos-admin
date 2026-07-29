// EVE-3: qué acciones de la página de eventos ve cada rol (regla pura,
// compartida por la página, /eventos/embed y testeable).
import { EVENT_CHECKIN_ROLES } from '@/lib/auth/roles'
import type { RoleId } from '@/types/auth'

/** "Compartir calendario" (embed/link público): SOLO admin y comunicaciones
 *  (decisión EVE-3: dirección queda fuera de esta acción). */
export const CALENDAR_SHARE_ROLES: RoleId[] = ['comunicaciones', 'admin']

export function eventPageActions(roles: RoleId[]): { share: boolean; checkin: boolean } {
  return {
    share: roles.some(r => CALENDAR_SHARE_ROLES.includes(r)),
    // EVENT_CHECKIN_ROLES incluye 'direccion' — se mantiene a propósito (es la
    // constante existente que ya exigen los endpoints de check-in).
    checkin: roles.some(r => (EVENT_CHECKIN_ROLES as RoleId[]).includes(r)),
  }
}
