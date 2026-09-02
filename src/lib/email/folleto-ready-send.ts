import 'server-only'
import { asuntoListos, cuerpoListos } from '@/lib/email/folleto-ready-notify'

/**
 * Le avisa al dirigente que sus folletos ya están en la sede.
 *
 * A QUIÉN. Al dirigente y al co-dirigente del grupo que va a usarlos. En una
 * solicitud manual no hay grupo: ahí va al dirigente destinatario que se
 * anotó al pedirla.
 *
 * Best-effort: el tiquete ya cambió de estado cuando esto corre, así que un
 * correo fallido no lo revierte. Pero el fallo se registra con console.error,
 * no con warn — un aviso que no sale deja al dirigente esperando folletos que
 * ya están ahí.
 */
export async function notificarFolletosListos(folletoId: string): Promise<{ sent: number }> {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const { getFolletoDetalle } = await import('@/lib/supabase/queries/folletos')
  const { renderEmail } = await import('@/lib/email/baseLayout')
  const { sendEmail } = await import('@/lib/email/provider')
  const sb = createAdminClient()

  const detalle = await getFolletoDetalle(folletoId)
  if (!detalle) return { sent: 0 }

  const ids: string[] = []
  if (detalle.grupo) {
    const { data } = await sb.from('study_groups')
      .select('leader_id, co_leader_id').eq('id', detalle.grupo.id).maybeSingle()
    const g = data as { leader_id: string | null; co_leader_id: string | null } | null
    for (const x of [g?.leader_id, g?.co_leader_id]) if (x) ids.push(x)
  } else {
    const { data } = await sb.from('folleto_requests')
      .select('target_leader_id').eq('id', folletoId).maybeSingle()
    const t = (data as { target_leader_id: string | null } | null)?.target_leader_id
    if (t) ids.push(t)
  }
  if (ids.length === 0) {
    console.warn(`folletos ${folletoId}: nadie a quien avisarle (sin dirigente)`)
    return { sent: 0 }
  }

  const { data: gente } = await sb.from('members')
    .select('id, first_name, last_name, email, email_bounced, email_complained').in('id', ids)
  let sent = 0
  for (const m of (gente ?? []) as Array<{
    id: string; first_name: string; last_name: string
    email: string | null; email_bounced: boolean | null; email_complained: boolean | null
  }>) {
    if (!m.email || m.email_bounced || m.email_complained) continue
    const nombre = `${m.first_name} ${m.last_name}`.trim()
    try {
      await sendEmail({
        to: { email: m.email, name: nombre },
        subject: asuntoListos(detalle),
        html: renderEmail(cuerpoListos(detalle, nombre)),
        kind: 'transactional',
      })
      sent++
    } catch (e) {
      console.error(`folletos listos → ${m.email} falló:`, e instanceof Error ? e.message : e)
    }
  }
  return { sent }
}
