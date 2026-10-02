import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { logAudit } from '@/lib/audit'
import { isUuid } from '@/lib/validate'
import { setPaymentPlanEnabled } from '@/lib/supabase/queries/payment-plans'
import { reportarError } from '@/lib/observabilidad'

/**
 * FIN-13 · Habilitar (o quitar) el arreglo de pago sobre UN cobro.
 *
 * NO HAY BOTÓN PÚBLICO de «solicitar arreglo», y la decisión del 2026-09-29
 * tiene fundamento: el de becas nunca se promocionó y la gente curiosa lo
 * encontró igual. Un botón abierto convertiría la excepción en la vía normal
 * de pago. Así que finanzas habilita caso por caso, sobre un cobro concreto,
 * y recién entonces esa persona ve la opción en Mis pagos.
 *
 * QUIÉN: finanzas, dirección y admin — los mismos que ya pueden ARMAR el
 * arreglo. Habilitar es menos que armarlo, así que no corresponde pedir más.
 *
 * Queda en audit_log: «¿quién le habilitó el arreglo a fulano?» es la primera
 * pregunta cuando algo se discute, y la columna sola no dice quién lo quitó.
 */
const PLAN_ROLES = ['finanzas', 'direccion', 'admin'] as const

const bodySchema = z.object({
  habilitado: z.boolean(),
}).strict()

const ERRORES: Record<string, { error: string; status: number }> = {
  PAGO_NO_ENCONTRADO: { error: 'No se encontró el pago.', status: 404 },
  PAGO_NO_PENDIENTE: {
    error: 'Solo un pago pendiente se puede habilitar para arreglo.',
    status: 409,
  },
  PAGO_YA_EN_ARREGLO: {
    error: 'Este pago ya es parte de un arreglo de pago.',
    status: 409,
  },
}

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

    await setPaymentPlanEnabled(id, parsed.data.habilitado, auth.ctx.memberId)

    await logAudit({
      actorUserId: auth.ctx.userId,
      action: 'UPDATE',
      entityType: 'payments',
      entityId: id,
      newData: { payment_plan_enabled: parsed.data.habilitado },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    const known = error instanceof Error ? ERRORES[error.message] : undefined
    if (known) {
      return NextResponse.json(
        { error: known.error, code: error instanceof Error ? error.message.toLowerCase() : undefined },
        { status: known.status },
      )
    }
    reportarError('POST /api/payments/[id]/payment-plan/enable:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
