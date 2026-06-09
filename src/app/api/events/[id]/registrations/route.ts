import { NextRequest, NextResponse } from 'next/server'
import { createRegistration } from '@/lib/supabase/queries/events'

// POST: inscribe un miembro. Body: { member_id, payment_status? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
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
