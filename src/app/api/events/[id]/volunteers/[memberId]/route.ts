import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { deleteVolunteer } from '@/lib/supabase/queries/events'

// DELETE: quita la asignación del servidor.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
    const auth = await requireRoles('direccion', 'encargado_staff', 'comunicaciones')
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
