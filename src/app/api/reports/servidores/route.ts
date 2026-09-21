import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCompromisosDeComites } from '@/lib/supabase/queries/mi-comite'
import { reportarError } from '@/lib/observabilidad'

/**
 * GET · REP-7 · Servidores y sus compromisos, global / por área / por comité.
 *
 * `?area=<id>` acota a los comités de un área; `?comite=<id>` a uno solo; sin
 * nada, todos los comités activos.
 *
 * Roles amplios nada más (los mismos de SRV-6). El `lider_comite` NO entra: para
 * su gente tiene "Mi comité", y este reporte es la vista de dirección sobre
 * toda la organización.
 *
 * Las filas salen de `getCompromisosDeComites`, la MISMA consulta que alimenta
 * "Mi comité". Si un comité diera números distintos en los dos lados, sería un
 * bug — y por eso no hay una segunda definición de los compromisos acá.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRoles(...SERVICE_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const supabase = createAdminClient()
    const areaId = req.nextUrl.searchParams.get('area')
    const comiteId = req.nextUrl.searchParams.get('comite')

    let q = supabase
      .from('areas')
      .select('id, name, parent_id')
      .eq('area_type', 'committee')
      .eq('is_active', true)
    if (comiteId) q = q.eq('id', comiteId)
    else if (areaId) q = q.eq('parent_id', areaId)

    const { data: comitesData, error } = await q
    if (error) throw error
    const comites = ((comitesData ?? []) as Array<{ id: string; name: string; parent_id: string | null }>)
      // Los comités de prueba no son gente a la que haya que ayudar. Salían de
      // primeros en el desglose —0% en todo— tapando los reales.
      .filter(c => !/\[prueba\]/i.test(c.name))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))

    const { data: areasData } = await supabase
      .from('areas').select('id, name').eq('area_type', 'area').eq('is_active', true)
    const areas = ((areasData ?? []) as Array<{ id: string; name: string }>)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))

    const filas = await getCompromisosDeComites(comites.map(c => c.id))

    return NextResponse.json({
      alcance: comiteId ? 'comite' : areaId ? 'area' : 'global',
      comites,
      areas,
      servidores: filas.map(f => ({
        member_id: f.member_id,
        nombre: f.nombre,
        comites: f.comites,
        puestos: f.puestos,
        asistencia: f.asistencia,
        llevandoEstudio: f.llevandoEstudio,
        dandoEstudio: f.dandoEstudio,
        estudio: f.estudio,
        donante: f.donante,
        ultimoCheckin: f.ultimoCheckin,
      })),
    })
  } catch (error) {
    reportarError('GET /api/reports/servidores:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
