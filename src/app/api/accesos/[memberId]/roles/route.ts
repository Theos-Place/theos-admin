import { NextRequest, NextResponse } from 'next/server'
import { assignMemberRole, revokeMemberRole } from '@/lib/supabase/queries/members'
import { requireRoles } from '@/lib/auth/guard'
import { ROLES } from '@/lib/auth/roles'
import { isUuid } from '@/lib/validate'

// Derivado de ROLES para que nunca se desincronice con los roles reales del sistema.
const VALID_ROLES = new Set(ROLES.map(r => r.id))

// POST: asigna un rol al miembro. Body: { role }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  try {
    const auth = await requireRoles('admin')
    if (auth.res) return auth.res
    const { memberId } = await params
    if (!isUuid(memberId)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    const { role } = await req.json()
    if (!VALID_ROLES.has(role)) return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
    await assignMemberRole(memberId, role)
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
    const auth = await requireRoles('admin')
    if (auth.res) return auth.res
    const { memberId } = await params
    if (!isUuid(memberId)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    const { role } = await req.json()
    if (!VALID_ROLES.has(role)) return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
    await revokeMemberRole(memberId, role)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/accesos/[memberId]/roles:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
