import { NextRequest, NextResponse } from 'next/server'
import { createVolunteer } from '@/lib/supabase/queries/events'

// POST: asigna un servidor. Body: { member_id, role?, status? }
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
    const res = await createVolunteer(id, { member_id: body.member_id, role: body.role, status: body.status })
    return NextResponse.json(res, { status: 201 })
  } catch (error) {
    console.error('POST /api/events/[id]/volunteers:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
