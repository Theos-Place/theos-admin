import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { hasModulePermission, moduleScope } from '@/lib/auth/roles'
import { getAsistentesDeLaSemana } from '@/lib/supabase/queries/reports'
import { leerClaveDeSemana } from '@/lib/reports/semana-detalle'
import { rangoDeSemana } from '@/lib/reports/rango-de-semana'
import { ventanaHaciaAtras, abandonos, asistentes, sedeDeLaSemana } from '@/lib/reports/abandonos'
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

    // REP-8 · Son DOS consultas a semanas distintas: los que asistieron salen de
    // la semana que se está mirando, y los que dejaron de venir salen de la de
    // cinco semanas antes. Así la lista siempre se puede calcular, también para
    // la semana en curso.
    const atras = ventanaHaciaAtras(semana)
    const [deEstaSemana, deLaDeAtras] = await Promise.all([
      getAsistentesDeLaSemana(desde, hasta),
      getAsistentesDeLaSemana(atras.desde, atras.hasta),
    ])

    const limpiar = (a: (typeof deEstaSemana)[number]) => ({
      member_id: a.member_id,
      nombre: a.nombre,
      sede: sedeDeLaSemana(a.sedes),
      visitas: a.visitas,
      telefono: puedeVerContacto ? a.telefono : null,
      email: puedeVerContacto ? a.email : null,
    })

    const conHistoria = asistentes(deEstaSemana)
    const rangoRef = rangoDeSemana(atras.semanaDeReferencia.year, atras.semanaDeReferencia.week)

    return NextResponse.json({
      semana: `${semana.year}-W${String(semana.week).padStart(2, '0')}`,
      etiqueta: rango.etiqueta,
      puedeVerContacto,
      // Los dos números, sin ambigüedad: no es lo mismo un check-in que un
      // asistente, y la diferencia son los que vinieron por primera vez.
      checkins: deEstaSemana.length,
      asistentes: conHistoria.map(limpiar),
      dejaron: {
        /** De qué semana salen: "10–16 ago". */
        etiqueta: rangoRef.etiqueta,
        personas: abandonos(deLaDeAtras, atras.finDeLaEspera).map(a => ({
          ...limpiar(a),
          volvioEl: a.volvioEl,
        })),
      },
    })
  } catch (error) {
    reportarError('GET /api/reports/semana-asistentes:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
