import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { getCharlaAttendanceReport } from '@/lib/supabase/queries/reports'

// GET: reporte de Control de Asistencia por sede. Permiso de módulo 'reportes'
// (no roles hardcodeados): mañana un rol dedicado con ese permiso entra solo.
export async function GET(req: NextRequest) {
  try {
    const auth = await requireModuleView('reportes')
    if (auth.res) return auth.res
    const yearParam = req.nextUrl.searchParams.get('year')
    const sede = req.nextUrl.searchParams.get('sede') ?? undefined
    const year = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : undefined
    const report = await getCharlaAttendanceReport({ year, sede })
    return NextResponse.json(report)
  } catch (error) {
    console.error('GET /api/reports/charla-attendance:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
