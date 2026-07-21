import { NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { getDiscipulosReport } from '@/lib/supabase/queries/reports'

// GET: reporte de Discípulos Multiplicadores (payload cacheado). El filtro de
// cohorte lo resuelve el cliente sobre el payload — no hay parámetros.
export async function GET() {
  try {
    const auth = await requireModuleView('reportes')
    if (auth.res) return auth.res
    return NextResponse.json(await getDiscipulosReport())
  } catch (error) {
    console.error('GET /api/reports/discipulos:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
