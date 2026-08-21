import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { EVALUATION_ROLES } from '@/lib/auth/roles'
import {
  getEvaluationTicket, updateEvaluationTicketStatus, assignEvaluationTicket,
  markEvaluationTicketSent,
} from '@/lib/supabase/queries/evaluation-tickets'
import { releaseGroupFeedback } from '@/lib/supabase/queries/leader-feedback'
import { sendLeaderFeedbackReport } from '@/lib/email/leader-feedback-report-send'
import { ticketClosable } from '@/lib/studies/evaluation-window'
import type { EvaluationTicketStatus } from '@/types/evaluations'

const ACTIONS: Record<string, EvaluationTicketStatus> = {
  take: 'in_review',
  escalate: 'escalated',
  resolve: 'resolved',
  reject: 'rejected',
}

const bodySchema = z.object({
  action: z.enum(['take', 'assign', 'escalate', 'resolve', 'reject', 'send']),
  review_notes: z.string().optional(),
  assignee_member_id: z.string().uuid().optional(),
}).strict()

// PATCH: { action } sobre un tiquete de evaluación.
//
// 'send' es el envío MANUAL del resumen al dirigente (EST-13): comparte el
// compilado y manda el correo, registrando quién y cuándo en el tiquete.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRoles(...EVALUATION_ROLES)
    if (auth.res) return auth.res
    if (!auth.ctx.memberId) {
      return NextResponse.json(
        { error: 'Tu usuario no está vinculado a un perfil de miembro' }, { status: 409 })
    }
    const { id } = await params

    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 })
    }
    const { action, review_notes, assignee_member_id } = parsed.data

    const ticket = await getEvaluationTicket(id)
    if (!ticket) return NextResponse.json({ error: 'No existe ese tiquete' }, { status: 404 })

    if (action === 'assign') {
      if (!assignee_member_id) {
        return NextResponse.json({ error: 'Se requiere assignee_member_id' }, { status: 400 })
      }
      return NextResponse.json(
        await assignEvaluationTicket(id, assignee_member_id, auth.ctx.memberId))
    }

    // Envío manual del resumen al dirigente.
    if (action === 'send') {
      await releaseGroupFeedback(ticket.group_id, auth.ctx.memberId)
      const { sent, skipped } = await sendLeaderFeedbackReport(ticket.group_id)
      if (skipped) {
        return NextResponse.json({ error: `No se envió: ${skipped}` }, { status: 409 })
      }
      await markEvaluationTicketSent(ticket.group_id, auth.ctx.memberId)
      const updated = await getEvaluationTicket(id)
      return NextResponse.json({ ...updated, sent })
    }

    // No se cierra un tiquete cuya ventana sigue abierta: el compilado todavía
    // se puede mover, y revisar un número que cambia no es revisar.
    if ((action === 'resolve' || action === 'reject')
        && !ticketClosable({ requestedAt: ticket.feedback_requested_at })) {
      return NextResponse.json({
        error: `Todavía se pueden recibir respuestas (faltan ${ticket.days_left} días). El tiquete se puede cerrar cuando venza la ventana.`,
        code: 'ventana_abierta',
      }, { status: 409 })
    }

    return NextResponse.json(await updateEvaluationTicketStatus(
      id, ACTIONS[action], auth.ctx.memberId, review_notes?.trim() || null))
  } catch (error) {
    console.error('PATCH /api/evaluations/tickets/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
