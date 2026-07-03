import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { closeGroup, type CloseResult } from '@/lib/supabase/queries/studies'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  createFolletoRequest, getFolletoRecipients, getLeaderSedeForGroup,
} from '@/lib/supabase/queries/folletos'
import { isFolletoEligible, nextLevelCode, levelLabel, estimatedAvailableDate } from '@/lib/studies/folletos'
import { sendEmail } from '@/lib/email/provider'

type FolletoPayload = { send?: boolean; sede?: string }

// Fecha de hoy en zona Costa Rica (YYYY-MM-DD).
function costaRicaDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica' }).format(new Date())
}

// POST: cierra el grupo. Body: { results: CloseResult[], folleto?: { send, sede } }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles('coordinador_estudios', 'coordinador_dirigentes', 'direccion')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const { results, folleto } = (await req.json()) as { results: CloseResult[]; folleto?: FolletoPayload }
    await closeGroup(id, results ?? [], auth.ctx.memberId)

    // Paso de folletos: al confirmar con envío activado, crear la solicitud del
    // siguiente nivel + notificar + correo. Best-effort: el cierre ya ocurrió,
    // así que un fallo acá NO revierte el cierre (solo se loguea).
    let folletoCreated = false
    if (folleto?.send) {
      try {
        const quantity = (results ?? []).filter(r => r.status_result === 'aprobado').length
        const supabase = createAdminClient()
        const { data: g } = await supabase
          .from('study_groups').select('plan:study_plans(code)').eq('id', id).maybeSingle()
        const planEmbed = (g as { plan: { code: string | null } | { code: string | null }[] | null } | null)?.plan
        const sourceCode = (Array.isArray(planEmbed) ? planEmbed[0] : planEmbed)?.code ?? null
        const target = nextLevelCode(sourceCode)

        if (quantity > 0 && isFolletoEligible(sourceCode) && target) {
          const closeDate = costaRicaDate()
          const availableAt = estimatedAvailableDate(closeDate)
          const sede = (folleto.sede ?? '').trim() || (await getLeaderSedeForGroup(id))

          await createFolletoRequest({
            source_group_id: id,
            source_plan_code: sourceCode!,
            target_level_code: target,
            quantity,
            sede,
            close_date: closeDate,
            available_at: availableAt,
            confirmed_by: auth.ctx.memberId,
          })
          folletoCreated = true

          const recipients = await getFolletoRecipients()
          if (recipients.length) {
            await supabase.from('internal_notifications').insert(recipients.map(r => ({
              recipient_member_id: r.member_id,
              type: 'folleto_created',
              title: 'Folletos solicitados',
              body: `${quantity} folleto${quantity !== 1 ? 's' : ''} de ${levelLabel(target)} · ${sede ?? 'sede sin definir'}`,
              link: '/estudios/folletos',
            })))
          }

          // Correos (best-effort, uno por destinatario con correo).
          const availableLabel = new Date(`${availableAt}T00:00:00`).toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' })
          const html = `
            <p>Se solicitaron folletos a partir de un cierre de grupo.</p>
            <ul>
              <li><strong>Nivel:</strong> ${levelLabel(target)}</li>
              <li><strong>Cantidad:</strong> ${quantity}</li>
              <li><strong>Sede:</strong> ${sede ?? 'sin definir'}</li>
              <li><strong>Disponibilidad estimada:</strong> ${availableLabel} (listos para recoger en la sede)</li>
            </ul>
            <p>Podés seguir el estado en el sistema, en Estudios &rsaquo; Folletos.</p>
          `
          for (const r of recipients) {
            if (!r.email) continue
            try {
              await sendEmail({
                to: { email: r.email, name: r.name },
                subject: `Folletos de ${levelLabel(target)} — ${sede ?? 'sede sin definir'}`,
                html,
                kind: 'transactional',
              })
            } catch (e) {
              console.warn('sendEmail folleto falló:', e)
            }
          }
        }
      } catch (e) {
        console.warn('No se pudo crear la solicitud de folletos:', e)
      }
    }

    return NextResponse.json({ ok: true, folletoCreated })
  } catch (error) {
    console.error('POST /api/studies/groups/[id]/close:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
