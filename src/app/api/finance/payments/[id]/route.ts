import { NextRequest, NextResponse } from 'next/server'
import { updatePayment, type PaymentWriteInput } from '@/lib/supabase/queries/finance'

// PUT: actualiza un pago (p. ej. confirmar SINPE → status paid + confirmación).
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await updatePayment(id, (await req.json()) as Partial<PaymentWriteInput>)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/finance/payments/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
