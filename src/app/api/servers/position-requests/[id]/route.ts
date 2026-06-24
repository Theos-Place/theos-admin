import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'
import { approvePositionRequest, rejectPositionRequest } from '@/lib/supabase/queries/servers'

// PATCH { action: 'approve' | 'reject' }: resolver una solicitud de puesto nuevo.
// Solo Staff/admin. Aprobar crea el puesto en el catálogo.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(...SERVICE_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const action = body?.action
    if (action === 'approve') {
      const r = await approvePositionRequest(id, auth.ctx.memberId)
      return NextResponse.json({ ok: true, ...r })
    }
    if (action === 'reject') {
      await rejectPositionRequest(id, auth.ctx.memberId)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  } catch (error) {
    console.error('PATCH /api/servers/position-requests/[id]:', error)
    const msg = error instanceof Error ? error.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
