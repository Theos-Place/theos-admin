import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { createVolunteer, NotCommitteeServerError } from '@/lib/supabase/queries/events'

// POST: asigna un servidor. Body: { member_id, role?, status? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('direccion', 'encargado_staff', 'comunicaciones')
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
