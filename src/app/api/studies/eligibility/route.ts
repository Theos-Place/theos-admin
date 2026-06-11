import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getEligibleStudiesForMember } from '@/lib/supabase/queries/studies'

// GET ?member_id=X — elegibilidad de estudios del miembro para los modales de
// solicitud. Cualquier autenticado (crear solicitudes está abierto a todo rol).
export async function GET(req: NextRequest) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const memberId = req.nextUrl.searchParams.get('member_id')
    if (!memberId) return NextResponse.json({ error: 'Se requiere member_id' }, { status: 400 })
    return NextResponse.json(await getEligibleStudiesForMember(memberId))
  } catch (error) {
    console.error('GET /api/studies/eligibility:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
