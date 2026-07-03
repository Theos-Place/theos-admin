import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { ROLES } from '@/lib/auth/roles'
import { getPaymentReceiptMeta, signReceiptUrl } from '@/lib/supabase/queries/payments'

// GET: URL firmada de corta duración del comprobante. Solo el DUEÑO del pago o
// quien tenga el permiso 'revision_pagos'. El bucket es privado.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const meta = await getPaymentReceiptMeta(id)
    if (!meta?.receipt_path) return NextResponse.json({ error: 'Sin comprobante.' }, { status: 404 })

    const isOwner = !!auth.ctx.memberId && auth.ctx.memberId === meta.member_id
    const isReviewer = auth.ctx.roles.some(rid => {
      const role = ROLES.find(r => r.id === rid)
      return role?.permissions.some(p =>
        (p.module === 'all' || p.module === 'revision_pagos') && (p.actions as string[]).includes('view'))
    })
    if (!isOwner && !isReviewer) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const url = await signReceiptUrl(meta.receipt_path, 120)
    if (!url) return NextResponse.json({ error: 'No se pudo generar el enlace.' }, { status: 500 })
    return NextResponse.json({ url })
  } catch (error) {
    console.error('GET /api/payments/[id]/receipt:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
