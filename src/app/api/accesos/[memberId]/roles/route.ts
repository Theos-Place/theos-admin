import { NextRequest, NextResponse } from 'next/server'
import { assignMemberRole, revokeMemberRole } from '@/lib/supabase/queries/members'
import { requireRoles } from '@/lib/auth/guard'
import { logAudit } from '@/lib/audit'
import { ROLES, assignableRoleIds, ACCESOS_SCREEN_ROLES } from '@/lib/auth/roles'
import type { RoleId } from '@/types/auth'
import { isUuid } from '@/lib/validate'

// Derivado de ROLES para que nunca se desincronice con los roles reales del sistema.
const VALID_ROLES = new Set(ROLES.map(r => r.id))

/** Autoriza la operación sobre un rol según los roles del actor. admin: todos;
 *  coordinador_estudios: solo los delegados (editor_perfiles, editor_grupos_estudio,
 *  folletos). Cualquier otro rol pedido por un no-admin → rechazado. Validación
 *  server-side: aunque manipulen la petición, no pueden escalar a otros permisos. */
function canManage(actorRoles: RoleId[], role: string): boolean {
  const allow = assignableRoleIds(actorRoles)
  if (allow === 'all') return true
  return allow.has(role as RoleId)
}

// POST: asigna un rol al miembro. Body: { role }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  try {
    // admin gestiona todo; coordinador_estudios solo los roles delegados.
    const auth = await requireRoles(...ACCESOS_SCREEN_ROLES)
    if (auth.res) return auth.res
    const { memberId } = await params
    if (!isUuid(memberId)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    const { role } = await req.json()
    if (!VALID_ROLES.has(role)) return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
    if (!canManage(auth.ctx.roles, role)) {
      return NextResponse.json({ error: 'No estás autorizado para asignar este permiso.' }, { status: 403 })
    }
    await assignMemberRole(memberId, role)
    await logAudit({
      actorUserId: auth.ctx.userId, action: 'ROLE_CHANGE', entityType: 'member_roles',
      entityId: memberId, newData: { role, op: 'assign' },
    })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('POST /api/accesos/[memberId]/roles:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE: revoca un rol del miembro. Body: { role }
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  try {
    const auth = await requireRoles(...ACCESOS_SCREEN_ROLES)
    if (auth.res) return auth.res
    const { memberId } = await params
    if (!isUuid(memberId)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    const { role } = await req.json()
    if (!VALID_ROLES.has(role)) return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
    if (!canManage(auth.ctx.roles, role)) {
      return NextResponse.json({ error: 'No estás autorizado para quitar este permiso.' }, { status: 403 })
    }
    await revokeMemberRole(memberId, role)
    await logAudit({
      actorUserId: auth.ctx.userId, action: 'ROLE_CHANGE', entityType: 'member_roles',
      entityId: memberId, newData: { role, op: 'revoke' },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/accesos/[memberId]/roles:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
