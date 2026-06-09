import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { linkDonation } from '@/lib/supabase/queries/finance'

// PATCH: vincula una donación a un miembro. Body: { member_id }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('finanzas', 'direccion')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    const { member_id } = await req.json()
    if (!member_id) return NextResponse.json({ error: 'Se requiere member_id' }, { status: 400 })
    await linkDonation(id, member_id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PATCH /api/finance/donations/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
