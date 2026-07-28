import { createAdminClient } from '@/lib/supabase/admin'
import { filterByNotifPref } from '@/lib/notifications/dispatch'
import { todayCR } from '@/lib/format'
import type { SupabaseClient } from '@supabase/supabase-js'

// PAG-3 / REV-2: envío de recordatorios de pagos pendientes como notificación
// interna (deep link a /mis-pagos). Respeta la preferencia silenciable
// 'mensajes_sistema' y dedupea POR DÍA (hora CR): si el cron corre dos veces o
// un revisor insiste, no se duplica. Punto de extensión de email: cuando exista
// una plantilla de sistema para esto, agregarla acá (sendSystemEmail), no en
// los callers.

const NOTIF_TYPE = 'payment_reminder'

/** Inicio del día actual en CR como ISO (CR es UTC-6 fijo, sin DST). */
function todayStartIsoCR(): string {
  return `${todayCR()}T00:00:00-06:00`
}

export type ReminderEntry = {
  memberId: string
  /** Cantidad de pagos pendientes (para el texto consolidado). */
  count: number
  /** Si viene, el deep link apunta a ESE pago y el dedupe diario es por pago. */
  paymentId?: string
}

export async function remindMembersPendingPayments(
  entries: ReminderEntry[],
): Promise<{ sent: number; skipped_pref: number; skipped_dup: number }> {
  const supabase = createAdminClient() as unknown as SupabaseClient
  if (entries.length === 0) return { sent: 0, skipped_pref: 0, skipped_dup: 0 }

  // Preferencias: quienes silenciaron mensajes_sistema no reciben recordatorio.
  const allowed = new Set(await filterByNotifPref(supabase, entries.map(e => e.memberId), 'mensajes_sistema'))
  const skipped_pref = entries.length - entries.filter(e => allowed.has(e.memberId)).length

  // Dedupe diario: notificaciones de este tipo ya creadas HOY (hora CR).
  const candidates = entries.filter(e => allowed.has(e.memberId))
  const sentToday = new Map<string, string[]>() // memberId → links de hoy
  for (let i = 0; i < candidates.length; i += 300) {
    const slice = candidates.slice(i, i + 300)
    const { data } = await supabase
      .from('internal_notifications')
      .select('recipient_member_id, link')
      .eq('type', NOTIF_TYPE)
      .gte('created_at', todayStartIsoCR())
      .in('recipient_member_id', slice.map(e => e.memberId))
    for (const r of (data ?? []) as Array<{ recipient_member_id: string; link: string | null }>) {
      const links = sentToday.get(r.recipient_member_id) ?? []
      links.push(r.link ?? '')
      sentToday.set(r.recipient_member_id, links)
    }
  }

  let sent = 0
  let skipped_dup = 0
  for (const e of candidates) {
    const link = e.paymentId ? `/mis-pagos?pago=${e.paymentId}` : '/mis-pagos'
    const todays = sentToday.get(e.memberId) ?? []
    // Consolidado (cron): cualquier recordatorio de hoy dedupea. Por pago
    // (REV-2): dedupea solo si HOY ya se recordó ese pago puntual.
    const dup = e.paymentId ? todays.some(l => l.includes(`pago=${e.paymentId}`)) : todays.length > 0
    if (dup) { skipped_dup++; continue }
    const { error } = await supabase.from('internal_notifications').insert({
      recipient_member_id: e.memberId,
      type: NOTIF_TYPE,
      title: e.count === 1 ? 'Tenés un pago pendiente' : `Tenés ${e.count} pagos pendientes`,
      body: 'Subí el comprobante para completarlo. Tocá para ver el detalle.',
      link,
    })
    if (error) { console.warn('payment reminder insert:', error.message); continue }
    sent++
  }
  return { sent, skipped_pref, skipped_dup }
}
