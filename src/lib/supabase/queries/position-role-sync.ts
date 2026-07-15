// Sincronización de roles automáticos por puesto (encargado_eventos,
// lider_comite): se invoca desde TODO lugar que asigna/remueve a alguien de un
// puesto (individual o masivo — ver assignVolunteer/removeVolunteer en
// servers.ts y approveApplications en el mismo archivo). El mapeo puesto→rol
// vive en @/lib/servers/position-roles (código, extensible); acá solo se
// resuelve el contexto del puesto y se llama a los RPCs transaccionales
// grant_position_role/revoke_position_role (migración 123).
import { createAdminClient } from '@/lib/supabase/admin'
import { rolesGrantedByPosition, type PositionContext } from '@/lib/servers/position-roles'
import { logAudit } from '@/lib/audit'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
}

// El embed self-FK `parent:areas!areas_parent_id_fkey` es POCO FIABLE en
// PostgREST (mismo problema documentado en _area-map.ts) — se resuelve el
// área padre con una query aparte por parent_id en vez de un embed anidado.
async function getPositionContext(supabase: SupabaseAdmin, positionId: string): Promise<PositionContext | null> {
  const { data } = await supabase
    .from('service_positions')
    .select('title, area:areas!service_positions_area_id_fkey(name, area_type, parent_id)')
    .eq('id', positionId)
    .maybeSingle()
  if (!data) return null
  const row = data as { title: string; area: unknown }
  const area = one(row.area) as { name: string; area_type: 'area' | 'committee'; parent_id: string | null } | null
  if (!area) return null
  let parentAreaName: string | null = null
  if (area.parent_id) {
    const { data: parent } = await supabase.from('areas').select('name').eq('id', area.parent_id).maybeSingle()
    parentAreaName = (parent as { name: string } | null)?.name ?? null
  }
  return { title: row.title, areaName: area.name, areaType: area.area_type, parentAreaName }
}

/** Al asignar a alguien a un puesto: otorga (o respalda) los roles automáticos
 *  que ese puesto mapea, sin duplicar si ya lo tiene. `actorUserId` es opcional
 *  (ausente en procesos de sistema/migración) — se usa solo para auditoría. */
export async function syncRolesOnAssign(memberId: string, positionId: string, actorUserId?: string): Promise<void> {
  const supabase = createAdminClient()
  const ctx = await getPositionContext(supabase, positionId)
  if (!ctx) return
  const roles = rolesGrantedByPosition(ctx)
  for (const role of roles) {
    const { error } = await supabase.rpc('grant_position_role', {
      p_member_id: memberId, p_role: role, p_position_id: positionId,
    })
    if (error) { console.warn('syncRolesOnAssign:', role, error.message); continue }
    if (actorUserId) {
      await logAudit({
        actorUserId, action: 'ROLE_CHANGE', entityType: 'member_roles', entityId: memberId,
        newData: { role, op: 'auto_grant', position_id: positionId },
      })
    }
  }
}

/** Al remover a alguien de un puesto: quita el respaldo de ese puesto sobre
 *  los roles que mapea. El rol solo se retira de la persona si era automático
 *  y ya no queda ningún otro puesto que lo respalde (lo resuelve el RPC). */
export async function syncRolesOnRemove(memberId: string, positionId: string, actorUserId?: string): Promise<void> {
  const supabase = createAdminClient()
  const ctx = await getPositionContext(supabase, positionId)
  if (!ctx) return
  const roles = rolesGrantedByPosition(ctx)
  for (const role of roles) {
    const { error } = await supabase.rpc('revoke_position_role', {
      p_member_id: memberId, p_role: role, p_position_id: positionId,
    })
    if (error) { console.warn('syncRolesOnRemove:', role, error.message); continue }
    if (actorUserId) {
      await logAudit({
        actorUserId, action: 'ROLE_CHANGE', entityType: 'member_roles', entityId: memberId,
        newData: { role, op: 'auto_revoke', position_id: positionId },
      })
    }
  }
}
