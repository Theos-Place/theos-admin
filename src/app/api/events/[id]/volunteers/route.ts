import { NextRequest, NextResponse } from 'next/server'
import { createVolunteer, NotCommitteeServerError } from '@/lib/supabase/queries/events'
import { requireEventAccess } from '@/lib/auth/event-guard'

// POST: asigna un servidor. Body: { member_id, role?, status? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    // FRM-1 B: también el ENCARGADO de este evento (event_managers).
    const auth = await requireEventAccess((await params).id)
    if (auth.res) return auth.res
  try {
    const { id } = await params
    const body = await req.json()
    if (!body?.member_id) {
      return NextResponse.json({ error: 'Se requiere member_id' }, { status: 400 })
    }
    const res = await createVolunteer(id, { member_id: body.member_id, role: body.role, status: body.status })
    return NextResponse.json(res, { status: 201 })
  } catch (error) {
    if (error instanceof NotCommitteeServerError) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    console.error('POST /api/events/[id]/volunteers:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
