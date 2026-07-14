import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { logAudit } from '@/lib/audit'
import { confirmSinpePayment } from '@/lib/supabase/queries/finance'

// Confirmación de pago SINPE: la ÚNICA mutación de este endpoint.
// Auditoría A1: el PUT genérico anterior aceptaba cualquier campo/transición
// (paid→pending, refunded→paid, cambiar amount) — era el mutador más
// peligroso del sistema.
const confirmSchema = z.object({
  status: z.literal('paid'),
  sinpe_confirmation: z.string().trim().min(1, 'El número de confirmación es obligatorio'),
  // Acepta ISO completo o fecha pura YYYY-MM-DD (el date input de la UI).
  paid_at: z.union([
    z.string().datetime({ offset: true }),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ]).nullish(),
}).strict()

// PUT: confirma un pago SINPE pendiente (pending → paid).
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('finanzas', 'direccion')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    const parsed = confirmSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    // Fecha pura → mediodía (evita corrimiento de día por zona horaria).
    const paidAt = parsed.data.paid_at
      ? (/^\d{4}-\d{2}-\d{2}$/.test(parsed.data.paid_at)
          ? new Date(`${parsed.data.paid_at}T12:00:00`).toISOString()
          : parsed.data.paid_at)
      : null
    const confirmed = await confirmSinpePayment(id, {
      sinpe_confirmation: parsed.data.sinpe_confirmation,
      paid_at: paidAt,
    })
    if (!confirmed) {
      return NextResponse.json(
        { error: 'El pago ya no está pendiente (o no es SINPE); refrescá la página.' },
        { status: 409 },
      )
    }
    await logAudit({ actorUserId: auth.ctx.userId, action: 'APPROVE', entityType: 'payments', entityId: id, newData: { via: 'sinpe_confirm' } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/finance/payments/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
