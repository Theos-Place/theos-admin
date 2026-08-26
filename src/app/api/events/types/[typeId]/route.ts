import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { EVENT_WRITE_ROLES } from '@/lib/auth/roles'
import { updateEventType } from '@/lib/supabase/queries/events'

// PATCH: actualiza un tipo. Body: campos parciales { name?, color?, icon?, description?, is_active? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ typeId: string }> },
) {
    const auth = await requireRoles(...EVENT_WRITE_ROLES)
    if (auth.res) return auth.res
  try {
    const { typeId } = await params
    const body = await req.json()
    const res = await updateEventType(typeId, body)
    return NextResponse.json(res)
  } catch (error) {
    console.error('PATCH /api/events/types/[typeId]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
