import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireModuleView } from '@/lib/auth/guard'
import { logAudit } from '@/lib/audit'
import { approvePayment, rejectPayment, transitionPaymentQueue } from '@/lib/supabase/queries/payments'
import { notifyRejection } from '@/lib/email/payment-rejection-notify'

// POST: revisar/gestionar un tiquete de pago.
// Body: { action, reason? }. Acciones:
//   - 'approve'      → activa el objeto pagado (status=paid). Sin correo (punto 6).
//   - 'reject'       → pide motivo y avisa a la persona (para resubir comprobante).
//   - 'start_review' → pendiente ➜ en revisión (seguimiento manual, Fase 3b).
//   - 'reopen'       → en revisión ➜ pendiente (deshace, sin avisar).
//   - 'close'        → cierra el tiquete SIN cobro (status=failed) con motivo.
const bodySchema = z.object({
  action: z.enum(['approve', 'reject', 'start_review', 'reopen', 'close']),
  reason: z.string().optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleView('revision_pagos', { action: 'edit' })
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const parsed = bodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    const { action, reason } = parsed.data

    if (action === 'approve') {
      const approved = await approvePayment(id, auth.ctx.memberId)
      if (!approved) return NextResponse.json({ error: 'El pago ya no está en revisión.' }, { status: 409 })
      await logAudit({ actorUserId: auth.ctx.userId, action: 'APPROVE', entityType: 'payments', entityId: id })
      return NextResponse.json({ ok: true })
    }

    if (action === 'reject') {
      const motivo = (reason ?? '').trim()
      if (!motivo) return NextResponse.json({ error: 'El motivo de rechazo es obligatorio.' }, { status: 400 })
      const rejected = await rejectPayment(id, auth.ctx.memberId, motivo)
      if (!rejected) return NextResponse.json({ error: 'El pago ya no está en revisión.' }, { status: 409 })
      await logAudit({ actorUserId: auth.ctx.userId, action: 'REJECT', entityType: 'payments', entityId: id, newData: { reason: motivo } })
      await notifyRejection(rejected.member_id, motivo, rejected.concept)
      return NextResponse.json({ ok: true })
    }

    // Transiciones manuales de seguimiento (start_review | reopen | close).
    if (action === 'close') {
      const motivo = (reason ?? '').trim()
      if (!motivo) return NextResponse.json({ error: 'Indicá por qué se cierra el tiquete.' }, { status: 400 })
      const ok = await transitionPaymentQueue(id, 'close', auth.ctx.memberId, motivo)
      if (!ok) return NextResponse.json({ error: 'El tiquete ya no estaba abierto.' }, { status: 409 })
      await logAudit({ actorUserId: auth.ctx.userId, action: 'UPDATE', entityType: 'payments', entityId: id, newData: { queue_action: 'close', reason: motivo } })
      return NextResponse.json({ ok: true })
    }

    const ok = await transitionPaymentQueue(id, action, auth.ctx.memberId)
    if (!ok) return NextResponse.json({ error: 'El tiquete cambió de estado; refrescá la lista.' }, { status: 409 })
    await logAudit({ actorUserId: auth.ctx.userId, action: 'UPDATE', entityType: 'payments', entityId: id, newData: { queue_action: action } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/payments/[id]/review:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
