import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validate'
import { getRefunds, createRefund, type RefundWriteInput } from '@/lib/supabase/queries/finance'
import { resolveRefundScope, scopeToRefundFilters } from '@/lib/auth/refunds-scope'
import type { RefundStatus } from '@/types/finance'
import { formatCRC } from '@/lib/format'

// FIN-6: la cola ya no es solo de finanzas. El responsable del ORIGEN también
// la ve, acotada a lo suyo (encargado de evento → sus eventos; coordinación de
// estudios → las que salen de un plan). Resolver sigue siendo de finanzas: eso
// lo gatean el PUT y los endpoints de acción, no este GET.
export async function GET(req: NextRequest) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res

    const { getManagedEventIds } = await import('@/lib/supabase/queries/events')
    const managedEventIds = auth.ctx.memberId ? await getManagedEventIds(auth.ctx.memberId) : []
    const scope = resolveRefundScope({ roles: auth.ctx.roles, managedEventIds })
    if (scope.access === 'none') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { searchParams } = req.nextUrl
    const kind = searchParams.get('kind')
    const planId = searchParams.get('plan_id')
    const status = searchParams.get('status')

    const refunds = await getRefunds({
      ...scopeToRefundFilters(scope),
      kind: kind ?? undefined,
      planId: planId && isUuid(planId) ? planId : undefined,
      status: (status as RefundStatus | null) ?? undefined,
    })
    // El cliente necesita saber si puede resolver para no mostrar acciones que
    // el server va a rechazar con 403.
    return NextResponse.json({ refunds, can_resolve: scope.canResolve, scope: scope.access })
  } catch (error) {
    console.error('GET /api/finance/refunds:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
    const auth = await requireRoles('finanzas', 'direccion')
    if (auth.res) return auth.res
  try {
    const body = (await req.json()) as RefundWriteInput
    if (!body.payment_id || !isUuid(body.payment_id)) {
      return NextResponse.json({ error: 'payment_id inválido' }, { status: 400 })
    }
    // Validación de negocio DENTRO del RPC transaccional (migración 116):
    // lock del pago + estado cobrado + tope contra lo ya devuelto. El
    // check-then-insert anterior permitía sobre-devolución por carrera.
    const result = await createRefund({ ...body, amount: Number(body.amount) })
    switch (result.code) {
      case 'ok':
        return NextResponse.json({ id: result.id }, { status: 201 })
      case 'not_found':
        return NextResponse.json({ error: 'El pago no existe' }, { status: 404 })
      case 'not_refundable':
        return NextResponse.json(
          { error: `Solo los pagos cobrados admiten devolución (este está "${result.status}").` },
          { status: 409 },
        )
      case 'invalid_amount':
        return NextResponse.json({ error: 'El monto debe ser mayor a cero' }, { status: 400 })
      case 'exceeds':
        return NextResponse.json(
          { error: `El monto excede lo devolvible de este pago (máximo ${formatCRC(Number(result.max))}).` },
          { status: 400 },
        )
    }
  } catch (error) {
    console.error('POST /api/finance/refunds:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
