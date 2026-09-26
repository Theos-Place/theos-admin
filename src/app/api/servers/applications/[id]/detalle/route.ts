import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { SERVICE_APPLICATIONS_ROLES } from '@/lib/auth/service-applications'
import { getDetalleDeAplicante } from '@/lib/supabase/queries/servers'
import { logAudit } from '@/lib/audit'
import { reportarError } from '@/lib/observabilidad'

/**
 * SRV-14 · El detalle de quien aplicó, para la hoja imprimible.
 *
 * QUIÉN: la misma lista que VE la bandeja. Son datos personales —teléfono,
 * correo, con quién llevó su último estudio— y no basta con tener sesión.
 *
 * QUEDA REGISTRADO. Abrir la hoja es sacar los datos de contacto de alguien:
 * sin registro, «¿quién se llevó la hoja de fulano?» no se contesta. Mismo
 * criterio que el export del padrón.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles(...SERVICE_APPLICATIONS_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const detalle = await getDetalleDeAplicante(id)
    if (!detalle) return NextResponse.json({ error: 'Aplicación no encontrada' }, { status: 404 })

    await logAudit({
      actorUserId: auth.ctx.userId,
      action: 'EXPORT',
      entityType: 'applications',
      entityId: id,
      newData: { formato: 'hoja', persona: detalle.nombre, puesto: detalle.puesto },
    })

    return NextResponse.json(detalle)
  } catch (error) {
    reportarError('GET /api/servers/applications/[id]/detalle:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
