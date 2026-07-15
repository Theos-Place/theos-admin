import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, secretsMatch } from '@/lib/auth/guard'
import { pingHealthcheck } from '@/lib/health'
import { expirePendingEventRegistrations } from '@/lib/supabase/queries/events'
import { expirePendingStudyEnrollments } from '@/lib/supabase/queries/studies'

/** Autorizado con el CRON_SECRET (edge function diaria) o sesión de dirección. */
async function authorize(req: NextRequest): Promise<NextResponse | null> {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secretsMatch(bearer, process.env.CRON_SECRET)) return null
  const auth = await requireRoles('direccion', 'admin')
  return auth.res ?? null
}

// POST: libera cupos "atascados" — inscripciones/matrículas pendientes de pago
// cuyo comprobante fue rechazado hace más de 72h sin que se haya resubido uno
// nuevo. Reserva de cupo (punto 9 del pedido): mientras el pago está en
// revisión, el cupo se cuenta como ocupado; si se vence el plazo sin resubir,
// se libera (event_registrations.payment_status='expired' /
// study_enrollments.status='expirada').
export async function POST(req: NextRequest) {
  const denied = await authorize(req)
  if (denied) return denied
  try {
    const [events, enrollments] = await Promise.all([
      expirePendingEventRegistrations(),
      expirePendingStudyEnrollments(),
    ])
    await pingHealthcheck('HEALTHCHECK_URL_PAYMENT_HOLDS_EXPIRE')
    return NextResponse.json({ events_expired: events.expired, enrollments_expired: enrollments.expired })
  } catch (error) {
    console.error('POST /api/cron/payment-holds-expire:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// Los crons de Vercel invocan con GET (vercel.json); mismo handler.
export const GET = POST
