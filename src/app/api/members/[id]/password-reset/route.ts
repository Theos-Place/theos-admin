import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { isUuid } from '@/lib/validate'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPasswordLink } from '@/lib/auth/password-link'

// Envía al miembro el correo para definir/restablecer su contraseña.
// Solo roles administrativos (los que ven el tab Administrativo).
//
// 2026-08-03: dejó de usar resetPasswordForEmail (correo por el SMTP de Supabase
// y enlace que solo servía en el navegador donde se pedía). Ahora usa el mismo
// camino que el flujo público: enlace propio + envío por SES.
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

    const { data: full } = await supabase
      .from('members').select('first_name, auth_user_id').eq('id', id).maybeSingle()
    const m = full as { first_name: string | null; auth_user_id: string | null } | null
    const res = await sendPasswordLink({
      email,
      // Sin cuenta reclamada todavía → el texto habla de DEFINIR la contraseña.
      kind: m?.auth_user_id ? 'recovery' : 'invite',
      nombre: m?.first_name ?? null,
    })
    if (!res.sent) {
      return NextResponse.json(
        { error: res.reason === 'sin_cuenta'
            ? 'Este miembro todavía no tiene cuenta de acceso: creála primero.'
            : 'No se pudo enviar el correo.' },
        { status: 400 },
      )
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/members/[id]/password-reset:', error)
    return NextResponse.json({ error: 'No se pudo enviar el correo de restablecimiento.' }, { status: 500 })
  }
}
