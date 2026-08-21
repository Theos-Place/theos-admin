import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { logAudit } from '@/lib/audit'
import { isUuid } from '@/lib/validate'
import { cancelPaymentPlan, getPlanInstallments } from '@/lib/supabase/queries/payment-plans'

const PLAN_ROLES = ['finanzas', 'direccion', 'admin'] as const

// Acción puntual sobre el arreglo, como enum (convención del repo: no endpoints
// ad-hoc por acción).
const bodySchema = z.object({
  action: z.enum(['cancelar']),
}).strict()

// PATCH: cancela el arreglo.
//
// OJO — cancelar el arreglo NO perdona la deuda (decisión 2026-08-21): los
// tractos impagos quedan pendientes, así que siguen bloqueando matrículas y
// siguen entrando a los recordatorios semanales. Para condonar se usa "Cerrar
// sin cobrar" en cada tracto.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(...PLAN_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Arreglo no encontrado' }, { status: 404 })

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }

    const ok = await cancelPaymentPlan(id)
    if (!ok) {
      return NextResponse.json(
        { error: 'El arreglo ya no estaba activo.', code: 'no_activo' },
        { status: 409 },
      )
    }

    const pendientes = (await getPlanInstallments(id)).filter(t => t.status === 'pending').length
    await logAudit({
      actorUserId: auth.ctx.userId,
      action: 'UPDATE',
      entityType: 'payment_plans',
      entityId: id,
      newData: { status: 'cancelado', tractos_pendientes: pendientes },
    })

    return NextResponse.json({ ok: true, tractos_pendientes: pendientes })
  } catch (error) {
    console.error('PATCH /api/payment-plans/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
