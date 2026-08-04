import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { isUuid } from '@/lib/validate'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendAccountReadyEmail } from '@/lib/auth/account-ready'

// Envía al miembro las INSTRUCCIONES para recuperar su acceso. Solo roles
// administrativos (los que ven el tab Administrativo).
//
// 2026-08-03: dejó de usar resetPasswordForEmail (correo por el SMTP de Supabase
// y enlace que solo servía en el navegador donde se pedía).
// 2026-08-04: y dejó de mandar el enlace con token. Lo dispara un admin, así que
// tiene el mismo problema que la invitación: el enlace vence antes de que la
// persona abra el correo. Ahora manda el paso a paso para que ella lo pida desde
// la pantalla de ingreso y lo use en el momento (ver account-ready.ts).
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
    // Sin cuenta de Auth no hay nada que recuperar: primero hay que crearla
    // (el botón de la ficha ya distingue los dos casos).
    if (!m?.auth_user_id) {
      return NextResponse.json(
        { error: 'Este miembro todavía no tiene cuenta de acceso: creála primero.' },
        { status: 400 },
      )
    }
    const res = await sendAccountReadyEmail({
      email,
      nombre: m?.first_name ?? null,
      kind: 'restablecer',
    })
    if (!res.sent) return NextResponse.json({ error: 'No se pudo enviar el correo.' }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/members/[id]/password-reset:', error)
    return NextResponse.json({ error: 'No se pudieron enviar las instrucciones.' }, { status: 500 })
  }
}
