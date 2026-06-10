import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getPayments, createPayment, type PaymentWriteInput } from '@/lib/supabase/queries/finance'

export async function GET() {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    return NextResponse.json(await getPayments())
  } catch (error) {
    console.error('GET /api/finance/payments:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
    const auth = await requireRoles('finanzas', 'direccion')
    if (auth.res) return auth.res
  try {
    const payment = await createPayment((await req.json()) as PaymentWriteInput)
    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    console.error('POST /api/finance/payments:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
