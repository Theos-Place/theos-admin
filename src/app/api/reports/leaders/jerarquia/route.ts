import { NextResponse } from 'next/server'
import { requireAccesoAReporte } from '@/lib/auth/guard'
import { getFilasDeJerarquiaDeDirigentes } from '@/lib/supabase/queries/reports'
import { jerarquiaDeDirigentes } from '@/lib/reports/jerarquia-de-dirigentes'
import { puedeVerBanderita } from '@/lib/leaders/notas-confidenciales'
import { reportarError } from '@/lib/observabilidad'

/**
 * GET · DIR-9 · La jerarquía del reporte de dirigentes.
 *
 * La banderita se decide ACÁ y no en la pantalla: si el conteo viajara y el
 * cliente lo escondiera, bastaría abrir la pestaña de red para leerlo. Quien
 * no puede verla recibe `null`.
 */
export async function GET() {
  try {
    const auth = await requireAccesoAReporte('dirigentes')
    if (auth.res) return auth.res
    const verBanderitas = puedeVerBanderita(auth.ctx.roles)
    const filas = await getFilasDeJerarquiaDeDirigentes()
    // Los nombres viajan todos de una. Son ~514 y el drill-down abre al
    // instante sin otra llamada; pedirlos por celda serían 15 endpoints
    // para mostrar datos que estos roles ya ven en la ficha de cada uno.
    const nombres = Object.fromEntries(filas.map(f => [f.member_id, f.nombre]))
    return NextResponse.json({
      ...jerarquiaDeDirigentes(filas, { verBanderitas }),
      nombres,
      actualizado: new Date().toISOString(),
    })
  } catch (error) {
    reportarError('GET /api/reports/leaders/jerarquia:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
