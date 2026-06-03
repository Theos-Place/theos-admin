import { NextRequest, NextResponse } from 'next/server'
import { getRefunds, createRefund, type RefundWriteInput } from '@/lib/supabase/queries/finance'

export async function GET() {
  try {
    return NextResponse.json(await getRefunds())
  } catch (error) {
    console.error('GET /api/finance/refunds:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const refund = await createRefund((await req.json()) as RefundWriteInput)
    return NextResponse.json(refund, { status: 201 })
  } catch (error) {
    console.error('POST /api/finance/refunds:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
