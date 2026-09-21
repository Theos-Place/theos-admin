import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { getDemografiaPorSede } from '@/lib/supabase/queries/reports'
import { leerClaveDeSemana } from '@/lib/reports/semana-detalle'
import { rangoDeSemana } from '@/lib/reports/rango-de-semana'
import { reportarError } from '@/lib/observabilidad'

/**
 * GET · REP-8 · Demografía de quienes asistieron.
 *
 * `?semana=2026-W38` da la de esa semana; `?year=2026`, la del año. Si hay
 * semana elegida manda la semana, que es lo que la pantalla está mostrando.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireModuleView('reportes')
    if (auth.res) return auth.res

    const semana = leerClaveDeSemana(req.nextUrl.searchParams.get('semana'))
    let desde: string
    let hasta: string
    if (semana) {
      const r = rangoDeSemana(semana.year, semana.week)
      desde = r.desde.toISOString().slice(0, 10)
      hasta = r.hasta.toISOString().slice(0, 10)
    } else {
      const raw = req.nextUrl.searchParams.get('year')
      const year = raw && /^\d{4}$/.test(raw) ? Number(raw) : new Date().getUTCFullYear()
      desde = `${year}-01-01`
      hasta = `${year}-12-31`
    }

    return NextResponse.json({ desde, hasta, filas: await getDemografiaPorSede(desde, hasta) })
  } catch (error) {
    reportarError('GET /api/reports/demografia:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
