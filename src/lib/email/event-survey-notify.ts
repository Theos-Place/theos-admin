// EVE-4 · Despacho de la encuesta de satisfacción de un evento.
//
// A QUIÉNES: a quienes hicieron CHECK-IN, no a todos los inscritos — quien no
// llegó no tiene qué evaluar (decisión confirmada con TI, 2026-08-06).
//
// QUÉ: el formulario elegido (con la plantilla del sistema 'encuesta_evento'
// como envoltorio) o una plantilla de correo cualquiera de message_templates.
//
// DEDUPE: el sello events.survey_sent_at. Se escribe SIEMPRE al terminar, aunque
// algún envío individual falle — si no, la próxima corrida del cron le vuelve a
// escribir a todos los que sí recibieron.
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSystemEmail } from '@/lib/email/system-templates'
import { sendEmail } from '@/lib/email/provider'
import { renderEmail } from '@/lib/email/baseLayout'
import { renderTemplate } from '@/lib/email/render-vars'
import { filterByNotifPref } from '@/lib/notifications/dispatch'
import { surveyTarget, type SurveyPlan } from '@/lib/events/survey-schedule'
import type { SupabaseClient } from '@supabase/supabase-js'

export type SurveyDispatch = { sent: number; recipients: number; skipped?: string }

type EventoRow = SurveyPlan & { id: string; title: string; status: string | null }

/** member_ids con check-in en el evento. Paginado: PostgREST corta en ~1000. */
export async function surveyRecipientIds(
  supabase: SupabaseClient,
  eventId: string,
): Promise<string[]> {
  const ids = new Set<string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('event_checkins')
      .select('member_id')
      .eq('event_id', eventId)
      .not('member_id', 'is', null)
      .order('id')
      .range(from, from + 999)
    if (error) throw error
    const rows = (data ?? []) as Array<{ member_id: string }>
    for (const r of rows) ids.add(r.member_id)
    if (rows.length < 1000) break
  }
  return [...ids]
}

/** Manda la encuesta de UN evento y sella el envío. No valida el momento: eso
 *  es de isSurveyDue — acá se asume que el caller ya decidió que toca. */
export async function dispatchEventSurvey(
  evento: EventoRow,
  opts?: { maxEmails?: number },
): Promise<SurveyDispatch> {
  const supabase = createAdminClient() as unknown as SupabaseClient
  const target = surveyTarget(evento)
  if (target.kind === 'none') return { sent: 0, recipients: 0, skipped: 'sin destino' }

  const conCheckin = await surveyRecipientIds(supabase, evento.id)
  if (conCheckin.length === 0) {
    // Nadie hizo check-in: se sella igual, o el cron lo reintenta todos los días
    // para siempre. La ficha mostrará "enviada a 0 personas", que es la verdad.
    await sellar(supabase, evento.id, 0)
    return { sent: 0, recipients: 0, skipped: 'nadie hizo check-in' }
  }

  const permitidos = await filterByNotifPref(supabase, conCheckin, 'mensajes_sistema')

  // El link de la encuesta: el formulario público, o el evento si el destino es
  // una plantilla de correo (que trae su propio contenido y sus propios links).
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://admin.theosplace.org'
  const linkEncuesta = target.kind === 'form'
    ? `${site}/formularios/${target.formId}/responder`
    : `${site}/eventos/${evento.id}`

  // Si el destino es una plantilla de correo, se lee una sola vez.
  let plantilla: { subject: string; body: string } | null = null
  if (target.kind === 'template') {
    const { data } = await supabase
      .from('message_templates')
      .select('subject, body')
      .eq('id', target.templateId)
      .maybeSingle()
    const t = data as { subject: string | null; body: string | null } | null
    if (!t?.body) {
      await sellar(supabase, evento.id, 0)
      return { sent: 0, recipients: permitidos.length, skipped: 'la plantilla ya no existe' }
    }
    plantilla = { subject: t.subject ?? `¿Cómo te fue en ${evento.title}?`, body: t.body }
  }

  const tope = opts?.maxEmails ?? Infinity
  const vistos = new Set<string>()
  let sent = 0

  for (let i = 0; i < permitidos.length && sent < tope; i += 300) {
    const slice = permitidos.slice(i, i + 300)
    const { data: mems } = await supabase
      .from('members')
      .select('id, first_name, last_name, email')
      .in('id', slice)
      .not('email', 'is', null)
    for (const m of (mems ?? []) as Array<{ first_name: string; last_name: string; email: string }>) {
      if (sent >= tope) break
      const correo = m.email.trim().toLowerCase()
      if (!correo || vistos.has(correo)) continue
      vistos.add(correo)
      const nombre = `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim()
      const data = { nombre, nombre_evento: evento.title, link_encuesta: linkEncuesta }

      if (plantilla) {
        try {
          await sendEmail({
            to: { email: m.email, name: nombre },
            subject: renderTemplate(plantilla.subject, data),
            html: renderEmail(renderTemplate(plantilla.body, data)),
            kind: 'transactional',
          })
          sent++
        } catch (e) {
          console.warn('encuesta (plantilla):', evento.id, e)
        }
      } else {
        const { ok } = await sendSystemEmail({
          systemKey: 'encuesta_evento',
          to: { email: m.email, name: nombre },
          data,
        })
        if (ok) sent++
      }
    }
  }

  await sellar(supabase, evento.id, sent)
  return { sent, recipients: permitidos.length }
}

async function sellar(supabase: SupabaseClient, eventId: string, sent: number) {
  await supabase
    .from('events')
    .update({ survey_sent_at: new Date().toISOString(), survey_sent_count: sent })
    .eq('id', eventId)
}
