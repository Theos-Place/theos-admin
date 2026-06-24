import 'server-only'
import { SERVICE_ADMIN_ROLES, type RoleId } from '@/lib/auth/roles'
import { getManageableCommitteeIds } from '@/lib/supabase/queries/servers'

/** Roles que gestionan vacantes/puestos de CUALQUIER comité (sin límite por comité). */
export function isGlobalServiceAdmin(roles: RoleId[]): boolean {
  return roles.some(r => (SERVICE_ADMIN_ROLES as string[]).includes(r))
}

/**
 * ¿El usuario puede gestionar (crear/editar/borrar) vacantes/puestos del comité dado?
 *  · Roles administrativos globales → sí, cualquier comité.
 *  · Si no: debe coordinar ese comité (areas.leader_id) o liderar su ÁREA padre.
 */
export async function canManageCommittee(
  roles: RoleId[],
  memberId: string | null,
  committeeId: string | null | undefined,
): Promise<boolean> {
  if (isGlobalServiceAdmin(roles)) return true
  if (!memberId || !committeeId) return false
  const ids = await getManageableCommitteeIds(memberId)
  return ids.includes(committeeId)
}
