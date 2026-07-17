import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validate'
import { getRefunds, createRefund, type RefundWriteInput } from '@/lib/supabase/queries/finance'
import { formatCRC } from '@/lib/format'

export async function GET() {
  try {
    const auth = await requireModuleView('finanzas')
    if (auth.res) return auth.res
    return NextResponse.json(await getRefunds())
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
