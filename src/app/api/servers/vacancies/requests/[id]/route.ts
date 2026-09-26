import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'
import { cambiarEstadoDeSolicitud } from '@/lib/supabase/queries/servers'
import { VACANCY_STATES } from '@/lib/servers/vacancy-states'
import { logAudit } from '@/lib/audit'
import { reportarError } from '@/lib/observabilidad'

/**
 * SRV-15b · Mover una solicitud de puesto a mano.
 *
 * QUIÉN: la coordinación de servidores, admin y dirección — los mismos que
 * publican. El rol `solicitudes_puestos` arma las solicitudes y ve la
 * pantalla, pero bajar algo de la página pública o denegarlo no es armar una
 * solicitud.
 *
 * QUÉ TRANSICIONES VALEN lo decide `motivoQueImpideCambiar` contra el estado
 * que hay en la base en este momento (ver `cambiarEstadoDeSolicitud`). Acá no
 * se repite la tabla: con dos copias, la de la pantalla y la del servidor se
 * separan el día que alguien toque una.
 *
 * `publicada` está en el enum del body y aun así el cambio lo rechaza la
 * regla, con un 409 que dice por qué. Es a propósito: sacarlo del enum daría
 * «Datos inválidos», que se lee como un error del sistema y no como «esto se
 * hace con Publicar puestos».
 */
const cambioSchema = z.object({ status: z.enum(VACANCY_STATES) }).strict()

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRoles(...SERVICE_ADMIN_ROLES)
    if (auth.res) return auth.res

    const { id } = await params
    const parsed = cambioSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }

    const r = await cambiarEstadoDeSolicitud(id, parsed.data.status)
    if (r === null) return NextResponse.json({ error: 'No existe esa solicitud.' }, { status: 404 })
    if (!r.ok) {
      return NextResponse.json({ error: r.motivo, code: 'transicion_invalida' }, { status: 409 })
    }

    // Cambia lo que se ve desde afuera y no tiene deshacer automático. Se firma
    // de dónde venía y no solo a dónde fue: «quedó denegada» no contesta si
    // estaba publicada cuando la denegaron, y la fila ya no lo puede decir.
    await logAudit({
      actorUserId: auth.ctx.userId,
      action: 'UPDATE',
      entityType: 'vacancies',
      entityId: id,
      oldData: { status: r.anterior },
      newData: { status: parsed.data.status },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    reportarError('PATCH /api/servers/vacancies/requests/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
