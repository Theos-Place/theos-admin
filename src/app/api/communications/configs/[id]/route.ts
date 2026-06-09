import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { updateConfig, deleteConfig, type ConfigWriteInput } from '@/lib/supabase/queries/communications'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('comunicaciones', 'direccion')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    await updateConfig(id, (await req.json()) as Partial<ConfigWriteInput>)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/communications/configs/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('comunicaciones', 'direccion')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    await deleteConfig(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/communications/configs/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
