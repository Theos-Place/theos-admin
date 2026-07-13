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
    if (!['pending', 'processing', 'completed', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
    }
    await processRefund(id, status, {
      processedDate: typeof processed_date === 'string' ? processed_date : null,
      confirmation: typeof confirmation === 'string' ? confirmation : null,
      rejectReason: typeof reject_reason === 'string' ? reject_reason : null,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'YA_PROCESADO') {
      return NextResponse.json(
        { error: 'La devolución ya fue procesada (posiblemente por otro revisor). Refrescá la página.' },
        { status: 409 },
      )
    }
    console.error('PUT /api/finance/refunds/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
