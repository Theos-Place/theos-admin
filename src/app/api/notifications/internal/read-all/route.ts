import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { markAllNotificationsRead } from '@/lib/supabase/queries/study-requests'

// POST: marca todas las notificaciones del usuario autenticado como leídas.
// Sesión-only es suficiente: solo opera sobre las notificaciones propias.
export async function POST() {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    if (!auth.ctx.memberId) return NextResponse.json({ ok: true })
    await markAllNotificationsRead(auth.ctx.memberId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/notifications/internal/read-all:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
