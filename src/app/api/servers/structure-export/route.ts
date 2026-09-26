import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'
import { reportarError } from '@/lib/observabilidad'
import { construirExportDeEstructura } from '@/lib/servers/export-de-estructura'
import { leerEstructuraDeServicio } from '@/lib/supabase/queries/estructura-de-servicio'

/**
 * GET · El .xlsx con toda la estructura de servicio: áreas, comités y puestos
 * con sus descripciones y detalles (pedido de Floriana, 2026-09-25).
 *
 * Roles amplios, los mismos de SRV-6. No es PII —son puestos y descripciones,
 * no personas—, pero sí es el catálogo completo de la organización, y el
 * encargado de un comité ya tiene el suyo en pantalla.
 *
 * SE TRAE TODO, activo e inactivo, y la columna lo dice: un puesto retirado es
 * justo lo que alguien viene a buscar cuando revisa el catálogo para limpiarlo,
 * y filtrarlo acá obligaría a pedir otro archivo.
 *
 * Leer y armar viven en sus propios módulos para poder probarlos; acá queda el
 * permiso y la respuesta.
 */
export async function GET() {
  const auth = await requireRoles(...SERVICE_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const buf = await construirExportDeEstructura(await leerEstructuraDeServicio())
    const hoy = new Date().toISOString().slice(0, 10)
    return new NextResponse(buf as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        // El archivo se llama como el botón: quien lo baja lo busca después
        // por el nombre que apretó, no por cómo se llama la ruta.
        'Content-Disposition': `attachment; filename="maestro-de-servicio-${hoy}.xlsx"`,
      },
    })
  } catch (error) {
    reportarError('GET /api/servers/structure-export:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
