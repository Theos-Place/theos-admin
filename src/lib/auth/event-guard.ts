import 'server-only'
import { NextResponse } from 'next/server'
import { getAuthContext, type AuthContext } from '@/lib/auth/guard'
import {
  eventViewerScope, canManageEvent, isEventAdmin, hasEventsModule, NO_ES_ENCARGADO, type EventViewerScope,
} from '@/lib/auth/events-scope'
import { alcanceDeEventos, puedeOperarEvento, NO_ES_DE_TU_COMITE, type AlcanceDeEventos } from '@/lib/auth/alcance-de-eventos'
import {
  isEventManager, isManagerOfFormEvent, datosDeAlcanceDeEventos, eventOrganizingCommitteeIds,
  comitesDePuertaDelEvento,
} from '@/lib/supabase/queries/events'
import type { RoleId } from '@/types/auth'

/**
 * EVE-12 · Hasta dónde llega el rol de eventos de ESTA sesión.
 *
 * Atajo deliberado: si administra eventos (dirección, staff, comunicaciones,
 * admin) se responde sin tocar la base. El check-in de un miércoles corre por
 * acá en cada marca, y esas dos consultas solo hacen falta para los 184 que
 * tienen el rol por su puesto.
 */
export async function alcanceDeEventosDeLaSesion(ctx: AuthContext): Promise<AlcanceDeEventos> {
  // Las dos salidas que no dependen de la base van primero, y no por elegancia:
  // esto corre en cada marca de check-in.
  if (isEventAdmin(ctx.roles)) return { alcance: 'todos' }
  if (!hasEventsModule(ctx.roles)) return { alcance: 'ninguno' }
  const datos = await datosDeAlcanceDeEventos(ctx.memberId)
  return alcanceDeEventos({
    roles: ctx.roles,
    rolesAutomaticos: datos.rolesAutomaticos as RoleId[],
    comitesDeSusPuestos: datos.comitesDeSusPuestos,
  })
}

/**
 * Guard de UN evento (FRM-1 parte B): pasa si la sesión administra eventos o si
 * es ENCARGADA de ese evento en particular. Devuelve además el alcance, por si
 * el handler quiere recortar el payload.
 *
 * Existe para no repetir en cada ruta "requireRoles(...EVENT_ADMIN) O buscar en
 * event_managers": era exactamente el olvido fácil que deja un endpoint abierto.
 */
export async function requireEventAccess(
  eventId: string,
  opciones: { puerta?: boolean } = {},
): Promise<
  { ctx: AuthContext; scope: EventViewerScope; res?: undefined } | { ctx?: undefined; scope?: undefined; res: NextResponse }
> {
  const ctx = await getAuthContext()
  if (!ctx) return { res: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }

  // EVE-12: quien tiene el rol por su PUESTO solo opera los eventos de sus
  // comités. Se resuelve antes que eventViewerScope porque esa función le da
  // 'admin' a cualquiera con el módulo, que es justamente lo que se acota.
  const alcance = await alcanceDeEventosDeLaSesion(ctx)
  if (alcance.alcance === 'comites') {
    // CHK-4: en la PUERTA cuenta la familia (evento + subeventos); en todo lo
    // demás, solo los comités del evento. El default es el angosto a propósito:
    // olvidarse de `puerta` deja a alguien sin poder marcar —se reporta en el
    // momento— mientras que un default ancho abriría la edición en silencio.
    const comites = opciones.puerta
      ? await comitesDePuertaDelEvento(eventId)
      : await eventOrganizingCommitteeIds(eventId)
    if (puedeOperarEvento(alcance, comites)) {
      // Sobre SU evento puede lo mismo que antes; no se le recorta el payload.
      return { ctx, scope: 'admin' }
    }
    // Todavía le queda la otra puerta: que la hayan nombrado encargada de ESE
    // evento a mano, aunque no sea de su comité.
    if (await isEventManager(eventId, ctx.memberId)) return { ctx, scope: 'manager' }
    return { res: NextResponse.json({ error: NO_ES_DE_TU_COMITE, code: 'otro_comite' }, { status: 403 }) }
  }

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
 * edición, el encargado del evento al que ese formulario pertenece (la herencia
 * de FRM-1 B), o quien tenga un ACCESO PUNTUAL a ese formulario.
 *
 * Lo del acceso puntual es una decisión del usuario del 2026-09-11 que revierte
 * la regla anterior ("el grant es de lectura"): a quien se le comparte un
 * formulario es porque esa actividad es suya, igual que el encargado de un
 * evento con el formulario de su evento. Sigue siendo POR FORMULARIO — no le
 * abre ningún otro, ni el listado completo, ni crear formularios nuevos.
 */
export async function requireFormEdit(formId: string): Promise<
  { ctx: AuthContext; res?: undefined } | { ctx?: undefined; res: NextResponse }
> {
  const ctx = await getAuthContext()
  if (!ctx) return { res: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  const { hasModulePermission } = await import('@/lib/auth/roles')
  if (hasModulePermission(ctx.roles, 'formularios', 'edit')) return { ctx }
  if (await isManagerOfFormEvent(formId, ctx.memberId)) return { ctx }
  const { hasFormAccessGrant } = await import('@/lib/supabase/queries/forms')
  if (await hasFormAccessGrant(formId, ctx.memberId)) return { ctx }
  return { res: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
}
