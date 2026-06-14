import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'
import {
  updateServicePosition, deleteServicePosition, countActivePositionVolunteers,
  type ServicePositionWriteInput,
} from '@/lib/supabase/queries/servers'

// PUT: edita un puesto (campos del formato real).
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles(...SERVICE_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    await updateServicePosition(id, (await req.json()) as Partial<ServicePositionWriteInput>)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/servers/positions/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE: elimina un puesto. ?check=1 devuelve el conteo de servidores activos
// (para el ActiveWarningModal antes de confirmar).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles(...SERVICE_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    if (req.nextUrl.searchParams.get('check') === '1') {
      return NextResponse.json({ activeVolunteers: await countActivePositionVolunteers(id) })
    }
    await deleteServicePosition(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/servers/positions/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
