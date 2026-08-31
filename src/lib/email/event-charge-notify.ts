/**
 * Aviso de cobro pendiente por check-in en un evento pago (Fase 2, Camino 1
 * "Enviar cobro a la persona"). Transaccional y best-effort: si el correo falla
 * se loguea y NO rompe el check-in (la persona ya entró; el cobro queda en la
 * cola de finanzas de todos modos). Espejo del criterio de notifyEnrollment.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/provider'
import { instruccionesHtml, detalleSugerido } from '@/lib/finance/payment-instructions'
import { renderEmail } from '@/lib/email/baseLayout'
import { formatCRC } from '@/lib/format'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://admin.theosplace.org'

export async function notifyEventPendingCharge(
  memberId: string,
  eventId: string,
  amount: number,
): Promise<void> {
  try {
    const supabase = createAdminClient()
    const [{ data: m }, { data: ev }] = await Promise.all([
      supabase.from('members').select('first_name, last_name, email').eq('id', memberId).maybeSingle(),
      supabase.from('events').select('title').eq('id', eventId).maybeSingle(),
    ])
    const member = m as { first_name: string | null; last_name: string | null; email: string | null } | null
    const evento = (ev as { title: string | null } | null)?.title ?? 'el evento'
    if (!member?.email) return

    const nombre = `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim() || 'Hola'
    const perfilUrl = `${SITE_URL}/perfil`

    const html = renderEmail(`
      <p>Hola ${nombre},</p>
      <p>Registramos tu ingreso a <strong>${evento}</strong>. Queda pendiente el
        pago de <strong>${formatCRC(amount)}</strong> por tu participación.</p>
      ${instruccionesHtml(detalleSugerido(evento, nombre))}
      <p>Ya que pagaste, subí tu comprobante desde tu perfil:</p>
      <p style="text-align:center;margin:28px 0;">
        <a href="${perfilUrl}"
           style="background:#F4795B;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;display:inline-block;font-weight:600;">
          Subir comprobante
        </a>
      </p>
      <p style="color:#5b6b7c;font-size:14px;">Si ya realizaste el pago en sitio, podés ignorar este mensaje.</p>
    `)

    await sendEmail({
      to: { email: member.email, name: nombre },
      subject: `Pago pendiente — ${evento}`,
      html,
      kind: 'transactional',
    })
  } catch (e) {
    console.warn('notifyEventPendingCharge:', e)
  }
}
