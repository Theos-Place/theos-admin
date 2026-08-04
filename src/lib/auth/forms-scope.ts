// Quién puede LEER las respuestas de un formulario. Puro (sin Supabase),
// mismo molde que groupViewerScope de studies-scope.ts: el caller resuelve los
// datos (roles de la sesión, si hay un acceso puntual) y esta función decide.
//
// Dos caminos de acceso:
//  · 'admin'   → el módulo `formularios` (rol forms, comunicaciones,
//                encargado_staff, dirección, admin, solo_lectura): TODOS los
//                formularios.
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

export type FormViewerScope = 'admin' | 'grantee' | 'none'

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
}): FormViewerScope {
  if (hasFormsModule(input.roles)) return 'admin'
  if (input.form && input.memberId && input.hasGrant) return 'grantee'
  return 'none'
}

/** ¿Puede exportar las respuestas? El acceso puntual incluye la exportación
 *  (decisión 2026-08-04: para eso se da). */
export function canExportFormResponses(scope: FormViewerScope): boolean {
  return scope === 'admin' || scope === 'grantee'
}

/** ¿Puede editar la ESTRUCTURA del formulario? Solo el módulo, nunca el
 *  acceso puntual. La acción concreta la sigue validando el guard de escritura. */
export function canEditFormStructure(scope: FormViewerScope): boolean {
  return scope === 'admin'
}
