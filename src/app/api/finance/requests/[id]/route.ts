import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { updateFinanceRequestStatus, assignFinanceRequest } from '@/lib/supabase/queries/finance-requests'
import { necesitaAprobacionPropia, validarAprobacion } from '@/lib/finance/aprobacion-de-beca'
import { approveScholarshipRequest } from '@/lib/supabase/queries/scholarships'
import { createAdminClient } from '@/lib/supabase/admin'

const ACTIONS: Record<string, 'in_review' | 'resolved' | 'rejected'> = {
  take: 'in_review',
  resolve: 'resolved',
  reject: 'rejected',
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

    const status = ACTIONS[body?.action as string]
    if (!status) {
      return NextResponse.json({ error: 'action debe ser take, assign, resolve o reject' }, { status: 400 })
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
    console.error('PATCH /api/finance/requests/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
