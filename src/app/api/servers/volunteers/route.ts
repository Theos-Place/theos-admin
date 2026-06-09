import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { assignVolunteer, removeVolunteer } from '@/lib/supabase/queries/servers'

// POST: asigna un servidor a una posición. Body: { position_id, member_id }
export async function POST(req: NextRequest) {
    const auth = await requireRoles('encargado_staff', 'direccion', 'lider_comite')
    if (auth.res) return auth.res
  try {
    const { position_id, member_id } = await req.json()
    await assignVolunteer(position_id, member_id)
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('POST /api/servers/volunteers:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE: da de baja (status inactive). Body: { position_id, member_id }
export async function DELETE(req: NextRequest) {
    const auth = await requireRoles('encargado_staff', 'direccion', 'lider_comite')
    if (auth.res) return auth.res
  try {
    const { position_id, member_id } = await req.json()
    await removeVolunteer(position_id, member_id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/servers/volunteers:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
