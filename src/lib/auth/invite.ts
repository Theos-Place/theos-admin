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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://admin.theosplace.org'
  const redirectTo = `${siteUrl}/completar-perfil`

  try {
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { member_id: memberId, source: 'checkin_new_person' },
    })
    if (error) {
      console.error('inviteUserByEmail falló:', error.message)
      return { sent: false, reason: error.message }
    }
    // Enlaza el usuario de Auth con el miembro.
    const authUserId = data.user?.id
    if (authUserId) {
      const { error: linkErr } = await supabase
        .from('members')
        .update({ auth_user_id: authUserId })
        .eq('id', memberId)
      if (linkErr) console.error('No se pudo enlazar auth_user_id:', linkErr.message)
    }
    return { sent: true }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'error desconocido'
    console.error('inviteMemberToCompleteProfile error:', reason)
    return { sent: false, reason }
  }
}
