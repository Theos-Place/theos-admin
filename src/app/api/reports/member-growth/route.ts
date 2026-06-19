import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { getMemberGrowthReport } from '@/lib/supabase/queries/reports'

// GET: reporte de Crecimiento (personas nuevas por sede/mes). Mismo permiso de
// módulo 'reportes' que asistencia. Las queries usan service role y saltan RLS.
export async function GET(req: NextRequest) {
  try {
    const auth = await requireModuleView('reportes')
    if (auth.res) return auth.res
    const yearParam = req.nextUrl.searchParams.get('year')
    const sede = req.nextUrl.searchParams.get('sede') ?? undefined
    const year = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : undefined
    const report = await getMemberGrowthReport({ year, sede })
    return NextResponse.json(report)
  } catch (error) {
    console.error('GET /api/reports/member-growth:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
