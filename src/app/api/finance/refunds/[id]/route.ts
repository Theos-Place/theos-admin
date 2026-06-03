import { NextRequest, NextResponse } from 'next/server'
import { processRefund } from '@/lib/supabase/queries/finance'

// PUT: procesa la devolución. Body: { status }. Al completar, marca el pago refunded.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { status } = await req.json()
    await processRefund(id, status)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/finance/refunds/[id]:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
