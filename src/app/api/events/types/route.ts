import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { EVENT_WRITE_ROLES } from '@/lib/auth/roles'
import { getEventTypes, createEventType } from '@/lib/supabase/queries/events'

export async function GET() {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    return NextResponse.json(await getEventTypes())
  } catch (error) {
    console.error('GET /api/events/types:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST: crea un tipo. Body: { id, name, color?, icon?, description?, is_active? }
export async function POST(req: NextRequest) {
    const auth = await requireRoles(...EVENT_WRITE_ROLES)
    if (auth.res) return auth.res
  try {
    const body = await req.json()
    if (!body?.id || !body?.name) {
      return NextResponse.json({ error: 'Se requieren id y name' }, { status: 400 })
    }
    const res = await createEventType(body)
    return NextResponse.json(res, { status: 201 })
  } catch (error) {
    console.error('POST /api/events/types:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
