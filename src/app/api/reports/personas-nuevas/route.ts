import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { hasModulePermission, moduleScope } from '@/lib/auth/roles'
import { getSeriePersonasNuevas, getPersonasNuevas } from '@/lib/supabase/queries/reports'
import { reportarError } from '@/lib/observabilidad'

/**
 * GET · REP-6 · Personas nuevas.
 *
 *  - sin `mes`: la serie completa para los gráficos (mensual y anual). Son
 *    ~240 filas agregadas, no las 14.807 personas.
 *  - `?mes=2026-08`: el detalle de ese mes para la tabla.
 *
 * El teléfono sigue el mismo criterio que REP-5: el módulo `reportes` abre el
 * reporte, pero el DIRECTORIO exige `miembros` con alcance total. El rol
 * `reportes` no tiene ese módulo — es de métricas.
 */
const MES = /^(\d{4})-(\d{2})$/

export async function GET(req: NextRequest) {
  try {
    const auth = await requireModuleView('reportes')
    if (auth.res) return auth.res

    const mes = req.nextUrl.searchParams.get('mes')
    if (!mes) {
      return NextResponse.json({ serie: await getSeriePersonasNuevas() })
    }

    const m = MES.exec(mes.trim())
    if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) {
      return NextResponse.json({ error: 'Mes inválido. Se espera 2026-08.' }, { status: 400 })
    }
    const anio = Number(m[1])
    const numMes = Number(m[2])
    const desde = `${m[1]}-${m[2]}-01`
    // Día 0 del mes siguiente = último día de este. Sirve también en diciembre.
    const hasta = new Date(Date.UTC(anio, numMes, 0)).toISOString().slice(0, 10)

    const puedeVerContacto = hasModulePermission(auth.ctx.roles, 'miembros', 'view')
      && moduleScope(auth.ctx.roles, 'miembros') === 'all'

    const personas = await getPersonasNuevas(desde, hasta)
    return NextResponse.json({
      mes,
      puedeVerContacto,
      personas: personas.map(p => ({ ...p, phone: puedeVerContacto ? p.phone : null })),
    })
  } catch (error) {
    reportarError('GET /api/reports/personas-nuevas:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
