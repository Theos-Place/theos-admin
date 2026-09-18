import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validate'
import { historialDeEntidad } from '@/lib/supabase/queries/audit'
import { MODULO_POR_ENTIDAD, type EntidadAuditable } from '@/lib/audit/entidades'
import { reportarError } from '@/lib/observabilidad'

/**
 * AUD-2 · GET /api/audit/<entityType>/<entityId> — qué le pasó a esta ficha.
 *
 * El permiso NO es "tener sesión": el historial muestra datos viejos de la
 * persona —correos, documento, fechas— que hoy podrían estar corregidos, y
 * además quién los tocó. Se exige el módulo correspondiente con alcance más
 * allá de 'own', que es el mismo listón del padrón: cualquier miembro tiene
 * `miembros:view` sobre su propia ficha y eso no puede abrirle la bitácora.
 *
 * `entityType` va contra una lista blanca. Es parte de la URL y entra directo
 * en la consulta; sin la lista, cualquiera podría pedir el historial de
 * `member_roles` o de tablas que ningún módulo cubre.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ entityType: string; entityId: string }> },
) {
  try {
    const { entityType, entityId } = await params
    const modulo = MODULO_POR_ENTIDAD[entityType as EntidadAuditable]
    if (!modulo) return NextResponse.json({ error: 'Historial no disponible para este tipo' }, { status: 404 })
    if (!isUuid(entityId)) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

    const auth = await requireModuleView(modulo, { beyondOwn: true })
    if (auth.res) return auth.res

    return NextResponse.json({ items: await historialDeEntidad(entityType, entityId) })
  } catch (error) {
    reportarError('GET /api/audit/[entityType]/[entityId]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
