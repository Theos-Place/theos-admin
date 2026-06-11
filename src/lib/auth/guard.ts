import { timingSafeEqual } from 'crypto'
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

/** Comparación de secretos en tiempo constante (CRON_SECRET y similares). */
export function secretsMatch(provided: string | null | undefined, expected: string | null | undefined): boolean {
  if (!provided || !expected) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * member_id efectivo para escrituras "a nombre de otro" (anti-suplantación,
 * auditoría 2026-06-11 S2): los roles privilegiados (y admin) pueden enviar
 * cualquier member_id; el resto queda forzado a su propio perfil aunque el
 * body diga otra cosa.
 */
export function resolveTargetMemberId(
  ctx: AuthContext,
  requested: unknown,
  privilegedRoles: RoleId[],
): string | null {
  const isPrivileged = ctx.roles.includes('admin') || privilegedRoles.some(r => ctx.roles.includes(r))
  if (isPrivileged && typeof requested === 'string' && requested) return requested
  return ctx.memberId
}

/**
 * Guard por PERMISO de módulo (espejo server-side de can() del cliente):
 * pasa si alguno de los roles del usuario otorga 'view' sobre el módulo
 * (o sobre 'all', como admin/solo_lectura). A diferencia de requireRoles,
 * no hay que enumerar roles por ruta — la fuente de verdad es ROLES.
 * Multi-rol funciona solo: coordinador_estudios + comunicaciones ve comunicaciones.
 */
export async function requireModuleView(
  module: string,
): Promise<{ ctx: AuthContext; res?: undefined } | { ctx?: undefined; res: NextResponse }> {
  const ctx = await getAuthContext()
  if (!ctx) return { res: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  const { ROLES } = await import('@/data/mock-auth')
  const allowed = ctx.roles.some(roleId => {
    const role = ROLES.find(r => r.id === roleId)
    return role?.permissions.some(p => (p.module === 'all' || p.module === module) && p.actions.includes('view'))
  })
  if (!allowed) return { res: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  return { ctx }
}
