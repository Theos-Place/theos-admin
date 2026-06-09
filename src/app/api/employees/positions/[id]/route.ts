import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { updatePosition, deletePosition, type PositionWriteInput } from '@/lib/supabase/queries/employees'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('direccion', 'encargado_staff')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    await updatePosition(id, (await req.json()) as Partial<PositionWriteInput>)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/employees/positions/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('direccion', 'encargado_staff')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    await deletePosition(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/employees/positions/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
