import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { isUuid } from '@/lib/validate'
import { createAdminClient } from '@/lib/supabase/admin'

// Envía al miembro el correo de "restablecer contraseña" (Supabase Auth).
// Solo roles administrativos (los que ven el tab Administrativo). El link del
// correo lleva a /recuperar/nueva-contrasena. Si el correo no tiene cuenta de
// Auth, Supabase no envía nada (sin error, sin revelar) — la respuesta es neutral.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(...STUDY_ADMIN_ROLES)
  if (auth.res) return auth.res
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
  try {
    const supabase = createAdminClient()
    const { data: member } = await supabase.from('members').select('email').eq('id', id).maybeSingle()
    const email = (member as { email: string | null } | null)?.email?.trim()
    if (!email) return NextResponse.json({ error: 'El miembro no tiene correo registrado.' }, { status: 400 })

    const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://admin.theosplace.org'
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${base}/recuperar/nueva-contrasena`,
    })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/members/[id]/password-reset:', error)
    return NextResponse.json({ error: 'No se pudo enviar el correo de restablecimiento.' }, { status: 500 })
  }
}
