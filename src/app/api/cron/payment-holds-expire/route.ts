import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, secretsMatch } from '@/lib/auth/guard'
import { pingHealthcheck } from '@/lib/health'
import { expirePendingEventRegistrations } from '@/lib/supabase/queries/events'

/** Autorizado con el CRON_SECRET (edge function diaria) o sesión de dirección. */
async function authorize(req: NextRequest): Promise<NextResponse | null> {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secretsMatch(bearer, process.env.CRON_SECRET)) return null
  const auth = await requireRoles('direccion', 'admin')
  return auth.res ?? null
}

// POST: libera cupos "atascados" de EVENTOS — inscripciones pendientes de pago
// cuyo comprobante fue rechazado hace más de 72h sin que se haya resubido uno
// nuevo (event_registrations.payment_status='expired').
//
// 2026-08-04: dejó de tocar las matrículas de estudio. La matrícula es efectiva
// desde que se hace y el pago es un carril aparte: un comprobante rechazado se
// vuelve a subir y finanzas le da seguimiento, pero NADIE queda desmatriculado
// por un pago sin resolver. La inscripción a eventos sigue igual — ahí el cupo
// sí se reserva contra el pago.
export async function POST(req: NextRequest) {
  const denied = await authorize(req)
  if (denied) return denied
  try {
    const events = await expirePendingEventRegistrations()
    await pingHealthcheck('HEALTHCHECK_URL_PAYMENT_HOLDS_EXPIRE')
    return NextResponse.json({ events_expired: events.expired })
  } catch (error) {
    console.error('POST /api/cron/payment-holds-expire:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// Los crons de Vercel invocan con GET (vercel.json); mismo handler.
export const GET = POST
