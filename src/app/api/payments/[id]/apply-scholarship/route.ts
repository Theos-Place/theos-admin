import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireModuleView } from '@/lib/auth/guard'
import { logAudit } from '@/lib/audit'
import {
  applyScholarshipToPayment, scholarshipErrorResponse, paymentApplyErrorResponse,
} from '@/lib/supabase/queries/scholarships'

// POST: aplica una beca asignada o un código de cupón a un pago PENDIENTE
// (BEC-1). Recalcula el monto; beca completa → el pago queda aprobado sin
// comprobante (approve_payment); parcial → sigue pendiente por el resto.
// Guard: becas o revisión de pagos, con edit (los roles de finanzas tienen ambos).
const bodySchema = z
  .object({
    scholarship_id: z.uuid().optional(),
    coupon_code: z.string().trim().min(1).max(60).optional(),
  })
  .strict()
  .refine(b => !!b.scholarship_id !== !!b.coupon_code, {
    message: 'Indicá la beca asignada O un código de cupón (uno de los dos).',
  })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleView(['becas', 'revision_pagos'], { action: 'edit' })
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

    const result = await applyScholarshipToPayment(id, parsed.data, auth.ctx.memberId)
    await logAudit({
      actorUserId: auth.ctx.userId,
      action: 'UPDATE',
      entityType: 'payments',
      entityId: id,
      newData: { scholarship_applied: parsed.data, amount: result.amount, covered: result.covered },
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const res = paymentApplyErrorResponse(error) ?? scholarshipErrorResponse(error)
    if (res) return res
    console.error('POST /api/payments/[id]/apply-scholarship:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
