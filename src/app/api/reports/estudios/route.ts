import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { ESTUDIOS_REPORTE_ROLES } from '@/lib/auth/roles'
import { getEstudiosDelAnio, getSerieDeEstudios, getPersonasNuevas } from '@/lib/supabase/queries/reports'
import { reportarError } from '@/lib/observabilidad'

/**
 * GET · REP-9 · El reporte de estudios de un año.
 *
 * Devuelve el detalle del año, la serie histórica y cuántas personas entraron a
 * Theos POR UN ESTUDIO ese año — este último con la misma definición de canal de
 * entrada de REP-6, no una propia: son la misma pregunta mirada desde otro
 * reporte.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRoles(...ESTUDIOS_REPORTE_ROLES)
  if (auth.res) return auth.res
  try {
    const raw = req.nextUrl.searchParams.get('anio')
    const anio = raw && /^\d{4}$/.test(raw) ? Number(raw) : new Date().getUTCFullYear()

    const [filas, serie, nuevas] = await Promise.all([
      getEstudiosDelAnio(anio),
      getSerieDeEstudios(),
      getPersonasNuevas(`${anio}-01-01`, `${anio}-12-31`),
    ])

    return NextResponse.json({
      anio,
      filas,
      serie,
      // Solo las que entraron POR un estudio: las que entraron por una charla y
      // después se matricularon no son "gente que llegó por el estudio".
      nuevasPorEstudio: nuevas.filter(p => p.canal === 'estudio').length,
    })
  } catch (error) {
    reportarError('GET /api/reports/estudios:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
