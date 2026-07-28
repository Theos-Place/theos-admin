import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, canViewMemberProfile } from '@/lib/auth/guard'
import { getPaymentsByMember } from '@/lib/supabase/queries/payments'
import { isUuid } from '@/lib/validate'

// GET: pagos/cobros de un miembro. Lo ve el propio miembro, su FAMILIA (PAG-1,
// /mis-pagos permite pagar por familiares — mismo criterio que el perfil) o el
// staff de finanzas/dirección/admin. No usa el módulo estudios para no
// bloquear al miembro.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    const isStaff = auth.ctx.roles.some(r => ['admin', 'direccion', 'finanzas'].includes(r))
    if (!isStaff && !(await canViewMemberProfile(auth.ctx, id))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    return NextResponse.json(await getPaymentsByMember(id))
  } catch (error) {
    console.error('GET /api/members/[id]/payments:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
