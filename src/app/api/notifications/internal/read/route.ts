import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { markNotificationsRead } from '@/lib/supabase/queries/study-requests'

// POST: marca un conjunto de notificaciones del usuario como leídas. Body: { ids: string[] }
// Sesión-only: solo afecta las notificaciones propias (filtra por recipient_member_id).
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    if (!auth.ctx.memberId) return NextResponse.json({ ok: true })
    const body = await req.json()
    const ids = Array.isArray(body?.ids) ? body.ids.filter((x: unknown): x is string => typeof x === 'string') : []
    await markNotificationsRead(ids, auth.ctx.memberId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/notifications/internal/read:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
