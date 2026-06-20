/**
 * Supresión de direcciones a partir de eventos de SES (vía SNS):
 *  · bounce duro / queja → marca al miembro (email_bounced / email_complained)
 *    para excluirlo de envíos futuros, y actualiza sus message_logs.
 * Server-side (service role).
 */
import { createAdminClient } from '@/lib/supabase/admin'

type Kind = 'bounced' | 'complained'

async function markEmail(email: string, kind: Kind): Promise<void> {
  // Columnas nuevas (mig. 085) aún no están en los tipos generados de Supabase.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any
  const addr = email.trim().toLowerCase()
  if (!addr) return
  const now = new Date().toISOString()

  // Marcar al/los miembro(s) con esa dirección (la BD no fuerza email único).
  const memberPatch = kind === 'bounced'
    ? { email_bounced: true, email_bounced_at: now }
    : { email_complained: true, email_complained_at: now }
  await supabase.from('members').update(memberPatch).ilike('email', addr)

  // Actualizar los logs de esa dirección que estaban en vuelo.
  await supabase.from('message_logs')
    .update({ status: kind, last_error: kind === 'bounced' ? 'Hard bounce (SES)' : 'Spam complaint (SES)' })
    .eq('channel', 'email')
    .ilike('recipient', addr)
    .in('status', ['pending', 'sending', 'sent', 'delivered'])
}

/** Bounce permanente: no enviar más a esa dirección. */
export function markEmailBounced(email: string): Promise<void> {
  return markEmail(email, 'bounced')
}

/** Queja de spam: marca y, además, da de baja del newsletter. */
export async function markEmailComplained(email: string): Promise<void> {
  await markEmail(email, 'complained')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any
  await supabase.from('members')
    .update({ newsletter_opt_out: true, newsletter_opt_out_at: new Date().toISOString() })
    .ilike('email', email.trim().toLowerCase())
}
