import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { eventOrganizingCommitteeIds, memberServesAnyCommittee } from '@/lib/supabase/queries/events'

// GET: ¿el miembro es servidor activo de algún comité organizador del evento?
// ?member_id=<uuid> → { hasCommittees, isServer }
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRoles('encargado_eventos', 'direccion')
    if (auth.res) return auth.res
    const { id } = await params
    const memberId = req.nextUrl.searchParams.get('member_id')
    if (!memberId) return NextResponse.json({ error: 'Falta member_id' }, { status: 400 })
    const committeeIds = await eventOrganizingCommitteeIds(id)
    const hasCommittees = committeeIds.length > 0
    const isServer = hasCommittees ? await memberServesAnyCommittee(memberId, committeeIds) : false
    return NextResponse.json({ hasCommittees, isServer })
  } catch (error) {
    console.error('GET /api/events/[id]/server-check:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
