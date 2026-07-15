import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { logAudit } from '@/lib/audit'
import { approvePayment, rejectPayment } from '@/lib/supabase/queries/payments'
import { notifyRejection } from '@/lib/email/payment-rejection-notify'

// POST: revisar un pago. Body: { action: 'approve'|'reject', reason? }.
// Aprobar: activa el objeto pagado (status=paid). Rechazar: pide motivo y avisa a
// la persona (notificación interna + correo). Sin correos en la aprobación (punto 6).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleView('revision_pagos', { action: 'edit' })
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const { action, reason } = (await req.json()) as { action?: 'approve' | 'reject'; reason?: string }

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

    return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 })
  } catch (error) {
    console.error('POST /api/payments/[id]/review:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
