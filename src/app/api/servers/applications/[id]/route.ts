import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { setApplicationStatus, getDetalleDeAplicante } from '@/lib/supabase/queries/servers'
import {
  APPLICATION_STATES, APPLICATION_STATE_LABEL, motivoQueImpideCambiar, avisosDe, admiteMotivo,
} from '@/lib/servers/application-states'
import { GESTIONAN_APLICACIONES } from '@/lib/auth/service-applications'
import { logAudit } from '@/lib/audit'
import { reportarError } from '@/lib/observabilidad'

const bodySchema = z.object({
  status: z.enum(APPLICATION_STATES),
  /** Solo lo usa «en revisión». Opcional, como se pidió. */
  motivo: z.string().trim().max(500).nullish(),
}).strict()

/**
 * SRV-14 · PUT: cambia el estado de una aplicación.
 *
 * QUÉ HACE ADEMÁS DE CAMBIAR UN CAMPO, porque dos de los cinco estados no son
 * solo una etiqueta:
 *   · `approved` ACTIVA a la persona como servidora del puesto (RPC
 *     `approve_applications`) y le sincroniza los roles que ese puesto otorga.
 *     Eso ya existía; lo que se agrega es el aviso a RH y al staff.
 *   · `sent_to_leader` le manda los datos al encargado del comité que pidió
 *     el puesto.
 *   · `reviewing` avisa a RH y al staff, con el motivo si lo escribieron.
 *   · `rejected` no manda nada, a propósito.
 *
 * TODO CAMBIO QUEDA EN `audit_log`. Aceptar da de alta a alguien con permisos
 * y no tiene deshacer desde acá: sin registro, «¿quién la aceptó?» no se
 * contesta.
 *
 * El body se valida con zod y la TRANSICIÓN con la regla pura. Antes el
 * `status` entraba crudo del cliente hasta la base.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles(...GESTIONAN_APLICACIONES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 })
    }
    const { status, motivo } = parsed.data

    const { createAdminClient } = await import('@/lib/supabase/admin')
    const { data: actual } = await createAdminClient()
      .from('applications').select('status').eq('id', id).maybeSingle()
    const anterior = (actual as { status: string } | null)?.status
    if (!anterior) return NextResponse.json({ error: 'Aplicación no encontrada' }, { status: 404 })

    const impedimento = motivoQueImpideCambiar(anterior, status)
    if (impedimento) {
      return NextResponse.json({ error: impedimento, code: 'transicion_invalida' }, { status: 409 })
    }

    // El detalle se lee ANTES de mover el estado: al aceptar, el RPC toca
    // varias tablas, y leerlo después sería leer un mundo distinto del que se
    // está notificando.
    const detalle = await getDetalleDeAplicante(id)

    // La nota solo se guarda donde tiene sentido: en los demás estados no hay
    // dónde leerla y sobrescribiría la que quedó de la revisión anterior.
    await setApplicationStatus(
      id, status, auth.ctx.userId,
      admiteMotivo(status) ? (motivo?.trim() || null) : undefined,
    )

    await logAudit({
      actorUserId: auth.ctx.userId,
      action: status === 'approved' ? 'APPROVE' : status === 'rejected' ? 'REJECT' : 'UPDATE',
      entityType: 'applications',
      entityId: id,
      oldData: { status: anterior },
      newData: { status, ...(motivo?.trim() ? { motivo: motivo.trim() } : {}) },
    })

    // Best-effort: el estado ya cambió y es lo que la pantalla muestra.
    let avisados = 0
    if (detalle) {
      for (const aviso of avisosDe(status)) {
        try {
          if (aviso === 'encargado_del_puesto') {
            const { notificarAlEncargado } = await import('@/lib/email/application-notify')
            avisados += (await notificarAlEncargado({
              committeeId: detalle.committee_id, detalle,
            })).enviados
          } else {
            const { notificarSeguimiento } = await import('@/lib/email/application-notify')
            avisados += (await notificarSeguimiento({
              detalle,
              estado: status as 'reviewing' | 'approved',
              motivo: admiteMotivo(status) ? motivo ?? null : null,
            })).enviados
          }
        } catch (e) {
          console.warn('aviso de aplicación:', e)
        }
      }
    }

    return NextResponse.json({
      ok: true, status, etiqueta: APPLICATION_STATE_LABEL[status], avisados,
    })
  } catch (error) {
    reportarError('PUT /api/servers/applications/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
