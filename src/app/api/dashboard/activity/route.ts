import { NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { getRecentActivity } from '@/lib/supabase/queries/dashboard'

// SEC-1: el audit_log (aunque sea resumido) es información de gestión — antes
// lo recibía cualquier sesión. Se exige view más allá de 'own' de alguno de
// los módulos administrativos (los mismos cuyos KPIs muestra el dashboard).
export async function GET() {
  try {
    const auth = await requireModuleView(
      ['miembros', 'estudios', 'eventos', 'servidores', 'finanzas', 'comunicaciones'],
      { beyondOwn: true },
    )
    if (auth.res) return auth.res
    return NextResponse.json(await getRecentActivity())
  } catch (error) {
    console.error('GET /api/dashboard/activity:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
