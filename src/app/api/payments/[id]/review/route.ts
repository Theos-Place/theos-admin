import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireModuleView } from '@/lib/auth/guard'
import { logAudit } from '@/lib/audit'
import { approvePayment, rejectPayment, revertPaymentApproval, transitionPaymentQueue, pagosDelMismoComprobante } from '@/lib/supabase/queries/payments'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyRejection } from '@/lib/email/payment-rejection-notify'
import { reportarError } from '@/lib/observabilidad'

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
  /** PAG-7 · Aprobar o rechazar TODOS los cobros del mismo comprobante. */
  todo_el_comprobante: z.boolean().optional(),
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
    const { action, reason, todo_el_comprobante } = parsed.data

    /**
     * PAG-7 · Un comprobante que cubre varios cobros es UNA transferencia: se
     * aprueba o se devuelve entero. Los cobros siguen siendo filas aparte, así
     * que se procesa cada uno por el MISMO camino de siempre; lo que cambia es
     * que la persona recibe UN aviso y no uno por cobro.
     */
    if (todo_el_comprobante && (action === 'approve' || action === 'reject')) {
      const ids = await pagosDelMismoComprobante(id)
      if (ids.length === 0) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })
      const motivo = (reason ?? '').trim()
      if (action === 'reject' && !motivo) return NextResponse.json({ error: 'El motivo de rechazo es obligatorio.' }, { status: 400 })
      let procesados = 0
      let aviso: { member_id: string; concept: never } | null = null
      for (const pid of ids) {
        if (action === 'approve') {
          if (await approvePayment(pid, auth.ctx.memberId)) {
            procesados++
            await logAudit({ actorUserId: auth.ctx.userId, action: 'APPROVE', entityType: 'payments', entityId: pid, newData: { comprobante_compartido: ids.length } })
          }
          continue
        }
        let r = await rejectPayment(pid, auth.ctx.memberId, motivo)
        let revirtio = false
        if (!r && await revertPaymentApproval(pid, auth.ctx.memberId, motivo)) {
          revirtio = true
          const { data: p } = await createAdminClient().from('payments').select('member_id, concept').eq('id', pid).maybeSingle()
          r = (p as { member_id: string; concept: never } | null) ?? null
        }
        if (r) {
          procesados++
          aviso = aviso ?? (r as { member_id: string; concept: never })
          await logAudit({ actorUserId: auth.ctx.userId, action: 'REJECT', entityType: 'payments', entityId: pid, newData: { reason: motivo, comprobante_compartido: ids.length, ...(revirtio ? { revirtio_aprobacion: true } : {}) } })
        }
      }
      if (procesados === 0) {
        return NextResponse.json({ error: 'Ninguno de los cobros de este comprobante estaba en un estado que se pueda cambiar.' }, { status: 409 })
      }
      if (aviso) await notifyRejection(aviso.member_id, motivo, aviso.concept)
      return NextResponse.json({ ok: true, procesados, total: ids.length })
    }

    if (action === 'approve') {
      const approved = await approvePayment(id, auth.ctx.memberId)
      if (!approved) return NextResponse.json({ error: 'El pago ya no está en revisión.' }, { status: 409 })
      await logAudit({ actorUserId: auth.ctx.userId, action: 'APPROVE', entityType: 'payments', entityId: id })
      return NextResponse.json({ ok: true })
    }

    if (action === 'reject') {
      const motivo = (reason ?? '').trim()
      if (!motivo) return NextResponse.json({ error: 'El motivo de rechazo es obligatorio.' }, { status: 400 })
      let rejected = await rejectPayment(id, auth.ctx.memberId, motivo)
      if (!rejected) {
        /**
         * REVERSIÓN (2026-08-27). Desde que el comprobante se acepta al subirlo,
         * casi ningún pago está ya 'en_revision': llegan directo a 'aprobado'.
         * rejectPayment solo actúa sobre 'en_revision', así que sin esto NADA se
         * podría devolver — el régimen nuevo sería una puerta de una sola vía.
         *
         * revert_payment_approval además DESHACE la activación: la matrícula
         * vuelve a pendiente de pago y la inscripción al evento a pendiente. Va
         * por RPC para que sea atómico: dejar el pago rechazado con la matrícula
         * activa es peor que no haber revertido.
         */
        const revertido = await revertPaymentApproval(id, auth.ctx.memberId, motivo)
        if (!revertido) return NextResponse.json({ error: 'El pago no está en un estado que se pueda rechazar.' }, { status: 409 })
        const { data: p } = await createAdminClient()
          .from('payments').select('member_id, concept').eq('id', id).maybeSingle()
        rejected = (p as { member_id: string; concept: never } | null) ?? null
        await logAudit({ actorUserId: auth.ctx.userId, action: 'REJECT', entityType: 'payments', entityId: id, newData: { reason: motivo, revirtio_aprobacion: true } })
        if (rejected) await notifyRejection(rejected.member_id, motivo, rejected.concept)
        return NextResponse.json({ ok: true, revirtio_aprobacion: true })
      }
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
    reportarError('POST /api/payments/[id]/review:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
