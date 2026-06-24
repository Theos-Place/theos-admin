import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { isUuid } from '@/lib/validate'
import { createAdminClient } from '@/lib/supabase/admin'

// Reenvía el correo de activación (invitación de Supabase Auth) a un miembro con
// cuenta de Auth SIN confirmar. SOLO roles administrativos, service_role en backend.
// Método: auth.admin.inviteUserByEmail — el mismo con que se crean/invitan los
// usuarios (ver lib/auth/invite.ts). Si la cuenta ya está confirmada, no reenvía.
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

    const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://admin.theosplace.org'
    const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${base}/completar-perfil`,
      data: { member_id: id, source: 'resend_activation' },
    })
    if (error) throw error
    return NextResponse.json({ ok: true, email })
  } catch (error) {
    console.error('POST /api/members/[id]/resend-activation:', error)
    const msg = error instanceof Error ? error.message : 'No se pudo reenviar el correo de activación.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
