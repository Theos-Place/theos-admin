import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { PUBLICAN_PUESTOS } from '@/lib/auth/roles'
import { getManageableCommitteeIds } from '@/lib/supabase/queries/servers'
import { getSolicitudesDePuestos } from '@/lib/supabase/queries/servers'
import { construirExcelDeSolicitudes } from '@/lib/servers/export-de-solicitudes'
import { planDePublicacion } from '@/lib/servers/publicacion-mensual'
import {
  filtroDesde, solicitudesConEstado, conteoPorFiltro, FILTRO_LABEL,
} from '@/lib/servers/filtro-de-solicitudes'
import { ymdCR } from '@/lib/format'
import { resumenDelMes, mesActualCR, mesesConSolicitudes } from '@/lib/servers/resumen-del-mes'
import { reportarError } from '@/lib/observabilidad'

/**
 * SRV-12 · Las solicitudes de puestos, para revisarlas y publicarlas.
 *
 * `?formato=xlsx` devuelve el Excel; sin eso, el JSON que pinta la pantalla.
 * Un solo endpoint y no dos porque la consulta es la MISMA: con dos, el día
 * que se agregue una columna una de las dos se queda atrás.
 *
 * QUIÉN: el rol unificado del comité (`puestos_servicio`) y la coordinación
 * de servidores. Es la misma gente que va a apretar «Publicar» — y desde el
 * 2026-10-07 eso ES verdad: antes esta frase estaba escrita acá mientras el
 * endpoint de publicar los excluía.
 */
const VIEW_ROLES = [...PUBLICAN_PUESTOS, 'solicitudes_puestos'] as const

/** `?mes=YYYY-MM`, o el mes actual. Lo que no tiene forma de mes se ignora en
 *  vez de devolver un resumen vacío que parecería «no se pidió nada». */
function mesPedido(valor: string | null): string {
  return valor && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor) ? valor : mesActualCR()
}

export async function GET(req: NextRequest) {
  try {
    /**
     * SRV-20 · DOS PUERTAS, y la segunda está recortada.
     *
     * Coordinación y `solicitudes_puestos` ven TODO, como siempre. Desde hoy
     * también entra quien COORDINA UN COMITÉ, pero solo a lo de sus comités:
     * mandaba la solicitud y después no volvía a saber nada —preguntaba por
     * WhatsApp— porque esta pantalla nunca fue suya.
     *
     * El recorte se hace ACÁ y no en la pantalla. Los comités salen de
     * `getManageableCommitteeIds`, que es la MISMA función que decide para
     * cuáles puede pedir: si alguna vez se amplía, las dos cosas se mueven
     * juntas y no queda alguien que puede pedir para un comité cuyas
     * solicitudes no ve.
     *
     * Sin comités propios no se devuelve una lista vacía: se responde 403.
     * Una pantalla vacía se lee como «no hay solicitudes», que es una
     * respuesta falsa cuando la verdad es «esto no es para vos».
     */
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const esAmplio = auth.ctx.roles.some(r => (VIEW_ROLES as readonly string[]).includes(r))
    const misComites = esAmplio || !auth.ctx.memberId
      ? null
      : await getManageableCommitteeIds(auth.ctx.memberId)
    if (!esAmplio && (!misComites || misComites.length === 0)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const todasSinRecortar = await getSolicitudesDePuestos()
    const todas = misComites
      ? todasSinRecortar.filter(i => misComites.includes(i.committee_id))
      : todasSinRecortar
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
      // La pantalla necesita saber si está viendo todo o solo lo suyo: con
      // `soloMisComites` esconde el botón de publicar y lo dice en el
      // encabezado, para que nadie crea que el mes entero fueron tres cupos.
      soloMisComites: !esAmplio,
      // SRV-20 · El resumen se arma sobre lo que esta persona PUEDE VER, no
      // sobre el filtro de estado: la pregunta es «qué pedí este mes y en
      // qué quedó», y filtrada por «listas para publicar» la respuesta
      // sería siempre «todo está listo para publicar».
      resumen: resumenDelMes(todas, mesPedido(req.nextUrl.searchParams.get('mes'))),
      meses: mesesConSolicitudes(todas),
    })
  } catch (error) {
    reportarError('GET /api/servers/vacancies/requests:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
