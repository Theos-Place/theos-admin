import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validate'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRefunds, createRefund, type RefundWriteInput } from '@/lib/supabase/queries/finance'

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
    // Validación de negocio: el pago debe existir, estar pagado, y el monto
    // ser positivo sin exceder lo pagado (menos lo ya devuelto/pendiente).
    const amount = Number(body.amount)
    if (!body.payment_id || !isUuid(body.payment_id)) {
      return NextResponse.json({ error: 'payment_id inválido' }, { status: 400 })
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'El monto debe ser mayor a cero' }, { status: 400 })
    }
    const supabase = createAdminClient()
    const { data: pay } = await supabase
      .from('payments').select('id, amount, status, member_id').eq('id', body.payment_id).maybeSingle()
    if (!pay) return NextResponse.json({ error: 'El pago no existe' }, { status: 404 })
    const p = pay as { amount: number; status: string; member_id: string | null }
    if (p.status === 'refunded') {
      return NextResponse.json({ error: 'Ese pago ya fue devuelto' }, { status: 409 })
    }
    const { data: prev } = await supabase
      .from('refunds').select('amount, status').eq('payment_id', body.payment_id)
      .in('status', ['pending', 'processing', 'completed'])
    const alreadyRefunded = ((prev ?? []) as Array<{ amount: number }>).reduce((s, r) => s + Number(r.amount), 0)
    if (amount + alreadyRefunded > Number(p.amount)) {
      return NextResponse.json(
        { error: `El monto excede lo devolvible de este pago (máximo ₡${(Number(p.amount) - alreadyRefunded).toLocaleString('es-CR')}).` },
        { status: 400 },
      )
    }

    const refund = await createRefund({ ...body, amount, member_id: body.member_id ?? p.member_id })
    return NextResponse.json(refund, { status: 201 })
  } catch (error) {
    console.error('POST /api/finance/refunds:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
