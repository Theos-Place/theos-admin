/**
 * Supresión de direcciones a partir de eventos de SES (vía SNS):
 *  · bounce duro / queja → marca al miembro (email_bounced / email_complained)
 *    para excluirlo de envíos futuros, y actualiza sus message_logs.
 * Server-side (service role).
 */
import { createAdminClient } from '@/lib/supabase/admin'

type Kind = 'bounced' | 'complained'

async function markEmail(email: string, kind: Kind): Promise<void> {
  const supabase = createAdminClient()
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
  const supabase = createAdminClient()
  await supabase.from('members')
    .update({ newsletter_opt_out: true, newsletter_opt_out_at: new Date().toISOString() })
    .ilike('email', email.trim().toLowerCase())
}

/**
 * Confirmación de ENTREGA de SES (evento 'Delivery' vía SNS). Marca los logs de
 * esa dirección que estaban 'sent' como 'delivered' con su hora.
 *
 * Sin esto, el contador de "Entregados" de un comunicado queda en 0 para siempre
 * — que era exactamente lo que pasaba: el webhook solo atendía Bounce y
 * Complaint, así que ningún log llegaba nunca a 'delivered'.
 *
 * Acota por `messageId` cuando SES lo manda (mail.messageId), que es lo preciso;
 * si no viene, cae al último log 'sent' de esa dirección.
 */
export async function markEmailDelivered(email: string, messageId?: string | null): Promise<void> {
  const supabase = createAdminClient()
  const addr = email.trim().toLowerCase()
  if (!addr) return
  const now = new Date().toISOString()

  if (messageId) {
    const { data } = await supabase.from('message_logs')
      .update({ status: 'delivered', delivered_at: now })
      .eq('provider_message_id', messageId)
      .in('status', ['sent', 'pending'])
      .select('id')
    if ((data ?? []).length > 0) return
  }

  // Sin messageId (o sin match): el log 'sent' más reciente de esa dirección.
  const { data: candidato } = await supabase.from('message_logs')
    .select('id')
    .eq('channel', 'email')
    .ilike('recipient', addr)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const id = (candidato as { id: string } | null)?.id
  if (!id) return
  await supabase.from('message_logs').update({ status: 'delivered', delivered_at: now }).eq('id', id)
}
