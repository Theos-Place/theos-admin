import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Invita a un miembro a completar su perfil: crea (o reutiliza) un usuario de
 * Supabase Auth y le envía el correo con el link para setear su contraseña.
 * Luego enlaza el auth_user_id al miembro.
 *
 * Best-effort: si el envío falla (p. ej. SMTP no configurado en el proyecto o
 * límite de correos), NO lanza — devuelve { sent:false, reason } para que la
 * creación del miembro no se caiga. Requiere SMTP configurado en Supabase para
 * envío real en producción (parte de la Fase 2 de migración de Auth).
 */
export async function inviteMemberToCompleteProfile(
  memberId: string,
  email: string,
): Promise<{ sent: boolean; reason?: string }> {
  const supabase = createAdminClient()
  try {
    // createUser (no inviteUserByEmail): el correo lo mandamos NOSOTROS por SES
    // con un enlace que sirve en cualquier dispositivo. inviteUserByEmail
    // dependía del SMTP de Supabase Auth y de su enlace de un solo navegador.
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: { member_id: memberId, source: 'invite_admin' },
    })
    let authUserId = data?.user?.id ?? null
    if (error) {
      // Ya existía el usuario de Auth: se recupera para enlazarlo igual.
      const existing = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
      authUserId = existing.data?.users.find(u => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null
      if (!authUserId) {
        console.error('createUser falló:', error.message)
        return { sent: false, reason: error.message }
      }
    }
    // Enlaza el usuario de Auth con el miembro.
    if (authUserId) {
      const { error: linkErr } = await supabase
        .from('members')
        .update({ auth_user_id: authUserId })
        .eq('id', memberId)
      if (linkErr) console.error('No se pudo enlazar auth_user_id:', linkErr.message)
    }
    const { sendPasswordLink } = await import('@/lib/auth/password-link')
    const { data: m } = await supabase.from('members').select('first_name').eq('id', memberId).maybeSingle()
    const res = await sendPasswordLink({
      email,
      kind: 'invite',
      nombre: (m as { first_name: string | null } | null)?.first_name ?? null,
    })
    if (!res.sent) return { sent: false, reason: res.reason }
    return { sent: true }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'error desconocido'
    console.error('inviteMemberToCompleteProfile error:', reason)
    return { sent: false, reason }
  }
}
