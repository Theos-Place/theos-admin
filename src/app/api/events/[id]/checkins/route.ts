import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { createCheckin, deleteCheckin, getEventAttendeeIds } from '@/lib/supabase/queries/events'

// GET: asistentes (member_ids con check-in) de un evento. Para elegir audiencia
// en comunicaciones. Devuelve { count, member_ids }.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles('comunicaciones', 'direccion', 'encargado_eventos')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const member_ids = await getEventAttendeeIds(id)
    return NextResponse.json({ count: member_ids.length, member_ids })
  } catch (error) {
    console.error('GET /api/events/[id]/checkins:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST: registra un check-in. Body: { member_id?, guest_name?, sub_event_id?, method? }
// El constraint checkin_member_or_guest exige member_id O guest_name.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    // Check-in operable por encargado_eventos, dirección y admin (admin pasa siempre).
    const auth = await requireRoles('encargado_eventos', 'direccion')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    const body = await req.json()
    const memberId = body?.member_id ?? null
    const guestName = typeof body?.guest_name === 'string' ? body.guest_name.trim() : ''
    if (!memberId && !guestName) {
      return NextResponse.json(
        { error: 'Se requiere un miembro o un nombre de invitado para el check-in' },
        { status: 400 },
      )
    }
    const res = await createCheckin(id, { ...body, guest_name: memberId ? body.guest_name ?? null : guestName })
    return NextResponse.json(res, { status: 201 })
  } catch (error) {
    // UNIQUE(member_id, event_id): la persona ya tenía check-in en este evento.
    if ((error as { code?: string })?.code === '23505') {
      return NextResponse.json(
        { error: 'Esta persona ya tiene check-in en este evento.', code: 'duplicate' },
        { status: 409 },
      )
    }
    console.error('POST /api/events/[id]/checkins:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE: deshace un check-in. ?checkinId=<uuid>. Mismos roles que el alta.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles('encargado_eventos', 'direccion')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const checkinId = req.nextUrl.searchParams.get('checkinId')
    if (!checkinId) return NextResponse.json({ error: 'Falta checkinId' }, { status: 400 })
    await deleteCheckin(id, checkinId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/events/[id]/checkins:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
