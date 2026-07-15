import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { logAudit } from '@/lib/audit'
import { approvePayment, rejectPayment } from '@/lib/supabase/queries/payments'
import { notifyRejection } from '@/lib/email/payment-rejection-notify'

// POST /api/payments/bulk — { ids: string[], action: 'approve'|'reject', reason? }
// Aprobar/rechazar en lote desde la cola de revisión. Cada id se procesa con su
// propio try/catch: una aprobación en lote puede fallar a medias (otro revisor
// ya actuó sobre un pago mientras tanto) — se reporta en `failed`, no se aborta
// el resto.
export async function POST(req: NextRequest) {
  const auth = await requireModuleView('revision_pagos', { action: 'edit' })
  if (auth.res) return auth.res
  try {
    const { ids, action, reason } = (await req.json()) as {
      ids?: string[]; action?: 'approve' | 'reject'; reason?: string
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Se requiere una lista de ids.' }, { status: 400 })
    }
    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 })
    }
    const motivo = (reason ?? '').trim()
    if (action === 'reject' && !motivo) {
      return NextResponse.json({ error: 'El motivo de rechazo es obligatorio.' }, { status: 400 })
    }

    const result = { approved: 0, rejected: 0, failed: [] as Array<{ id: string; error: string }> }
    for (const id of ids) {
      try {
        if (action === 'approve') {
          const approved = await approvePayment(id, auth.ctx.memberId)
          if (!approved) throw new Error('Ya no estaba en revisión.')
          await logAudit({ actorUserId: auth.ctx.userId, action: 'APPROVE', entityType: 'payments', entityId: id })
          result.approved++
        } else {
          const rejected = await rejectPayment(id, auth.ctx.memberId, motivo)
          if (!rejected) throw new Error('Ya no estaba en revisión.')
          await logAudit({ actorUserId: auth.ctx.userId, action: 'REJECT', entityType: 'payments', entityId: id, newData: { reason: motivo } })
          await notifyRejection(rejected.member_id, motivo, rejected.concept)
          result.rejected++
        }
      } catch (e) {
        result.failed.push({ id, error: e instanceof Error ? e.message : 'Error desconocido' })
      }
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error('POST /api/payments/bulk:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
