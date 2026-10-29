import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { SOPORTE_ROLES, puedeLevantarTiquete, motivoQueImpideCrear } from '@/lib/support/tiquete'
import { listSupportTickets, createSupportTicket, notificarNuevoTiquete } from '@/lib/supabase/queries/support-tickets'
import { logAudit } from '@/lib/audit'
import { reportarError } from '@/lib/observabilidad'

/** GET: la cola completa. Solo soporte (y admin). */
export async function GET() {
  const auth = await requireRoles(...SOPORTE_ROLES)
  if (auth.res) return auth.res
  try {
    return NextResponse.json(await listSupportTickets())
  } catch (error) {
    reportarError('GET /api/support-tickets:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

const bodySchema = z.object({
  details: z.string(),
  member_id: z.string().uuid().nullable().optional(),
  event_id: z.string().uuid().nullable().optional(),
}).strict()

/**
 * POST: levantar un tiquete desde la puerta.
 *
 * Lo levanta quien OPERA EL CHECK-IN y nadie más: se pregunta por el mismo
 * permiso que abre esa pantalla (`eventos:edit`), no por una lista aparte.
 * Soporte no levanta tiquetes —los resuelve—, y un miembro tampoco.
 */
export async function POST(req: NextRequest) {
  // Solo sesión: lo levanta quien opera el check-in (puedeLevantarTiquete, abajo); ese acceso sale del puesto o del evento.
  const auth = await requireRoles()
  if (auth.res) return auth.res
  if (!puedeLevantarTiquete(auth.ctx.roles)) {
    return NextResponse.json({ error: 'Solo quien opera el check-in puede levantar un tiquete de soporte.' }, { status: 403 })
  }
  if (!auth.ctx.memberId) {
    return NextResponse.json({ error: 'Tu usuario no está vinculado a un perfil de miembro' }, { status: 409 })
  }
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 })
    }
    const motivo = motivoQueImpideCrear(parsed.data.details)
    if (motivo) return NextResponse.json({ error: motivo }, { status: 400 })

    const ticket = await createSupportTicket({
      createdBy: auth.ctx.memberId,
      details: parsed.data.details,
      memberId: parsed.data.member_id ?? null,
      eventId: parsed.data.event_id ?? null,
    })
    await logAudit({
      actorUserId: auth.ctx.userId, action: 'INSERT', entityType: 'support_ticket', entityId: ticket.id,
      newData: { member_id: ticket.subject_member_id, event_id: ticket.event_id },
    })
    // SOP-3: la campana de admin y soporte técnico. Best-effort, después de
    // que el tiquete y su auditoría ya existen.
    try { await notificarNuevoTiquete(ticket) } catch (e) { reportarError('notificarNuevoTiquete:', e) }
    return NextResponse.json(ticket, { status: 201 })
  } catch (error) {
    reportarError('POST /api/support-tickets:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
