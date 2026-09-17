import { NextRequest, NextResponse } from 'next/server'
import { requireEventAccess } from '@/lib/auth/event-guard'
import { eventOrganizingCommitteeIds, calificaComoServidor } from '@/lib/supabase/queries/events'
import { reportarError } from '@/lib/observabilidad'

// GET: ¿el miembro es servidor activo de algún comité organizador del evento?
// ?member_id=<uuid> → { hasCommittees, isServer }
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
  // EVE-12: el guard es POR EVENTO, no por rol suelto. El rol de eventos que
  // llega por el puesto solo alcanza los eventos de sus comités.
    const auth = await requireEventAccess(id)
    if (auth.res) return auth.res
    const memberId = req.nextUrl.searchParams.get('member_id')
    if (!memberId) return NextResponse.json({ error: 'Falta member_id' }, { status: 400 })
    const committeeIds = await eventOrganizingCommitteeIds(id)
    const hasCommittees = committeeIds.length > 0
    // MISMA función que aplica el check-in: la pantalla no puede ofrecer algo
    // que el servidor después va a corregir, ni al revés.
    const isServer = await calificaComoServidor(memberId, id)
    return NextResponse.json({ hasCommittees, isServer })
  } catch (error) {
    reportarError('GET /api/events/[id]/server-check:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
