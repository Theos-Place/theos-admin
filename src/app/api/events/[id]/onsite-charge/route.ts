import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import {
  onsiteChargeAndCheckin,
  EventFullError,
  AlreadyRegisteredError,
  PaymentRequiredError,
} from '@/lib/supabase/queries/events'
import { notifyEventPendingCharge } from '@/lib/email/event-charge-notify'

const bodySchema = z.object({
  member_id: z.string().uuid(),
  mode: z.enum(['pending', 'verified']),
  method: z.enum(['manual', 'qr', 'smart_link']).optional(),
  sub_event_id: z.string().uuid().nullish(),
})

// POST: cobro en sitio + check-in de una persona NO inscrita a un evento pago.
// Fase 2. Dos caminos según `mode`:
//   - 'pending'  → inscribe + pago pendiente por comprobante + aviso por correo.
//   - 'verified' → inscribe + pago aprobado (encargado ya vio el comprobante).
// Mismos roles que el check-in: encargado_eventos / dirección (admin pasa).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles('encargado_eventos', 'direccion')
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
    const { member_id, mode, method, sub_event_id } = parsed.data

    const result = await onsiteChargeAndCheckin(id, {
      member_id,
      mode,
      method,
      sub_event_id,
      actor_member_id: auth.ctx.memberId,
    })

    // Camino 1: avisar a la persona del pago pendiente (best-effort, no bloquea).
    if (result.mode === 'pending' && result.charged) {
      await notifyEventPendingCharge(member_id, id, result.amount)
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof EventFullError) {
      return NextResponse.json({ error: error.message, code: 'event_full' }, { status: 409 })
    }
    if (error instanceof AlreadyRegisteredError) {
      return NextResponse.json({ error: error.message, code: 'already_registered' }, { status: 409 })
    }
    if (error instanceof PaymentRequiredError) {
      return NextResponse.json({ error: error.message, code: 'payment_required' }, { status: 400 })
    }
    console.error('POST /api/events/[id]/onsite-charge:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
