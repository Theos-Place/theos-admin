// SEC-1: alcance de LECTURA del módulo estudios por rol (lógica pura,
// compartida por las rutas API y testeable sin Supabase).
//
//  · 'all'    → ve todos los grupos (permiso estudios:view con scope más allá
//               de 'own': coordinadores, dirección, solo_lectura, admin,
//               editor_grupos_estudio).
//  · 'leader' → dirigente: SOLO sus grupos (leader_id o co_leader_id).
//  · 'member' → cualquier otra sesión: solo el grupo donde está inscrito
//               (vista de solo lectura), nada de gestión.
import { hasModulePermission } from './roles'
import type { RoleId } from '@/types/auth'

export type StudiesScope = 'all' | 'leader' | 'member'

export function studiesViewScope(roles: RoleId[]): StudiesScope {
  if (hasModulePermission(roles, 'estudios', 'view', { beyondOwn: true })) return 'all'
  if (roles.includes('dirigente')) return 'leader'
  return 'member'
}

/** Nivel de acceso a UN grupo concreto. El caller resuelve la pertenencia
 *  (leader/co-leader del grupo, inscripción del miembro) y esta función decide.
 *  'none' = sesión sin relación con el grupo: recibe el grupo SIN roster
 *  (comportamiento histórico para p. ej. la confirmación de matrícula). */
export type GroupViewerScope = 'admin' | 'leader' | 'member' | 'none'

export function groupViewerScope(input: {
  roles: RoleId[]
  memberId: string | null
  group: { leader_id: string | null; co_leader_id: string | null }
  isEnrolled: boolean
}): GroupViewerScope {
  if (studiesViewScope(input.roles) === 'all') return 'admin'
  const m = input.memberId
  if (m && (input.group.leader_id === m || input.group.co_leader_id === m)) return 'leader'
  if (input.isEnrolled) return 'member'
  return 'none'
}
