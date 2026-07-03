import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { approvePayment, rejectPayment } from '@/lib/supabase/queries/payments'
import { sendEmail } from '@/lib/email/provider'

// POST: revisar un pago. Body: { action: 'approve'|'reject', reason? }.
// Aprobar: activa el objeto pagado (status=paid). Rechazar: pide motivo y avisa a
// la persona (notificación interna + correo). Sin correos en la aprobación (punto 6).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleView('revision_pagos', { action: 'edit' })
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const { action, reason } = (await req.json()) as { action?: 'approve' | 'reject'; reason?: string }

    if (action === 'approve') {
      await approvePayment(id, auth.ctx.memberId)
      return NextResponse.json({ ok: true })
    }

    if (action === 'reject') {
      const motivo = (reason ?? '').trim()
      if (!motivo) return NextResponse.json({ error: 'El motivo de rechazo es obligatorio.' }, { status: 400 })
      const rejected = await rejectPayment(id, auth.ctx.memberId, motivo)
      if (!rejected) return NextResponse.json({ error: 'El pago ya no está en revisión.' }, { status: 409 })

      // Avisar a la persona (best-effort): notificación interna + correo con el motivo.
      try {
        const supabase = createAdminClient()
        const { data: m } = await supabase
          .from('members').select('email, first_name, last_name').eq('id', rejected.member_id).maybeSingle()
        const member = m as { email: string | null; first_name: string; last_name: string } | null

        await supabase.from('internal_notifications').insert({
          recipient_member_id: rejected.member_id,
          type: 'payment_rejected',
          title: 'Comprobante de pago rechazado',
          body: `Tu comprobante fue rechazado: ${motivo}. Podés volver a subirlo.`,
          link: null,
        })

        if (member?.email) {
          await sendEmail({
            to: { email: member.email, name: `${member.first_name} ${member.last_name}`.trim() },
            subject: 'Tu comprobante de pago fue rechazado',
            kind: 'transactional',
            html: `
              <p>Hola ${member.first_name},</p>
              <p>Tu comprobante de pago fue <strong>rechazado</strong> por el siguiente motivo:</p>
              <blockquote style="border-left:3px solid #EF5554;padding-left:12px;color:#444">${motivo}</blockquote>
              <p>Por favor volvé a subir un comprobante válido para completar tu pago.</p>
            `,
          }).catch(e => console.warn('sendEmail rechazo falló:', e))
        }
      } catch (e) {
        console.warn('No se pudo avisar el rechazo:', e)
      }
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 })
  } catch (error) {
    console.error('POST /api/payments/[id]/review:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
