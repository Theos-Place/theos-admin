import { NextRequest, NextResponse } from 'next/server'
import { requireAccesoAReporte } from '@/lib/auth/guard'
import { ESTUDIOS_REPORTE_ROLES } from '@/lib/auth/roles'
import { getExalumnosPerdidos, getDirigentesConGrupos } from '@/lib/supabase/queries/no-volvieron'
import { reportarError } from '@/lib/observabilidad'

/**
 * GET · DIR-7 · Los exalumnos de un dirigente que dejaron de venir.
 *
 * EL RECORTE ES EL PUNTO DE ESTE ENDPOINT, así que se explica entero:
 *
 * · Un DIRIGENTE ve SOLO lo suyo. Su id lo pone el servidor desde la sesión,
 *   y el `?dirigente=` del request se IGNORA para él. No se valida que el
 *   parámetro coincida: se descarta. Validar invita a que mañana alguien
 *   afloje la comparación; descartarlo no tiene cómo fallar.
 * · Los ROLES DE ESTUDIOS sí eligen con el selector, igual que SRV-6. Sin
 *   dirigente elegido NO se carga la lista — se devuelve solo el catálogo,
 *   para no volcar 2 071 teléfonos de un vistazo al abrir la pantalla.
 *
 * La lista trae TELÉFONOS de gente que dejó de venir. Por eso el módulo
 * `reportes` a secas no alcanza (ver `acceso-por-reporte`): no es una
 * métrica, es una lista de contacto.
 */
export async function GET(req: NextRequest) {
  try {
    // El acceso lo decide la tabla de REP-11, no una lista escrita acá: la
    // cuarta puerta —ser dirigente— vive en `requireAccesoAReporte`.
    const auth = await requireAccesoAReporte('exalumnos-perdidos')
    if (auth.res) return auth.res
    const { ctx } = auth

    const esAmplio = (ctx.roles ?? []).some(
      r => (ESTUDIOS_REPORTE_ROLES as readonly string[]).includes(r),
    )
    const miId = ctx.memberId

    // El dirigente queda clavado a sí mismo; el rol amplio elige.
    const pedido = req.nextUrl.searchParams.get('dirigente')
    const leaderId = esAmplio ? pedido : miId

    if (esAmplio && !leaderId) {
      // Sin dirigente elegido: solo el catálogo del selector. Es la misma
      // decisión de SRV-6 — abrir la pantalla no debe volcar la lista entera.
      return NextResponse.json({
        esAmplio: true,
        dirigentes: await getDirigentesConGrupos(),
        exalumnos: null,
      })
    }
    if (!leaderId) {
      return NextResponse.json({ error: 'Tu usuario no tiene una ficha asociada.' }, { status: 403 })
    }

    return NextResponse.json({
      esAmplio,
      dirigenteId: leaderId,
      dirigentes: esAmplio ? await getDirigentesConGrupos() : undefined,
      exalumnos: await getExalumnosPerdidos(leaderId),
    })
  } catch (error) {
    reportarError('GET /api/reports/exalumnos-perdidos:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
