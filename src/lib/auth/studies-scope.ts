// SEC-1: alcance de LECTURA del módulo estudios por rol (lógica pura,
// compartida por las rutas API y testeable sin Supabase).
//
//  · 'all'    → ve todos los grupos (permiso estudios:view con scope más allá
//               de 'own': coordinadores, dirección, solo_lectura, admin,
//               editor_grupos_estudio).
//  · 'leader' → dirigente: SOLO sus grupos (leader_id o co_leader_id).
//  · 'member' → cualquier otra sesión: solo el grupo donde está inscrito
//               (vista de solo lectura), nada de gestión.
import { hasModulePermission, EVALUATION_ROLES } from './roles'
import type { RoleId } from '@/types/auth'

export type StudiesScope = 'all' | 'leader' | 'member'

export function studiesViewScope(roles: RoleId[]): StudiesScope {
  if (hasModulePermission(roles, 'estudios', 'view', { beyondOwn: true })) return 'all'
  if (roles.includes('dirigente')) return 'leader'
  return 'member'
}

/**
 * Rutas de /estudios que abre el rol acotado de grupos (editor_grupos_estudio
 * sin ningún rol de estudios completo): el listado y todo lo que cuelga del
 * detalle de un grupo. El resumen (/estudios) y las secciones de coordinación
 * (plan, bloques, dirigentes, análisis, solicitudes, folletos, importar) quedan
 * fuera. Puro: lo usa el ModuleGuard de las páginas y es testeable sin React.
 */
export function studyGroupsOnlyAllows(pathname: string): boolean {
  return pathname === '/estudios/grupos' || pathname.startsWith('/estudios/grupos/')
}

/**
 * ROL-1 · Rutas de /estudios que abre el rol acotado `editor_dirigentes`: la
 * sección de dirigentes y lo que cuelga de ella (el detalle, confirmaciones y
 * disponibilidad). El resumen y el resto de la coordinación —plan, bloques,
 * grupos, análisis, solicitudes, folletos, importar, evaluaciones— quedan
 * fuera.
 *
 * Espejo exacto de `studyGroupsOnlyAllows`, y por la misma razón: el rol lleva
 * el módulo `estudios` para poder ENTRAR a la sección, así que sin este
 * recorte por ruta se llevaría el módulo entero.
 */
export function dirigentesOnlyAllows(pathname: string): boolean {
  return pathname === '/estudios/dirigentes' || pathname.startsWith('/estudios/dirigentes/')
}

/** Nivel de acceso a UN grupo concreto. El caller resuelve la pertenencia
 *  (leader/co-leader del grupo, inscripción del miembro) y esta función decide.
 *  'none' = sesión sin relación con el grupo: recibe el grupo SIN roster
 *  (comportamiento histórico para p. ej. la confirmación de matrícula). */
export type GroupViewerScope = 'admin' | 'leader' | 'evaluador' | 'member' | 'none'

export function groupViewerScope(input: {
  roles: RoleId[]
  memberId: string | null
  group: { leader_id: string | null; co_leader_id: string | null }
  isEnrolled: boolean
}): GroupViewerScope {
  if (studiesViewScope(input.roles) === 'all') return 'admin'
  const m = input.memberId
  if (m && (input.group.leader_id === m || input.group.co_leader_id === m)) return 'leader'
  // RET-2 (2026-10-29): el comité de evaluaciones abre el grupo que le enlaza
  // su tiquete («Ver el compilado»). Sin esto, Eimy —rol `evaluaciones` y nada
  // más— llegaba a «Acceso restringido» desde su propia cola. Ve el grupo como
  // un estudiante (sin contacto del dirigente, roster solo con nombres) y
  // además el compilado; la API de leader-feedback ya la dejaba pasar.
  if (input.roles.some(r => (EVALUATION_ROLES as readonly string[]).includes(r))) return 'evaluador'
  if (input.isEnrolled) return 'member'
  return 'none'
}

/**
 * RET-2 · Rutas de /estudios que abre el rol acotado `evaluaciones` además de su
 * cola: SOLO el detalle de un grupo (es donde vive el compilado que le enlaza
 * cada tiquete). Ni el listado de grupos, ni asistencia, ni cierre, ni edición.
 */
export function evaluadorAllows(pathname: string): boolean {
  return /^\/estudios\/grupos\/[0-9a-f-]{36}$/i.test(pathname)
}
