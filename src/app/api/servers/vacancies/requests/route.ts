import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'
import { getSolicitudesDePuestos } from '@/lib/supabase/queries/servers'
import { construirExcelDeSolicitudes } from '@/lib/servers/export-de-solicitudes'
import { planDePublicacion } from '@/lib/servers/publicacion-mensual'
import { ymdCR } from '@/lib/format'
import { reportarError } from '@/lib/observabilidad'

/**
 * SRV-12 · Las solicitudes de puestos, para revisarlas y publicarlas.
 *
 * `?formato=xlsx` devuelve el Excel; sin eso, el JSON que pinta la pantalla.
 * Un solo endpoint y no dos porque la consulta es la MISMA: con dos, el día
 * que se agregue una columna una de las dos se queda atrás.
 *
 * QUIÉN: el rol `solicitudes_puestos` —el puesto «Colaborador Solicitud
 * Puestos»— y la coordinación de servidores. Es la misma gente que va a
 * apretar «Publicar».
 */
const VIEW_ROLES = [...SERVICE_ADMIN_ROLES, 'solicitudes_puestos'] as const

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRoles(...VIEW_ROLES)
    if (auth.res) return auth.res

    const items = await getSolicitudesDePuestos()

    if (req.nextUrl.searchParams.get('formato') === 'xlsx') {
      const buf = await construirExcelDeSolicitudes(items)
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="solicitudes-de-puestos-${ymdCR()}.xlsx"`,
        },
      })
    }

    // El plan viaja con la lista para que el botón pueda decir los dos números
    // ANTES de apretarlo. Se recalcula en el POST con la hora del servidor: lo
    // que va acá es para mostrar, no para decidir.
    const plan = planDePublicacion(
      items.map(i => ({ id: i.id, status: i.estado, published_at: i.published_at })),
      new Date(),
    )
    return NextResponse.json({ items, total: items.length, plan })
  } catch (error) {
    reportarError('GET /api/servers/vacancies/requests:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
