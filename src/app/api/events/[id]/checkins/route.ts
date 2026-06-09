import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { createCheckin } from '@/lib/supabase/queries/events'

// POST: registra un check-in. Body: { member_id?, guest_name?, sub_event_id?, method? }
// El constraint checkin_member_or_guest exige member_id O guest_name.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('direccion', 'encargado_staff', 'comunicaciones')
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
    console.error('POST /api/events/[id]/checkins:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
