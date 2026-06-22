import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailPublicPage } from '@/lib/email/public-page'

// Baja de newsletter por link (sin login). El token (members.unsubscribe_token)
// identifica al miembro de forma estable y revocable.
//
// SEGURIDAD (excepción documentada al guard de AGENTS.md): endpoint PÚBLICO —
// el link va en el correo y el destinatario no tiene sesión. La autorización es
// el token único e impredecible; solo permite UNA acción (opt-out), nunca lee PII.
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return emailPublicPage('Link inválido', 'El enlace de baja no es válido.')
  try {
    // Columnas nuevas (mig. 085) aún no están en los tipos generados de Supabase.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any
    const { data, error } = await supabase
      .from('members')
      .update({ newsletter_opt_out: true, newsletter_opt_out_at: new Date().toISOString() })
      .eq('unsubscribe_token', token)
      .select('id, email_bounced, email_complained')
    if (error) throw error
    if (!data || data.length === 0) {
      return emailPublicPage('Link inválido', 'No encontramos tu suscripción. Es posible que el enlace haya expirado.')
    }
    // Ofrecer re-suscripción salvo que la dirección rebote o se haya quejado:
    // re-habilitar esos correos daña la reputación de envío.
    const m = data[0] as { email_bounced?: boolean; email_complained?: boolean }
    const blocked = !!m.email_bounced || !!m.email_complained
    return emailPublicPage(
      'Listo, te diste de baja',
      'No vas a recibir más correos de newsletter/marketing de Theos Place. Los avisos importantes de tu cuenta seguirán llegando.',
      blocked ? undefined : { actionHref: `/api/email/resubscribe?token=${encodeURIComponent(token)}`, actionLabel: 'Volver a suscribirme' },
    )
  } catch (error) {
    console.error('GET /api/email/unsubscribe:', error)
    return emailPublicPage('Algo salió mal', 'No pudimos procesar tu baja. Intentá de nuevo más tarde.')
  }
}
