import { NextRequest, NextResponse } from 'next/server'
import { assignMemberRole, revokeMemberRole } from '@/lib/supabase/queries/members'
import { requireRoles } from '@/lib/auth/guard'

const VALID_ROLES = new Set([
  'admin', 'direccion', 'finanzas', 'encargado_staff', 'coordinador_estudios',
  'coordinador_dirigentes', 'lider_comite', 'comunicaciones', 'dirigente',
  'editor_perfiles', 'miembro', 'solo_lectura',
])

// POST: asigna un rol al miembro. Body: { role }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  try {
    const auth = await requireRoles('admin')
    if (auth.res) return auth.res
    const { memberId } = await params
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
    const { role } = await req.json()
    if (!VALID_ROLES.has(role)) return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
    await revokeMemberRole(memberId, role)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/accesos/[memberId]/roles:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
