import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getInternalNotifications } from '@/lib/supabase/queries/study-requests'

// GET: notificaciones internas del usuario autenticado.
export async function GET() {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    if (!auth.ctx.memberId) return NextResponse.json([])
    return NextResponse.json(await getInternalNotifications(auth.ctx.memberId))
  } catch (error) {
    console.error('GET /api/notifications/internal:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
