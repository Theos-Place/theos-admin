import { NextRequest, NextResponse } from 'next/server'
import { canViewMemberProfile, requireModuleView, requireRoles } from '@/lib/auth/guard'
import { getMemberFamily } from '@/lib/supabase/queries/members'

// GET: otros integrantes de la familia del miembro (para check-in en familia).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const { id } = await params
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
