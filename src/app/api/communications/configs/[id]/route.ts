import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { updateConfig, deleteConfig } from '@/lib/supabase/queries/communications'
import { configUpdateSchema } from '../schema'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('admin') // COM-1: configuración solo admin
    if (auth.res) return auth.res
  try {
    const { id } = await params
    const parsed = configUpdateSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    await updateConfig(id, parsed.data)
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
    const auth = await requireRoles('admin') // COM-1: configuración solo admin
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
