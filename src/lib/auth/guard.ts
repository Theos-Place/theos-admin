import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { RoleId } from '@/types/auth'

export type AuthContext = { userId: string; memberId: string | null; roles: RoleId[] }

/** Lee la sesión y resuelve member + roles activos. null si no hay sesión. */
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: member } = await admin
    .from('members').select('id').eq('auth_user_id', user.id).maybeSingle()
  if (!member) return { userId: user.id, memberId: null, roles: [] }

  const { data: roleRows } = await admin
    .from('member_roles').select('role').eq('member_id', (member as { id: string }).id).eq('is_active', true)
  const explicit = (roleRows ?? []).map(r => (r as { role: RoleId }).role)
  return {
    userId: user.id,
    memberId: (member as { id: string }).id,
    roles: explicit.length ? explicit : ['miembro'],
  }
}

/**
 * Guard para rutas API. Úsalo al inicio del handler:
 *   const auth = await requireRoles('admin', 'editor_perfiles')
 *   if (auth.res) return auth.res
 *   // auth.ctx disponible
 * Sin roles → solo exige estar autenticado. `admin` siempre pasa.
 */
export async function requireRoles(
  ...roles: RoleId[]
): Promise<{ ctx: AuthContext; res?: undefined } | { ctx?: undefined; res: NextResponse }> {
  const ctx = await getAuthContext()
  if (!ctx) return { res: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  const allowed = roles.length === 0 || ctx.roles.includes('admin') || roles.some(r => ctx.roles.includes(r))
  if (!allowed) return { res: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  return { ctx }
}
