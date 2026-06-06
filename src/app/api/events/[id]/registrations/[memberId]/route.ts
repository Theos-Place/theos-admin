import { NextRequest, NextResponse } from 'next/server'
import { updateRegistrationPayment, deleteRegistration } from '@/lib/supabase/queries/events'

const VALID = ['pending', 'paid', 'exempted'] as const

// PATCH: cambia el estado de pago. Body: { payment_status }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  try {
    const { id, memberId } = await params
    const body = await req.json()
    if (!VALID.includes(body?.payment_status)) {
      return NextResponse.json({ error: 'payment_status inválido' }, { status: 400 })
    }
    await updateRegistrationPayment(id, memberId, body.payment_status)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PATCH /api/events/[id]/registrations/[memberId]:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}

// DELETE: quita la inscripción.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  try {
    const { id, memberId } = await params
    await deleteRegistration(id, memberId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/events/[id]/registrations/[memberId]:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
