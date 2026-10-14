import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { SOPORTE_ROLES, ACCION_A_ESTADO, puedeMover, MOTIVO_CERRADO } from '@/lib/support/tiquete'
import { getSupportTicket, updateSupportTicketStatus } from '@/lib/supabase/queries/support-tickets'
import { logAudit } from '@/lib/audit'
import { reportarError } from '@/lib/observabilidad'

const bodySchema = z.object({
  action: z.enum(['take', 'resolve', 'reject']),
  review_notes: z.string().optional(),
}).strict()

/** PATCH: { action: 'take' | 'resolve' | 'reject', review_notes? }. Solo soporte (y admin). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(...SOPORTE_ROLES)
  if (auth.res) return auth.res
  if (!auth.ctx.memberId) {
    return NextResponse.json({ error: 'Tu usuario no está vinculado a un perfil de miembro' }, { status: 409 })
  }
  try {
    const { id } = await params
    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 })
    }
    const ticket = await getSupportTicket(id)
    if (!ticket) return NextResponse.json({ error: 'No existe ese tiquete' }, { status: 404 })

    const destino = ACCION_A_ESTADO[parsed.data.action]
    if (!puedeMover(ticket.status, destino)) {
      return NextResponse.json({ error: MOTIVO_CERRADO, code: 'cerrado' }, { status: 409 })
    }
    const notas = parsed.data.review_notes?.trim() || null
    const updated = await updateSupportTicketStatus(id, destino, auth.ctx.memberId, notas)
    await logAudit({
      actorUserId: auth.ctx.userId, action: 'UPDATE', entityType: 'support_ticket', entityId: id,
      oldData: { status: ticket.status }, newData: { status: destino },
    })
    return NextResponse.json(updated)
  } catch (error) {
    reportarError('PATCH /api/support-tickets/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
