import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { isUuid } from '@/lib/validate'
import { createAdminClient } from '@/lib/supabase/admin'

// Reenvía el aviso de acceso a un miembro con cuenta de Auth SIN activar. SOLO
// roles administrativos, service_role en backend. Manda el mismo correo sin
// token que la creación de la cuenta (lib/auth/account-ready.ts): la persona
// pide su enlace desde el login cuando lo va a usar. Si la cuenta ya está
// activada, no reenvía.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(...STUDY_ADMIN_ROLES)
  if (auth.res) return auth.res
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
  try {
    const supabase = createAdminClient()
    const { data: member } = await supabase.from('members').select('auth_user_id, email').eq('id', id).maybeSingle()
    const authUserId = (member as { auth_user_id: string | null } | null)?.auth_user_id ?? null
    const email = (member as { email: string | null } | null)?.email?.trim() || null

    if (!authUserId) return NextResponse.json({ error: 'Este miembro no tiene cuenta de acceso.' }, { status: 400 })
    if (!email) return NextResponse.json({ error: 'El miembro no tiene correo registrado.' }, { status: 400 })

    // No reenviar si ya está activada.
    const { data: cur } = await supabase.auth.admin.getUserById(authUserId)
    if (cur?.user?.email_confirmed_at) {
      return NextResponse.json({ error: 'La cuenta ya está activada.' }, { status: 400 })
    }

    // 2026-08-04: ANTES esto llamaba a auth.admin.inviteUserByEmail. Tres
    // problemas reales: salía por el SMTP de Supabase (no por SES), el enlace
    // vencía antes de que la persona lo abriera, y CADA reenvío invalidaba el
    // enlace anterior — quien tenía el primer correo abierto se topaba con
    // "enlace vencido" sin haber hecho nada. Ahora se manda el mismo aviso sin
    // token que la creación de la cuenta: la persona pide su enlace desde el
    // login cuando lo va a usar.
    const { data: m } = await supabase.from('members').select('first_name').eq('id', id).maybeSingle()
    const { sendAccountReadyEmail } = await import('@/lib/auth/account-ready')
    const res = await sendAccountReadyEmail({
      email,
      nombre: (m as { first_name: string | null } | null)?.first_name ?? null,
    })
    if (!res.sent) throw new Error(res.reason ?? 'No se pudo enviar el correo.')
    return NextResponse.json({ ok: true, email })
  } catch (error) {
    console.error('POST /api/members/[id]/resend-activation:', error)
    const msg = error instanceof Error ? error.message : 'No se pudieron enviar las instrucciones.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
