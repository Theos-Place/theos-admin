import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import {
  updateFinanceRequestStatus, assignFinanceRequest, ofrecerArregloEnLugarDeBeca,
} from '@/lib/supabase/queries/finance-requests'
import { MIN_INSTALLMENTS, MAX_INSTALLMENTS, FREQUENCIES } from '@/lib/finance/installments'
import { logAudit } from '@/lib/audit'
import { necesitaAprobacionPropia, validarAprobacion } from '@/lib/finance/aprobacion-de-beca'
import { approveScholarshipRequest } from '@/lib/supabase/queries/scholarships'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportarError } from '@/lib/observabilidad'

const ACTIONS: Record<string, 'in_review' | 'resolved' | 'rejected'> = {
  take: 'in_review',
  resolve: 'resolved',
  reject: 'rejected',
}

/**
 * BEC-5 punto 6 · «Ofrecer arreglo de pago en su lugar».
 *
 * Mismos campos que el arreglo de FIN-8, porque es el mismo arreglo: lo arma
 * createPaymentPlan y los límites se aplican donde siempre.
 */
const arregloSchema = z.object({
  action: z.literal('offer_plan'),
  installments: z.number().int().min(MIN_INSTALLMENTS).max(MAX_INSTALLMENTS),
  frequency: z.enum(FREQUENCIES).optional(),
  first_due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha en formato YYYY-MM-DD'),
  review_notes: z.string().trim().max(500).optional(),
}).strict()

const ERRORES_ARREGLO: Record<string, { error: string; status: number }> = {
  SOLICITUD_NO_ENCONTRADA: { error: 'No se encontró la solicitud de beca.', status: 404 },
  SOLICITUD_CERRADA: { error: 'Esta solicitud ya está cerrada.', status: 409 },
  SIN_COBRO: {
    error: 'No hay un cobro pendiente al cual aplicarle el arreglo. Registrá primero la '
      + 'matrícula.',
    status: 409,
  },
  PAGO_NO_PENDIENTE: { error: 'Solo un cobro pendiente se puede partir en tractos.', status: 409 },
  PAGO_YA_EN_ARREGLO: { error: 'Ese cobro ya es parte de un arreglo de pago.', status: 409 },
  PAGO_SIN_OBJETO: { error: 'El cobro no está ligado a una matrícula ni a una inscripción.', status: 409 },
  TRACTOS_INVALIDOS: { error: `La cantidad de tractos debe estar entre ${MIN_INSTALLMENTS} y ${MAX_INSTALLMENTS}.`, status: 400 },
  MONTO_INSUFICIENTE: { error: 'El monto es muy chico para repartirlo en esa cantidad de tractos.', status: 400 },
}

// PATCH: { action: 'take' | 'resolve' | 'reject', review_notes? } — finanzas/admin.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRoles('finanzas')
    if (auth.res) return auth.res
    if (!auth.ctx.memberId) {
      return NextResponse.json({ error: 'Tu usuario no está vinculado a un perfil de miembro' }, { status: 409 })
    }
    const { id } = await params
    const body = await req.json()

    // assign: pasa a in_review con reviewed_by = la persona de finanzas ASIGNADA.
    if (body?.action === 'assign') {
      if (typeof body?.assignee_member_id !== 'string' || !body.assignee_member_id) {
        return NextResponse.json({ error: 'Se requiere assignee_member_id' }, { status: 400 })
      }
      const updated = await assignFinanceRequest(id, body.assignee_member_id, auth.ctx.memberId)
      return NextResponse.json(updated)
    }

    /**
     * offer_plan: la beca se resuelve con un ARREGLO, no con un rechazo.
     *
     * Va antes del mapa de ACTIONS porque no es un cambio de estado a secas:
     * crea el arreglo y recién entonces resuelve la solicitud. Si el arreglo
     * falla, la solicitud NO se toca — prometerle tractos a alguien y dejarle
     * la beca cerrada sería lo peor de los dos mundos.
     */
    if (body?.action === 'offer_plan') {
      const parsed = arregloSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
          { status: 400 },
        )
      }
      try {
        const r = await ofrecerArregloEnLugarDeBeca(id, {
          installments: parsed.data.installments,
          firstDue: parsed.data.first_due,
          frequency: parsed.data.frequency,
          notes: parsed.data.review_notes ?? null,
        }, auth.ctx.memberId)
        await logAudit({
          actorUserId: auth.ctx.userId,
          action: 'INSERT',
          entityType: 'payment_plans',
          entityId: r.plan_id,
          newData: { finance_request_id: id, payment_id: r.payment_id, installments: parsed.data.installments },
        })
        return NextResponse.json(r, { status: 201 })
      } catch (e) {
        const known = e instanceof Error ? ERRORES_ARREGLO[e.message] : undefined
        if (known) {
          return NextResponse.json(
            { error: known.error, code: (e as Error).message.toLowerCase() },
            { status: known.status },
          )
        }
        throw e
      }
    }

    const status = ACTIONS[body?.action as string]
    if (!status) {
      return NextResponse.json(
        { error: 'action debe ser take, assign, resolve, reject u offer_plan' },
        { status: 400 },
      )
    }

    /**
     * RESOLVER una solicitud de BECA no es cambiarle el estado: es crear la
     * beca, que es lo que después le da el descuento a la persona y dispara su
     * correo. Antes este endpoint la marcaba "resuelta" y nada más, y el
     * tablero de finanzas la ofrecía como cualquier otra: el 2026-09-11 se
     * aprobaron seis así — seis mensajes de "Beca Aprobada" escritos a mano que
     * nadie recibió, y tres personas que se matricularon y pagaron completo.
     *
     * El guard va acá y no en el botón: cualquier cliente que llame a este
     * endpoint tiene que traer el descuento.
     */
    if (status === 'resolved') {
      const { data: fr } = await createAdminClient()
        .from('finance_requests').select('request_type').eq('id', id).maybeSingle()
      const tipo = (fr as { request_type?: string } | null)?.request_type
      if (necesitaAprobacionPropia(tipo)) {
        const v = validarAprobacion(body)
        if (!v.ok) {
          return NextResponse.json(
            { error: v.error, code: 'aprobacion_incompleta' },
            { status: 400 },
          )
        }
        await approveScholarshipRequest(id, {
          ...v.datos,
          reviewerMemberId: auth.ctx.memberId,
          reviewerUserId: auth.ctx.userId,
        })
        // approveScholarshipRequest ya deja la solicitud en 'resolved'; se
        // relee para devolverle al tablero la fila con su historial nuevo.
        const { getFinanceRequests } = await import('@/lib/supabase/queries/finance-requests')
        const todas = await getFinanceRequests()
        const actualizada = todas.find(r => r.id === id)
        if (actualizada) return NextResponse.json(actualizada)
      }
    }

    const updated = await updateFinanceRequestStatus(
      id, status, auth.ctx.memberId,
      typeof body?.review_notes === 'string' ? body.review_notes.trim() || null : null,
    )
    return NextResponse.json(updated)
  } catch (error) {
    reportarError('PATCH /api/finance/requests/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
