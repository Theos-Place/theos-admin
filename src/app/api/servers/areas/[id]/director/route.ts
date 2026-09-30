import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'
import { setDirectoresDeArea } from '@/lib/supabase/queries/servers'
import { logAudit } from '@/lib/audit'
import { isUuid } from '@/lib/validate'
import { reportarError } from '@/lib/observabilidad'

/**
 * PUT · Quiénes dirigen un ÁREA. Reemplaza la lista completa.
 *
 * Es un endpoint aparte y no un campo más del PUT de `/areas/[id]` porque lo
 * que hace por debajo no es actualizar una fila: asigna y da de baja
 * voluntarios de un puesto, con la sincronización de roles que eso arrastra
 * (el rol `reportes` va y viene con el puesto). Mezclarlo con el rename del
 * área habría escondido eso detrás de un «guardar».
 *
 * Reemplaza la lista entera en vez de agregar/quitar de a uno: el área puede
 * tener varios directores —Enseñanza tiene dos— y una pantalla que manda el
 * estado final no puede desincronizarse con el servidor.
 */
const cuerpo = z.object({
  member_ids: z.array(z.string().refine(isUuid, 'member_id inválido')).max(10),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(...SERVICE_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Área inválida' }, { status: 400 })

    const parsed = cuerpo.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 })
    }
    // Sin repetidos: la misma persona dos veces haría dos asignaciones al
    // mismo puesto y la segunda no significa nada.
    const memberIds = [...new Set(parsed.data.member_ids)]

    await setDirectoresDeArea(id, memberIds, auth.ctx.userId)

    if (auth.ctx.userId) {
      await logAudit({
        actorUserId: auth.ctx.userId,
        action: 'UPDATE',
        entityType: 'areas',
        entityId: id,
        newData: { op: 'directores_de_area', member_ids: memberIds },
      })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'NO_ES_AREA') {
      return NextResponse.json(
        { error: 'El director se define en un ÁREA, no en un comité.' }, { status: 409 })
    }
    reportarError('PUT /api/servers/areas/[id]/director:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
