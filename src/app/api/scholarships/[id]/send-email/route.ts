import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireModuleView } from '@/lib/auth/guard'
import { logAudit } from '@/lib/audit'
import { sendScholarshipEmail, scholarshipEmailErrorResponse } from '@/lib/supabase/queries/scholarships'

// POST: envía por correo el código de un cupón genérico a una persona (o el
// aviso de una beca asignada a su dueño) y registra el envío (BEC-1).
// El dedupe es de UI: /finanzas/becas muestra el último envío y pide
// confirmación antes de reenviar. Guard: becas/finanzas (edit) — dirección y
// admin pasan por sus módulos.
const bodySchema = z.object({ member_id: z.uuid().nullish() }).strict()

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleView(['becas', 'finanzas'], { action: 'edit' })
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }

    const result = await sendScholarshipEmail(id, parsed.data.member_id ?? null)
    await logAudit({
      actorUserId: auth.ctx.userId,
      action: 'UPDATE',
      entityType: 'scholarships',
      entityId: id,
      newData: { email_sent_to: result.sent_to },
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const res = scholarshipEmailErrorResponse(error)
    if (res) return res
    console.error('POST /api/scholarships/[id]/send-email:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
