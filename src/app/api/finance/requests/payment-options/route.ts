import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getMemberPaidPayments } from '@/lib/supabase/queries/finance-requests'

// GET ?member_id=X — pagos pagados del miembro, para el dropdown del modal
// de devolución. Cualquier autenticado (crear solicitudes está abierto).
export async function GET(req: NextRequest) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const memberId = req.nextUrl.searchParams.get('member_id')
    if (!memberId) return NextResponse.json({ error: 'Se requiere member_id' }, { status: 400 })
    return NextResponse.json(await getMemberPaidPayments(memberId))
  } catch (error) {
    console.error('GET /api/finance/requests/payment-options:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
