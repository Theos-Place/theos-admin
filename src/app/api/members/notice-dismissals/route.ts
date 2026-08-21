import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { DOCUMENT_PROMPT_NOTICE } from '@/lib/members/document-prompt'

// POST: la persona descarta un aviso de su perfil. Se guarda con FECHA para
// que el aviso reaparezca al vencer el plazo (FIN-2: 14 días). Cada quien
// descarta SUS avisos — el member_id sale de la sesión, nunca del body, así
// que no se puede silenciar el aviso de otra persona.
const NOTICE_KEYS = [DOCUMENT_PROMPT_NOTICE] as const

const bodySchema = z.object({
  notice_key: z.enum(NOTICE_KEYS),
}).strict()

export async function POST(req: NextRequest) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    if (!auth.ctx.memberId) {
      return NextResponse.json({ error: 'Tu cuenta no tiene un perfil asociado.' }, { status: 400 })
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }

    const dismissedAt = new Date().toISOString()
    const { error } = await createAdminClient()
      .from('notice_dismissals')
      .upsert(
        { member_id: auth.ctx.memberId, notice_key: parsed.data.notice_key, dismissed_at: dismissedAt },
        { onConflict: 'member_id,notice_key' },
      )
    if (error) throw error

    return NextResponse.json({ ok: true, dismissed_at: dismissedAt })
  } catch (error) {
    console.error('POST /api/members/notice-dismissals:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
