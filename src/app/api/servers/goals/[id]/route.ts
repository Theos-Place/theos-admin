import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { updateGoal, deleteGoal } from '@/lib/supabase/queries/servers'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('encargado_staff', 'direccion', 'lider_comite')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    await updateGoal(id, await req.json())
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/servers/goals/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('encargado_staff', 'direccion', 'lider_comite')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    await deleteGoal(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/servers/goals/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
