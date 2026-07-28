import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, secretsMatch } from '@/lib/auth/guard'
import { pingHealthcheck } from '@/lib/health'
import { createAdminClient } from '@/lib/supabase/admin'
import { isRemindablePayment } from '@/lib/finance/payment-reminder-rules'
import { remindMembersPendingPayments } from '@/lib/supabase/queries/payment-reminders'

/** Autorizado con el CRON_SECRET o sesión de dirección/finanzas. */
async function authorize(req: NextRequest): Promise<NextResponse | null> {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secretsMatch(bearer, process.env.CRON_SECRET)) return null
  const auth = await requireRoles('direccion', 'finanzas', 'admin')
  return auth.res ?? null
}

// POST: recordatorio SEMANAL (lunes) de pagos pendientes (PAG-3). Una
// notificación interna CONSOLIDADA por miembro ("Tenés N pagos pendientes")
// con deep link a /mis-pagos. No recuerda pagos en revisión (la pelota está
// en finanzas) ni comprobantes rechazados que van a expirar igual (+72h).
// Prefs + dedupe diario los maneja remindMembersPendingPayments.
export async function POST(req: NextRequest) {
  const denied = await authorize(req)
  if (denied) return denied
  try {
    const supabase = createAdminClient()
    const now = new Date().toISOString()

    // Pagos pendientes con miembro (paginado: PostgREST corta en ~1000).
    const counts = new Map<string, number>()
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('payments')
        .select('member_id, status, review_status, reviewed_at')
        .eq('status', 'pending')
        .not('member_id', 'is', null)
        .order('id')
        .range(from, from + 999)
      if (error) throw error
      const rows = (data ?? []) as Array<{ member_id: string; status: string; review_status: string | null; reviewed_at: string | null }>
      for (const p of rows) {
        if (isRemindablePayment(p, now)) counts.set(p.member_id, (counts.get(p.member_id) ?? 0) + 1)
      }
      if (rows.length < 1000) break
    }

    const result = await remindMembersPendingPayments(
      [...counts.entries()].map(([memberId, count]) => ({ memberId, count })),
    )

    await pingHealthcheck('HEALTHCHECK_URL_PAYMENT_REMINDERS')
    return NextResponse.json({ members_with_pending: counts.size, ...result })
  } catch (error) {
    console.error('POST /api/cron/payment-reminders:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// Los crons de Vercel invocan con GET (vercel.json); mismo handler.
export const GET = POST
