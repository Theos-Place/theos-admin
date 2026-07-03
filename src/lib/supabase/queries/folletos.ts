import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { ROLES } from '@/lib/auth/roles'
import type { FolletoState } from '@/lib/studies/folletos'

// folleto_requests aún no está en los tipos generados (database.ts). Cliente laxo
// (sin genérico Database) solo para operar esa tabla sin romper el type-check.
function looseClient(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient
}

export type DbFolletoRequest = {
  id: string
  source_group_id: string | null
  source_plan_code: string | null
  target_level_code: string | null
  quantity: number
  sede: string | null
  close_date: string
  available_at: string
  status: FolletoState
  tipo: string
  bloque_id: string | null
  confirmed_by: string | null
  confirmed_at: string | null
  created_at: string
  source_group: { name: string | null } | null
  bloque: { nombre: string } | null
}

/** Ids de rol que otorgan el módulo 'folletos' (derivado de ROLES, no hardcodeado). */
function folletoRoleIds(): string[] {
  return ROLES
    .filter(r => r.permissions.some(p =>
      (p.module === 'all' || p.module === 'folletos') && (p.actions as string[]).includes('view')))
    .map(r => r.id)
}

/** Personas con el permiso de folletos activo (para notificaciones + correos). */
export async function getFolletoRecipients(): Promise<Array<{ member_id: string; email: string | null; name: string }>> {
  const supabase = createAdminClient()
  const roleIds = folletoRoleIds()
  if (roleIds.length === 0) return []
  const { data, error } = await supabase
    .from('member_roles')
    .select('member_id, member:members!member_roles_member_id_fkey(email, first_name, last_name, is_active)')
    .in('role', roleIds)
    .eq('is_active', true)
  if (error) { console.warn('getFolletoRecipients:', error.message); return [] }
  const byId = new Map<string, { member_id: string; email: string | null; name: string }>()
  for (const r of (data ?? []) as Array<{ member_id: string; member: { email: string | null; first_name: string; last_name: string; is_active: boolean } | null }>) {
    if (!r.member || r.member.is_active === false) continue
    byId.set(r.member_id, {
      member_id: r.member_id,
      email: r.member.email,
      name: `${r.member.first_name} ${r.member.last_name}`.trim(),
    })
  }
  return [...byId.values()]
}

/** Sede tomada del perfil del dirigente (líder) del grupo. */
export async function getLeaderSedeForGroup(groupId: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data: g } = await supabase.from('study_groups').select('leader_id').eq('id', groupId).maybeSingle()
  const leaderId = (g as { leader_id: string | null } | null)?.leader_id
  if (!leaderId) return null
  const { data: m } = await supabase
    .from('members').select('sede:sedes(name)').eq('id', leaderId).maybeSingle()
  const sede = (m as { sede: { name: string } | { name: string }[] | null } | null)?.sede
  const one = Array.isArray(sede) ? sede[0] : sede
  return one?.name ?? null
}

export async function createFolletoRequest(input: {
  source_group_id: string
  source_plan_code: string
  target_level_code: string
  quantity: number
  sede: string | null
  close_date: string
  available_at: string
  confirmed_by: string | null
}): Promise<{ id: string }> {
  const supabase = looseClient()
  const { data, error } = await supabase.from('folleto_requests').insert(input).select('id').single()
  if (error) throw error
  return data as { id: string }
}

export async function getFolletoRequests(filters: { sede?: string; status?: FolletoState; tipo?: string } = {}): Promise<DbFolletoRequest[]> {
  const supabase = looseClient()
  let q = supabase
    .from('folleto_requests')
    .select('id, source_group_id, source_plan_code, target_level_code, quantity, sede, close_date, available_at, status, tipo, bloque_id, confirmed_by, confirmed_at, created_at, source_group:study_groups(name), bloque:capacitacion_bloques(nombre)')
    .order('created_at', { ascending: false })
  if (filters.sede) q = q.eq('sede', filters.sede)
  if (filters.status) q = q.eq('status', filters.status)
  if (filters.tipo) q = q.eq('tipo', filters.tipo)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    source_group: Array.isArray(row.source_group) ? (row.source_group[0] ?? null) : row.source_group,
    bloque: Array.isArray(row.bloque) ? (row.bloque[0] ?? null) : row.bloque,
  })) as DbFolletoRequest[]
}

/** Cambio de estado (individual o en lote). */
export async function setFolletoRequestsStatus(ids: string[], status: FolletoState): Promise<{ updated: number }> {
  if (ids.length === 0) return { updated: 0 }
  const supabase = looseClient()
  const { error, count } = await supabase
    .from('folleto_requests')
    .update({ status, updated_at: new Date().toISOString() }, { count: 'exact' })
    .in('id', ids)
  if (error) throw error
  return { updated: count ?? ids.length }
}
