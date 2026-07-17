import { NextRequest, NextResponse } from 'next/server'
import { canViewMemberProfile, requireModuleView, requireRoles } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validate'
import { getMemberFamily, linkFamilyMember, unlinkFamilyMember } from '@/lib/supabase/queries/members'

// Roles con permiso de editar miembros (miembros:edit): editor_perfiles,
// direccion y admin (este último pasa siempre en requireRoles). Alinea el
// server con el gate de UI can('miembros','edit').
const FAMILY_EDIT_ROLES = ['editor_perfiles', 'direccion'] as const

// GET: otros integrantes de la familia del miembro (para check-in en familia).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    // Sin permiso de padrón, solo la familia propia (id propio o de un familiar).
    if (!(await canViewMemberProfile(auth.ctx, id))) {
      const mod = await requireModuleView('miembros', { beyondOwn: true })
      if (mod.res) return mod.res
    }
    return NextResponse.json(await getMemberFamily(id))
  } catch (error) {
    console.error('GET /api/members/[id]/family:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST: vincula un miembro (existente) a la familia de [id]. Acción directa.
// Body: { member_id, relation }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles(...FAMILY_EDIT_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    const body = await req.json().catch(() => ({}))
    const linkMemberId = typeof body?.member_id === 'string' ? body.member_id : ''
    const relation = typeof body?.relation === 'string' ? body.relation.trim() : ''
    if (!isUuid(linkMemberId)) return NextResponse.json({ error: 'Se requiere member_id válido' }, { status: 400 })
    if (!relation) return NextResponse.json({ error: 'Se requiere la relación' }, { status: 400 })

    const res = await linkFamilyMember(id, linkMemberId, relation, auth.ctx.memberId)
    return NextResponse.json({ ok: true, ...res }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'VINCULO_A_SI_MISMO') {
      return NextResponse.json({ error: 'No se puede vincular a la persona consigo misma.' }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'YA_VINCULADO') {
      return NextResponse.json({ error: 'Esta persona ya está vinculada a la familia.' }, { status: 409 })
    }
    console.error('POST /api/members/[id]/family:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE: desvincula un miembro de la familia de [id]. Acción directa.
// Body: { member_id }
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles(...FAMILY_EDIT_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    const body = await req.json().catch(() => ({}))
    const linkMemberId = typeof body?.member_id === 'string' ? body.member_id : ''
    if (!isUuid(linkMemberId)) return NextResponse.json({ error: 'Se requiere member_id válido' }, { status: 400 })

    await unlinkFamilyMember(id, linkMemberId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'SIN_VINCULO') {
      return NextResponse.json({ error: 'Estas personas no están vinculadas; refrescá la página.' }, { status: 409 })
    }
    console.error('DELETE /api/members/[id]/family:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
