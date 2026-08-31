import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/provider'
import { instruccionesHtml } from '@/lib/finance/payment-instructions'
import type { PaymentConcept } from '@/lib/supabase/queries/payments'

/** Aviso de rechazo de un pago (notificación interna + correo con el motivo).
 *  Best-effort: nunca rompe el flujo de rechazo si falla. Compartido entre
 *  POST /api/payments/[id]/review (single) y POST /api/payments/bulk. */
export async function notifyRejection(
  memberId: string, reason: string, concept: PaymentConcept | null,
): Promise<void> {
  const label = concept === 'evento' ? 'tu inscripción al evento'
    : concept === 'folletos' ? 'tu solicitud de folletos'
    : 'tu comprobante de pago'
  try {
    const supabase = createAdminClient()
    const { data: m } = await supabase
      .from('members').select('email, first_name, last_name').eq('id', memberId).maybeSingle()
    const member = m as { email: string | null; first_name: string; last_name: string } | null

    await supabase.from('internal_notifications').insert({
      recipient_member_id: memberId,
      type: 'payment_rejected',
      title: 'Comprobante de pago rechazado',
      body: `${label[0].toUpperCase()}${label.slice(1)} fue rechazado: ${reason}. Podés volver a subirlo.`,
      link: null,
    })

    if (member?.email) {
      await sendEmail({
        to: { email: member.email, name: `${member.first_name} ${member.last_name}`.trim() },
        subject: 'Tu comprobante de pago fue rechazado',
        kind: 'transactional',
        html: `
          <p>Hola ${member.first_name},</p>
          <p>${label[0].toUpperCase()}${label.slice(1)} fue <strong>rechazado</strong> por el siguiente motivo:</p>
          <blockquote style="border-left:3px solid #D63E3D;padding-left:12px;color:#444">${reason}</blockquote>
          <p>Por favor volvé a subir un comprobante válido para completar tu pago.</p>
          ${instruccionesHtml()}
        `,
      }).catch(e => console.warn('sendEmail rechazo falló:', e))
    }
  } catch (e) {
    console.warn('No se pudo avisar el rechazo:', e)
  }
}
