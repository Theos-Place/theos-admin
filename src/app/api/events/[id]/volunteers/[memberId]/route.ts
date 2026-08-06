import { NextRequest, NextResponse } from 'next/server'
import { deleteVolunteer } from '@/lib/supabase/queries/events'
import { requireEventAccess } from '@/lib/auth/event-guard'

// DELETE: quita la asignación del servidor.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
    // FRM-1 B: también el ENCARGADO de este evento (event_managers).
    const auth = await requireEventAccess((await params).id)
    if (auth.res) return auth.res
  try {
    const { id, memberId } = await params
    await deleteVolunteer(id, memberId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/events/[id]/volunteers/[memberId]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
