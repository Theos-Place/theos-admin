import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validate'
import { isRemindablePayment } from '@/lib/finance/payment-reminder-rules'
import { remindMembersPendingPayments } from '@/lib/supabase/queries/payment-reminders'

// POST: recordatorio MANUAL de un pago (REV-2), desde la cola de revisión.
// Reusa la lógica del cron semanal (helper compartido): notificación interna
// con deep link a /mis-pagos?pago=<id>, prefs mensajes_sistema y dedupe por
// día — máximo un recordatorio manual por pago por día (409).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireModuleView('revision_pagos', { action: 'edit' })
  if (auth.res) return auth.res
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })
    const supabase = createAdminClient()
    const { data: pay } = await supabase
      .from('payments')
      .select('id, member_id, status, review_status, reviewed_at')
      .eq('id', id)
      .maybeSingle()
    const p = pay as { id: string; member_id: string | null; status: string; review_status: string | null; reviewed_at: string | null } | null
    if (!p) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })
    if (!p.member_id) return NextResponse.json({ error: 'El pago no tiene un miembro asociado.' }, { status: 409 })
    if (!isRemindablePayment(p, new Date().toISOString())) {
      return NextResponse.json(
        { error: 'Este pago no amerita recordatorio (ya está pagado, en revisión, o el comprobante rechazado ya venció).', code: 'no_recordable' },
        { status: 409 },
      )
    }

    const result = await remindMembersPendingPayments([{ memberId: p.member_id, count: 1, paymentId: p.id }])
    if (result.skipped_dup > 0) {
      return NextResponse.json(
        { error: 'Ya se envió un recordatorio de este pago hoy. Máximo uno por día.', code: 'ya_recordado' },
        { status: 409 },
      )
    }
    if (result.skipped_pref > 0) {
      return NextResponse.json(
        { error: 'El miembro silenció las notificaciones del sistema; no se le puede recordar por este medio.', code: 'silenciado' },
        { status: 409 },
      )
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/payments/[id]/remind:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
