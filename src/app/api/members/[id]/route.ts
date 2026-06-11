import { NextRequest, NextResponse } from 'next/server'
import { canViewMemberProfile, requireModuleView, requireRoles } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validate'
import { getMemberFullById, updateMember } from '@/lib/supabase/queries/members'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    // Sin permiso de padrón (módulo miembros más allá de 'own'), solo se
    // permite el propio perfil o el de un integrante de la familia.
    if (!(await canViewMemberProfile(auth.ctx, id))) {
      const mod = await requireModuleView('miembros', { beyondOwn: true })
      if (mod.res) return mod.res
    }
    const member = await getMemberFullById(id)
    if (!member) {
      return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    }
    // Donaciones del perfil (decisión 2026-06-11): MONTOS solo para rol
    // finanzas; admin/dirección ven las filas con amount null; el resto no
    // recibe las filas.
    if (auth.ctx.roles.includes('finanzas')) return NextResponse.json(member)
    const seesRows = auth.ctx.roles.some(r => ['admin', 'direccion'].includes(r))
    return NextResponse.json({
      ...member,
      donations: seesRows ? member.donations.map(d => ({ ...d, amount: null })) : [],
    })
  } catch (error) {
    console.error('GET /api/members/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('editor_perfiles', 'direccion', 'encargado_staff', 'coordinador_estudios')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    const updates = await req.json()
    const member = await updateMember(id, updates)
    return NextResponse.json(member)
  } catch (error) {
    console.error('PUT /api/members/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
