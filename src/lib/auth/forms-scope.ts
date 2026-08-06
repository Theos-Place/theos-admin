// Quién puede LEER las respuestas de un formulario. Puro (sin Supabase),
// mismo molde que groupViewerScope de studies-scope.ts: el caller resuelve los
// datos (roles de la sesión, si hay un acceso puntual) y esta función decide.
//
// Dos caminos de acceso:
//  · 'admin'   → el módulo `formularios` (rol forms, comunicaciones,
//                encargado_staff, dirección, admin, solo_lectura): TODOS los
//                formularios.
//  · 'event_manager' → encargada del EVENTO al que pertenece el formulario
//                (tabla event_managers): lo ve, lo exporta y SÍ puede editarlo
//                — organiza esa actividad (decisión 2026-08-06).
//  · 'grantee' → acceso puntual a ESE formulario (tabla form_access_grants):
//                lee y exporta sus respuestas, y ningún otro formulario.
//                NO puede editar la estructura del formulario — eso sigue
//                siendo del módulo.
//  · 'none'    → no ve respuestas.
//
// NOTA sobre hacerlo polimórfico (accesos a eventos y grupos con una sola
// tabla): se dejó específico de formularios a propósito. Un `entity_type` +
// `entity_id` sin FK real deja grants colgando cuando se borra el padre y
// obliga a validar el tipo a mano en cada lectura. Cuando eventos o grupos lo
// necesiten, van sus tablas hermanas (event_access_grants, …) y esta función se
// copia con su propio nombre: 20 líneas duplicadas a cambio de integridad
// referencial y una autorización que se lee de un vistazo.
import { hasModulePermission } from './roles'
import type { RoleId } from '@/types/auth'

export type FormViewerScope = 'admin' | 'event_manager' | 'grantee' | 'none'

/** ¿Los roles dan el módulo de formularios completo? */
export function hasFormsModule(roles: readonly RoleId[] | null | undefined): boolean {
  return hasModulePermission([...(roles ?? [])], 'formularios', 'view')
}

export function formViewerScope(input: {
  roles: readonly RoleId[] | null | undefined
  memberId: string | null
  /** El formulario en cuestión (solo se necesita su id). */
  form: { id: string } | null
  /** ¿Existe un acceso puntual de esta persona a ESE formulario? */
  hasGrant: boolean
  /** FRM-1 B: ¿es encargada del EVENTO al que pertenece este formulario?
   *  El permiso del evento se HEREDA a su formulario — por eso alcanza con dos
   *  tablas con FK real en vez de una polimórfica. */
  isEventManager?: boolean
}): FormViewerScope {
  if (hasFormsModule(input.roles)) return 'admin'
  if (input.form && input.memberId && input.isEventManager) return 'event_manager'
  if (input.form && input.memberId && input.hasGrant) return 'grantee'
  return 'none'
}

/** ¿Puede exportar las respuestas? El acceso puntual incluye la exportación
 *  (decisión 2026-08-04: para eso se da). */
export function canExportFormResponses(scope: FormViewerScope): boolean {
  return scope !== 'none'
}

/** ¿Puede editar la ESTRUCTURA del formulario? Solo el módulo, nunca el
 *  acceso puntual. La acción concreta la sigue validando el guard de escritura. */
export function canEditFormStructure(scope: FormViewerScope): boolean {
  // El encargado del evento sí edita el formulario de SU evento; el acceso
  // puntual a un formulario suelto, no.
  return scope === 'admin' || scope === 'event_manager'
}

/**
 * Dónde va "Formularios" en el menú.
 *
 * Formularios vive como SUB-ÍTEM de Comunicaciones. El problema (bug 2026-08-04):
 * el módulo padre solo se pinta con `comunicaciones:view`, así que quien llega a
 * formularios por otro camino —el rol `forms`, o un acceso puntual a un
 * formulario— nunca veía el hijo aunque su permiso estuviera bien.
 *
 *   · 'submenu'   → tiene Comunicaciones: va adentro, como siempre.
 *   · 'top_level' → alcanza formularios pero NO Comunicaciones: entrada propia
 *                   de primer nivel (el resto del submenú —plantillas, envíos,
 *                   configuración— no le sirve y no debe aparecerle).
 *   · 'none'      → no ve formularios.
 */
export type FormsNavPlacement = 'submenu' | 'top_level' | 'none'

export function formsNavPlacement(input: {
  roles: readonly RoleId[] | null | undefined
  /** form_access_grants de la sesión (granted_form_ids de /api/auth/me). */
  grantedFormIds?: readonly string[] | null
}): FormsNavPlacement {
  const alcanzaFormularios = hasFormsModule(input.roles) || (input.grantedFormIds ?? []).length > 0
  if (!alcanzaFormularios) return 'none'
  const tieneComunicaciones = hasModulePermission([...(input.roles ?? [])], 'comunicaciones', 'view')
  return tieneComunicaciones ? 'submenu' : 'top_level'
}
