import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'
import { getSolicitudesDePuestos } from '@/lib/supabase/queries/servers'
import { construirExcelDeSolicitudes } from '@/lib/servers/export-de-solicitudes'
import { planDePublicacion } from '@/lib/servers/publicacion-mensual'
import {
  filtroDesde, solicitudesConEstado, conteoPorFiltro, FILTRO_LABEL,
} from '@/lib/servers/filtro-de-solicitudes'
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

    const todas = await getSolicitudesDePuestos()
    const filtro = filtroDesde(req.nextUrl.searchParams.get('estado'))
    const items = solicitudesConEstado(todas, filtro)

    if (req.nextUrl.searchParams.get('formato') === 'xlsx') {
      // El Excel lleva LO FILTRADO, lo mismo que se está viendo. Con la lista
      // completa, quien filtró «denegadas» y bajó el archivo se encontraría
      // adentro las publicadas sin ninguna señal de por qué.
      const buf = await construirExcelDeSolicitudes(items)
      const sufijo = FILTRO_LABEL[filtro].toLowerCase().replace(/ /g, '-')
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition':
            `attachment; filename="solicitudes-de-puestos-${sufijo}-${ymdCR()}.xlsx"`,
        },
      })
    }

    // EL PLAN SE CALCULA SOBRE TODAS, nunca sobre lo filtrado: la mitad del
    // plan son las publicadas que hay que bajar, y en la vista por defecto
    // —«listas para publicar»— ninguna de esas está a la vista. Filtrarlo
    // haría que el botón dijera que no baja nada y después bajara cinco.
    const plan = planDePublicacion(
      todas.map(i => ({ id: i.id, status: i.estado, published_at: i.published_at })),
      new Date(),
    )
    return NextResponse.json({
      items, total: items.length, plan, filtro, conteos: conteoPorFiltro(todas),
    })
  } catch (error) {
    reportarError('GET /api/servers/vacancies/requests:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
