import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { logAudit } from '@/lib/audit'
import { isUuid } from '@/lib/validate'
import { createPaymentPlan, getPlanForPayment, getPlanInstallments } from '@/lib/supabase/queries/payment-plans'
import { MIN_INSTALLMENTS, MAX_INSTALLMENTS } from '@/lib/finance/installments'

// Arreglo de pago en tractos sobre un pago PENDIENTE (FIN-4). Uso interno: solo
// finanzas, dirección y admin. Nunca es una opción de autoservicio.
const PLAN_ROLES = ['finanzas', 'direccion', 'admin'] as const

const bodySchema = z.object({
  installments: z.number().int().min(MIN_INSTALLMENTS).max(MAX_INSTALLMENTS),
  // Vencimiento del primer tracto; los demás van mes a mes desde ahí.
  first_due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha en formato YYYY-MM-DD'),
  notes: z.string().trim().max(500).optional(),
}).strict()

const ERRORES: Record<string, { error: string; status: number }> = {
  PAGO_NO_ENCONTRADO: { error: 'No se encontró el pago.', status: 404 },
  PAGO_NO_PENDIENTE:  { error: 'Solo un pago pendiente se puede partir en tractos.', status: 409 },
  PAGO_YA_EN_ARREGLO: { error: 'Este pago ya es parte de un arreglo de pago.', status: 409 },
  PAGO_SIN_OBJETO:    { error: 'El pago no está ligado a una matrícula ni a una inscripción, así que no se puede partir.', status: 409 },
  TRACTOS_INVALIDOS:  { error: `La cantidad de tractos debe estar entre ${MIN_INSTALLMENTS} y ${MAX_INSTALLMENTS}.`, status: 400 },
  MONTO_INSUFICIENTE: { error: 'El monto es muy chico para repartirlo en esa cantidad de tractos.', status: 400 },
}

// GET: el arreglo de este pago (si es un tracto) con todos sus tractos.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(...PLAN_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })
    const plan = await getPlanForPayment(id)
    if (!plan) return NextResponse.json({ plan: null, installments: [] })
    return NextResponse.json({ plan, installments: await getPlanInstallments(plan.id) })
  } catch (error) {
    console.error('GET /api/payments/[id]/payment-plan:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST: parte el pago en tractos.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(...PLAN_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }

    const result = await createPaymentPlan(
      id,
      { installments: parsed.data.installments, firstDue: parsed.data.first_due, notes: parsed.data.notes ?? null },
      auth.ctx.memberId,
    )

    await logAudit({
      actorUserId: auth.ctx.userId,
      action: 'INSERT',
      entityType: 'payment_plans',
      entityId: result.plan.id,
      newData: {
        payment_id: id,
        installments: result.plan.installments,
        total_amount: result.plan.total_amount,
        currency: result.plan.currency,
      },
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const known = error instanceof Error ? ERRORES[error.message] : undefined
    if (known) return NextResponse.json({ error: known.error, code: error instanceof Error ? error.message.toLowerCase() : undefined }, { status: known.status })
    console.error('POST /api/payments/[id]/payment-plan:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
