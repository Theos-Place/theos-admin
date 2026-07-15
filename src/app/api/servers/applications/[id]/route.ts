import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { setApplicationStatus } from '@/lib/supabase/queries/servers'

// PUT: cambia el estado. Body: { status }. Al aprobar, activa al servidor (5b).
// El "responsable" (assigned_to) se eliminó del flujo de vacantes.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles('encargado_staff', 'coordinador_servidores', 'direccion', 'lider_comite', 'admin')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const { status } = await req.json()
    await setApplicationStatus(id, status, auth.ctx.userId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/servers/applications/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
