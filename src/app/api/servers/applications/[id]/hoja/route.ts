import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { SERVICE_APPLICATIONS_ROLES } from '@/lib/auth/service-applications'
import { getDetalleDeAplicante } from '@/lib/supabase/queries/servers'
import {
  construirDocxDeAplicante, nombreDelDocx, DOCX_CONTENT_TYPE,
} from '@/lib/servers/docx-de-aplicante'
import { logAudit } from '@/lib/audit'
import { reportarError } from '@/lib/observabilidad'

/**
 * SRV-14 · La hoja de quien aplicó, para descargar (.docx).
 *
 * QUIÉN: la misma lista que VE la bandeja. Es información personal —teléfono,
 * correo, con quién llevó su último estudio— y por eso no basta con tener
 * sesión.
 *
 * QUEDA REGISTRADO. Descargar los datos de contacto de una persona es una
 * exportación, y las exportaciones se firman: sin esto, «¿quién se bajó la
 * hoja de fulano?» no se contesta. Es el mismo criterio del export del padrón.
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

    const buf = await construirDocxDeAplicante(detalle)
    await logAudit({
      actorUserId: auth.ctx.userId,
      action: 'EXPORT',
      entityType: 'applications',
      entityId: id,
      newData: { formato: 'docx', persona: detalle.nombre, puesto: detalle.puesto },
    })

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': DOCX_CONTENT_TYPE,
        // `filename*` con UTF-8 porque los puestos llevan tildes («Logística»)
        // y el `filename` a secas las rompe en varios navegadores.
        'Content-Disposition':
          `attachment; filename*=UTF-8''${encodeURIComponent(nombreDelDocx(detalle.puesto, detalle.nombre))}`,
      },
    })
  } catch (error) {
    reportarError('GET /api/servers/applications/[id]/hoja:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
