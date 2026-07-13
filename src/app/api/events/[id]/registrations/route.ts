import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { createRegistration, registrationPricing, getEventRegistrationIds, PaymentRequiredError, EventFullError, AlreadyRegisteredError } from '@/lib/supabase/queries/events'

// GET: con ?member_id → precio aplicable para inscribir a ese miembro.
//      sin member_id → lista de inscritos { count, member_ids } (audiencia comms).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRoles('direccion', 'encargado_staff', 'comunicaciones')
    if (auth.res) return auth.res
    const { id } = await params
    const memberId = req.nextUrl.searchParams.get('member_id')
    if (!memberId) {
      const member_ids = await getEventRegistrationIds(id)
      return NextResponse.json({ count: member_ids.length, member_ids })
    }
    const pricing = await registrationPricing(id, memberId)
    return NextResponse.json(pricing)
  } catch (error) {
    console.error('GET /api/events/[id]/registrations:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

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
    if (error instanceof PaymentRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    if (error instanceof AlreadyRegisteredError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    if (error instanceof EventFullError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error('POST /api/events/[id]/registrations:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
