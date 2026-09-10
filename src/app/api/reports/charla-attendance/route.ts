import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { getCharlaAttendanceReport, getSemanaDetalle } from '@/lib/supabase/queries/reports'
import { leerClaveDeSemana } from '@/lib/reports/semana-detalle'

// GET: reporte de Control de Asistencia por sede. Permiso de módulo 'reportes'
// (no roles hardcodeados): mañana un rol dedicado con ese permiso entra solo.
export async function GET(req: NextRequest) {
  try {
    const auth = await requireModuleView('reportes')
    if (auth.res) return auth.res
    const yearParam = req.nextUrl.searchParams.get('year')
    const sede = req.nextUrl.searchParams.get('sede') ?? undefined
    const year = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : undefined

    // REP-2 · ?semana=2026-W37 → el detalle de esa semana en vez del año.
    // Va en el mismo endpoint y con el mismo permiso: es el mismo reporte
    // mirado de cerca, no otro.
    const semana = leerClaveDeSemana(req.nextUrl.searchParams.get('semana'))
    if (semana) {
      const detalle = await getSemanaDetalle(semana.year, semana.week, { sede })
      // null = esa semana no está en los datos. 404 y no una pantalla de
      // ceros, que se leería como "no vino nadie".
      if (!detalle) {
        return NextResponse.json({ error: 'No hay asistencia registrada en esa semana.' }, { status: 404 })
      }
      return NextResponse.json(detalle)
    }

    const report = await getCharlaAttendanceReport({ year, sede })
    return NextResponse.json(report)
  } catch (error) {
    console.error('GET /api/reports/charla-attendance:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
