import 'server-only'
import { NextResponse } from 'next/server'
import { getAuthContext, type AuthContext } from '@/lib/auth/guard'
import { eventViewerScope, canManageEvent, NO_ES_ENCARGADO, type EventViewerScope } from '@/lib/auth/events-scope'
import { isEventManager, isManagerOfFormEvent } from '@/lib/supabase/queries/events'

/**
 * Guard de UN evento (FRM-1 parte B): pasa si la sesión administra eventos o si
 * es ENCARGADA de ese evento en particular. Devuelve además el alcance, por si
 * el handler quiere recortar el payload.
 *
 * Existe para no repetir en cada ruta "requireRoles(...EVENT_ADMIN) O buscar en
 * event_managers": era exactamente el olvido fácil que deja un endpoint abierto.
 */
export async function requireEventAccess(eventId: string): Promise<
  { ctx: AuthContext; scope: EventViewerScope; res?: undefined } | { ctx?: undefined; scope?: undefined; res: NextResponse }
> {
  const ctx = await getAuthContext()
  if (!ctx) return { res: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  const scope = eventViewerScope({
    roles: ctx.roles,
    memberId: ctx.memberId,
    event: { id: eventId },
    isManager: await isEventManager(eventId, ctx.memberId),
  })
  if (!canManageEvent(scope)) {
    return { res: NextResponse.json({ error: NO_ES_ENCARGADO, code: 'no_encargado' }, { status: 403 }) }
  }
  return { ctx, scope }
}

/**
 * Guard de EDICIÓN de un formulario: el módulo formularios con permiso de
 * edición, o el encargado del evento al que ese formulario pertenece (la
 * herencia de FRM-1 B).
 */
export async function requireFormEdit(formId: string): Promise<
  { ctx: AuthContext; res?: undefined } | { ctx?: undefined; res: NextResponse }
> {
  const ctx = await getAuthContext()
  if (!ctx) return { res: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  const { hasModulePermission } = await import('@/lib/auth/roles')
  if (hasModulePermission(ctx.roles, 'formularios', 'edit')) return { ctx }
  if (await isManagerOfFormEvent(formId, ctx.memberId)) return { ctx }
  return { res: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
}
