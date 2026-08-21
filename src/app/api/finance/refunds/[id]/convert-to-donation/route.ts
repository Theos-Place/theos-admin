import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { logAudit } from '@/lib/audit'
import { isUuid } from '@/lib/validate'
import { convertRefundToDonation } from '@/lib/supabase/queries/refund-actions'

// FIN-6 (4) · La persona no quiere el reembolso: se convierte en donación.
//
// Solo finanzas y dirección: es plata que cambia de naturaleza (contabilidad lo
// confirmó el 2026-08-21). El cliente confirma con el monto a la vista, y acá se
// exige que el monto confirmado COINCIDA con el de la devolución — así un
// refresco desactualizado no convierte una cifra distinta a la que se vio.
const bodySchema = z.object({
  confirm_amount: z.number().positive(),
}).strict()

const ERRORES: Record<string, { error: string; status: number }> = {
  DEVOLUCION_NO_ENCONTRADA: { error: 'No se encontró la devolución.', status: 404 },
  DEVOLUCION_YA_RESUELTA:   { error: 'Esta devolución ya fue resuelta.', status: 409 },
  YA_CONVERTIDA:            { error: 'Esta devolución ya se había convertido en donación.', status: 409 },
  SIN_MIEMBRO:              { error: 'La devolución no tiene miembro asociado, así que no se puede acreditar la donación.', status: 409 },
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles('finanzas', 'direccion')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Devolución no encontrada' }, { status: 404 })

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }

    const { createAdminClient } = await import('@/lib/supabase/admin')
    const { data: ref } = await createAdminClient()
      .from('refunds').select('amount').eq('id', id).maybeSingle()
    if (!ref) return NextResponse.json({ error: 'No se encontró la devolución.' }, { status: 404 })
    if (Number((ref as { amount: number }).amount) !== parsed.data.confirm_amount) {
      return NextResponse.json(
        { error: 'El monto cambió desde que abriste la pantalla. Refrescá y revisá antes de convertir.', code: 'monto_desactualizado' },
        { status: 409 },
      )
    }

    const result = await convertRefundToDonation(id, auth.ctx.memberId)

    await logAudit({
      actorUserId: auth.ctx.userId,
      action: 'UPDATE',
      entityType: 'refunds',
      entityId: id,
      newData: { status: 'convertida_donacion', ...result },
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const known = error instanceof Error ? ERRORES[error.message] : undefined
    if (known) return NextResponse.json({ error: known.error }, { status: known.status })
    console.error('POST /api/finance/refunds/[id]/convert-to-donation:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
