import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { processRefund } from '@/lib/supabase/queries/finance'

// PUT: procesa la devolución. Body: { status, processed_date?, confirmation?,
// reject_reason? }. Al completar, marca el pago refunded.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('finanzas', 'direccion')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    const { status, processed_date, confirmation, reject_reason } = await req.json()
    await processRefund(id, status, {
      processedDate: typeof processed_date === 'string' ? processed_date : null,
      confirmation: typeof confirmation === 'string' ? confirmation : null,
      rejectReason: typeof reject_reason === 'string' ? reject_reason : null,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/finance/refunds/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
