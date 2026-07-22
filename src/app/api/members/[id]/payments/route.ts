import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getPaymentsByMember } from '@/lib/supabase/queries/payments'
import { isUuid } from '@/lib/validate'

// GET: pagos/cobros de un miembro. Lo ve el propio miembro (self) o el staff de
// finanzas/dirección/admin. No usa el módulo estudios para no bloquear al miembro.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    const isSelf = auth.ctx.memberId === id
    const isStaff = auth.ctx.roles.some(r => ['admin', 'direccion', 'finanzas'].includes(r))
    if (!isSelf && !isStaff) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    return NextResponse.json(await getPaymentsByMember(id))
  } catch (error) {
    console.error('GET /api/members/[id]/payments:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
