import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getRefunds, createRefund, type RefundWriteInput } from '@/lib/supabase/queries/finance'

export async function GET() {
  try {
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
    const refund = await createRefund((await req.json()) as RefundWriteInput)
    return NextResponse.json(refund, { status: 201 })
  } catch (error) {
    console.error('POST /api/finance/refunds:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
