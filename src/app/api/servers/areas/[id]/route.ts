import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { deleteArea } from '@/lib/supabase/queries/servers'

// DELETE: elimina un área o comité. El cliente verifica antes que no haya
// servidores activos ligados.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('encargado_staff', 'direccion', 'lider_comite')
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
