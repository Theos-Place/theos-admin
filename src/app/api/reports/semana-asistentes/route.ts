import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { hasModulePermission, moduleScope } from '@/lib/auth/roles'
import { getAsistentesDeLaSemana } from '@/lib/supabase/queries/reports'
import { leerClaveDeSemana } from '@/lib/reports/semana-detalle'
import { rangoDeSemana } from '@/lib/reports/rango-de-semana'
import { ventanaDeAbandono, abandonos, sedeDeLaSemana } from '@/lib/reports/abandonos'
import { todayCR } from '@/lib/format'
import { reportarError } from '@/lib/observabilidad'

/**
 * GET ?semana=2026-W37 · REP-5 · Quiénes asistieron esa semana y quiénes
 * dejaron de venir después.
 *
 * DOS PERMISOS, no uno. Las listas son del módulo `reportes`, igual que el
 * resto de la pantalla. Pero el TELÉFONO Y EL CORREO exigen además el módulo
 * `miembros` con alcance total, porque el rol `reportes` no tiene ese módulo
 * en absoluto: es de métricas, y darle el directorio completo de 889 personas
 * por la puerta de un reporte sería abrirlo sin decirlo. A quien no lo tiene se
 * le responde la lista SIN esos campos — no van en el payload, así que tampoco
 * viajan al navegador.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireModuleView('reportes')
    if (auth.res) return auth.res

    const semana = leerClaveDeSemana(req.nextUrl.searchParams.get('semana'))
    if (!semana) {
      return NextResponse.json({ error: 'Semana inválida. Se espera 2026-W37.' }, { status: 400 })
    }

    const puedeVerContacto = hasModulePermission(auth.ctx.roles, 'miembros', 'view')
      && moduleScope(auth.ctx.roles, 'miembros') === 'all'

    const rango = rangoDeSemana(semana.year, semana.week)
    const desde = rango.desde.toISOString().slice(0, 10)
    const hasta = rango.hasta.toISOString().slice(0, 10)

    const crudos = await getAsistentesDeLaSemana(desde, hasta)
    const ventana = ventanaDeAbandono(semana, todayCR())

    const limpiar = (a: (typeof crudos)[number]) => ({
      member_id: a.member_id,
      nombre: a.nombre,
      sede: sedeDeLaSemana(a.sedes),
      telefono: puedeVerContacto ? a.telefono : null,
      email: puedeVerContacto ? a.email : null,
    })

    return NextResponse.json({
      semana: `${semana.year}-W${String(semana.week).padStart(2, '0')}`,
      etiqueta: rango.etiqueta,
      puedeVerContacto,
      asistentes: crudos.map(limpiar),
      // Antes de que cierre la ventana la lista NO se manda: una lista a medias
      // que cambia sola es peor que decir cuánto falta, porque con ella se
      // llama por teléfono.
      abandono: ventana.evaluable
        ? {
            evaluable: true as const,
            hasta: ventana.finDeLaVentana,
            personas: abandonos(crudos, ventana.finDeLaVentana).map(a => ({
              ...limpiar(a),
              volvioEl: a.volvioEl,
            })),
          }
        : { evaluable: false as const, faltanSemanas: ventana.faltanSemanas, hasta: ventana.finDeLaVentana },
    })
  } catch (error) {
    reportarError('GET /api/reports/semana-asistentes:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
