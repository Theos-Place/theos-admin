import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'
import { updateArea, deleteArea, countAreaLinks } from '@/lib/supabase/queries/servers'

// PUT: edita un área/comité (nombre, descripción, área padre, encargado).
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles(...SERVICE_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    await updateArea(id, await req.json())
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/servers/areas/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE: elimina un área o comité. ?check=1 devuelve entidades activas ligadas
// (servidores activos, puestos, comités hijos) para el ActiveWarningModal.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles(...SERVICE_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    if (req.nextUrl.searchParams.get('check') === '1') {
      return NextResponse.json(await countAreaLinks(id))
    }
    await deleteArea(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/servers/areas/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
