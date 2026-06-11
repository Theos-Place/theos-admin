import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { markNotificationRead } from '@/lib/supabase/queries/study-requests'

// PATCH: marca la notificación como leída (solo si pertenece al usuario).
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    if (!auth.ctx.memberId) return NextResponse.json({ ok: true })
    const { id } = await params
    await markNotificationRead(id, auth.ctx.memberId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PATCH /api/notifications/internal/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
