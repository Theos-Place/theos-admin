import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailPublicPage } from '@/lib/email/public-page'

// Re-suscripción de newsletter por link (sin login). Revierte la baja poniendo
// newsletter_opt_out = false. Mismo patrón que /unsubscribe: solo el token,
// nunca expone member_id ni PII.
//
// PROTECCIÓN DE REPUTACIÓN: si la dirección rebotó (email_bounced) o se quejó de
// spam (email_complained), NO se re-suscribe automáticamente — se pide contactar
// a la organización (un admin puede limpiar el estado desde el perfil).
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return emailPublicPage('Link inválido', 'El enlace no es válido.')
  try {
    const supabase = createAdminClient()
    const { data: rows, error: selErr } = await supabase
      .from('members')
      .select('id, email_bounced, email_complained')
      .eq('unsubscribe_token', token)
      .limit(1)
    if (selErr) throw selErr
    if (!rows || rows.length === 0) {
      return emailPublicPage('Link inválido', 'No encontramos tu suscripción. Es posible que el enlace haya expirado.')
    }
    const m = rows[0] as { email_bounced?: boolean; email_complained?: boolean }
    if (m.email_bounced || m.email_complained) {
      return emailPublicPage(
        'No pudimos reactivar tu suscripción',
        'Tu dirección tuvo problemas de entrega anteriores. Escribinos a la organización para reactivar tus correos.',
      )
    }
    const { error: updErr } = await supabase
      .from('members')
      .update({ newsletter_opt_out: false, newsletter_opt_out_at: null })
      .eq('unsubscribe_token', token)
    if (updErr) throw updErr
    return emailPublicPage('¡Listo!', 'Te has vuelto a suscribir a nuestras comunicaciones.')
  } catch (error) {
    console.error('GET /api/email/resubscribe:', error)
    return emailPublicPage('Algo salió mal', 'No pudimos procesar tu solicitud. Intentá de nuevo más tarde.')
  }
}
