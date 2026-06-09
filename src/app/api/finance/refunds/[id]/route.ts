import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { processRefund } from '@/lib/supabase/queries/finance'

// PUT: procesa la devolución. Body: { status }. Al completar, marca el pago refunded.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('finanzas', 'direccion')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    const { status } = await req.json()
    await processRefund(id, status)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/finance/refunds/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
