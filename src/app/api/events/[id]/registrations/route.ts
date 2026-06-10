import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { createRegistration } from '@/lib/supabase/queries/events'

// POST: inscribe un miembro. Body: { member_id, payment_status? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRoles('direccion', 'encargado_staff', 'comunicaciones')
    if (auth.res) return auth.res
    const { id } = await params
    const body = await req.json()
    if (!body?.member_id) {
      return NextResponse.json({ error: 'Se requiere member_id' }, { status: 400 })
    }
    const res = await createRegistration(id, { member_id: body.member_id, payment_status: body.payment_status })
    return NextResponse.json(res, { status: 201 })
  } catch (error) {
    console.error('POST /api/events/[id]/registrations:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
