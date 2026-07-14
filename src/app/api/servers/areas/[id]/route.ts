import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'
import { updateArea, deleteArea } from '@/lib/supabase/queries/servers'
import { areaUpdateSchema } from '../schema'

// PUT: edita un área/comité (nombre, descripción, área padre, encargado).
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles(...SERVICE_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const parsed = areaUpdateSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    await updateArea(id, parsed.data)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/servers/areas/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE: elimina un área o comité. Las entidades activas ligadas (para el
// ActiveWarningModal) se consultan con GET ./usage.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles(...SERVICE_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    await deleteArea(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/servers/areas/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
