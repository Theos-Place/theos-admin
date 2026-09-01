import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { ACCESS_EMAIL_ROLES } from '@/lib/auth/access-email'
import { isUuid } from '@/lib/validate'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildPasswordLink } from '@/lib/auth/password-link'
import { logAudit } from '@/lib/audit'

// POST → devuelve el enlace de acceso SIN mandarlo por correo, para entregarlo
// por otro canal (WhatsApp).
//
// POR QUÉ EXISTE. A la gente de Hotmail/Outlook no le está llegando el correo
// del enlace: el boletín mensual sí llega, el de acceso no. De 7 personas de
// esos dominios que lo pidieron, 0 lograron entrar. Mismo remitente, mismo
// dominio, misma firma — lo que cambia es que este correo lleva un asunto de
// contraseña y una URL con token, que es lo que Microsoft trata como phishing.
//
// La alternativa que se planteó era mandarle una contraseña temporal por
// correo. Se descartó: viaja por el mismo canal filtrado, y una contraseña en
// texto plano queda en dos buzones para siempre. El enlace no tiene por qué ir
// por correo — es una URL, y se puede entregar por donde la persona sí
// responde.
//
// MISMO PERMISO que cambiar el correo de acceso, y por la misma razón: quien
// obtiene este enlace puede entrar a la cuenta. No alcanza con poder mandar el
// correo (eso lo puede la coordinación); esto es otra cosa.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(...ACCESS_EMAIL_ROLES)
  if (auth.res) return auth.res
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
  try {
    const supabase = createAdminClient()
    const { data: member } = await supabase
      .from('members').select('email, auth_user_id').eq('id', id).maybeSingle()
    const m = member as { email: string | null; auth_user_id: string | null } | null
    if (!m?.email) {
      return NextResponse.json({ error: 'Esta persona no tiene correo registrado.', code: 'sin_correo' }, { status: 409 })
    }

    const link = await buildPasswordLink(m.email, !!m.auth_user_id)
    if (!link) {
      return NextResponse.json({ error: 'No se pudo generar el enlace.', code: 'sin_cuenta' }, { status: 409 })
    }

    // Queda en la bitácora QUIÉN generó un enlace de entrada a la cuenta de
    // quién. Es la contrapartida de que exista el botón: la acción es
    // legítima, pero tiene que ser rastreable.
    await logAudit({
      actorUserId: auth.ctx.userId, action: 'UPDATE', entityType: 'members', entityId: id,
      newData: { via: 'access-link', kind: link.kind },
    })
    return NextResponse.json({ ok: true, url: link.url, kind: link.kind })
  } catch (error) {
    console.error('POST /api/members/[id]/access-link:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
