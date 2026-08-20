import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getAlerts } from '@/lib/supabase/queries/alerts'

export async function GET() {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    // Las alertas se filtran por los roles de quien pregunta (2026-08-20:
    // antes cualquier sesión —incluso un dirigente o un miembro— recibía las
    // alertas globales de solicitudes, devoluciones y vacaciones).
    return NextResponse.json(await getAlerts(auth.ctx.roles))
  } catch (error) {
    console.error('GET /api/alerts:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
