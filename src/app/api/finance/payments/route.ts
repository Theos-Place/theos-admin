import { NextRequest, NextResponse } from 'next/server'
import { getPayments, createPayment, type PaymentWriteInput } from '@/lib/supabase/queries/finance'

export async function GET() {
  try {
    return NextResponse.json(await getPayments())
  } catch (error) {
    console.error('GET /api/finance/payments:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payment = await createPayment((await req.json()) as PaymentWriteInput)
    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    console.error('POST /api/finance/payments:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
