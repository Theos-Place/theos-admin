import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { getDiscipulosReport } from '@/lib/supabase/queries/reports'

// GET: reporte de Discípulos Multiplicadores. Permiso de módulo 'reportes'.
export async function GET(req: NextRequest) {
  try {
    const auth = await requireModuleView('reportes')
    if (auth.res) return auth.res
    const yp = req.nextUrl.searchParams.get('cohortYear')
    const cohortYear = yp && /^\d{4}$/.test(yp) ? Number(yp) : undefined
    const report = await getDiscipulosReport({ cohortYear })
    return NextResponse.json(report)
  } catch (error) {
    console.error('GET /api/reports/discipulos:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
