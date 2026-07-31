/*
 * Cola de emails — SQL ya aplicado en supabase/migrations/044_email_queue.sql:
 *
 *   ALTER TABLE message_logs
 *     ADD COLUMN IF NOT EXISTS scheduled_date DATE DEFAULT CURRENT_DATE,
 *     ADD COLUMN IF NOT EXISTS attempts INT DEFAULT 0,
 *     ADD COLUMN IF NOT EXISTS last_error TEXT;
 *   CREATE INDEX IF NOT EXISTS idx_message_logs_queue
 *     ON message_logs(status, scheduled_date, channel) WHERE status = 'pending';
 */
import { createAdminClient, type Insertable, type Updatable } from '@/lib/supabase/admin'
import { sendEmail, isEmailConfigured, DAILY_LIMIT, EMAIL_NOT_CONFIGURED } from '@/lib/email/provider'
import {
  emptySkipReasons, totalSkipped, noRecipientsMessage, type SkipReasons,
} from '@/lib/communications/skip-reasons'
import { bodyToHtml } from '@/lib/email/render'
import { renderEmail } from '@/lib/email/baseLayout'
import { unsubscribeUrl } from '@/lib/email/footer'
import { filterByNotifPref } from '@/lib/notifications/dispatch'
import { applyVars } from '@/lib/communications/vars'
import { ymdCR, todayCR } from '@/lib/format'
import type { CommunicationChannel, CommunicationStatus } from '@/types/communication'

export type DbBroadcast = {
  id: string
  subject: string | null
  body: string
  channel: CommunicationChannel
  status: CommunicationStatus
  segment_label: string | null
  recipient_filter: unknown
  total_recipients: number
  skipped_count: number
  created_by: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  smtp_config_id: string | null
  whatsapp_config_id: string | null
  logs: Array<{ channel: 'whatsapp' | 'email'; status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced' }>
}

export type DbTemplate = {
  id: string
  name: string
  category: string | null
  channel: CommunicationChannel
  subject: string | null
  body: string
  body_format: 'text' | 'html'
  variables: unknown
  is_active: boolean
  is_system: boolean
  system_key: string | null
  available_variables: unknown
  created_at: string
  broadcasts: Array<{ id: string }>
}

export type DbChannelConfig = {
  id: string
  type: 'smtp' | 'whatsapp'
  name: string
  smtp_host: string | null
  smtp_port: number | null
  smtp_user: string | null
  smtp_from_name: string | null
  smtp_from_email: string | null
  wa_account_id: string | null
  wa_phone_number: string | null
  is_active: boolean
  is_verified: boolean
  last_verified_at: string | null
}

export async function getMessages(): Promise<DbBroadcast[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('message_broadcasts')
    .select(`
      id, subject, body, channel, status, segment_label, recipient_filter, total_recipients,
      skipped_count, created_by, started_at, completed_at, created_at, smtp_config_id, whatsapp_config_id,
      logs:message_logs(channel, status)
    `)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as DbBroadcast[]
}

export async function getTemplates(): Promise<DbTemplate[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('message_templates')
    .select(`
      id, name, category, channel, subject, body, body_format, variables, is_active,
      is_system, system_key, available_variables, created_at,
      broadcasts:message_broadcasts(id)
    `)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as DbTemplate[]
}

export async function getChannelConfigs(): Promise<DbChannelConfig[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('channel_configs')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as DbChannelConfig[]
}

// ── Mutaciones ─────────────────────────────────────────────

export type TemplateWriteInput = {
  name: string
  category?: string | null
  channel: CommunicationChannel
  subject?: string | null
  body: string
  body_format?: 'text' | 'html'
  variables?: unknown
  available_variables?: unknown
  is_active?: boolean
}

export async function createTemplate(input: TemplateWriteInput): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('message_templates').insert(input as Insertable<'message_templates'>).select('id').single()
  if (error) throw error
  return data as { id: string }
}

/** Actualiza una plantilla. Las del sistema SÍ se editan (contenido), pero no se
 *  pueden mutar sus marcas (is_system/system_key) ni el canal. */
export async function updateTemplate(id: string, patch: Partial<TemplateWriteInput>): Promise<void> {
  const supabase = createAdminClient()
  const safe: Record<string, unknown> = { ...(patch as Record<string, unknown>) }
  delete safe.is_system
  delete safe.system_key
  delete safe.channel
  const { error } = await supabase.from('message_templates').update(safe as Updatable<'message_templates'>).eq('id', id)
  if (error) throw error
}

export async function deleteTemplate(id: string): Promise<void> {
  const supabase = createAdminClient()
  // Las plantillas del sistema NO se borran (editable pero no borrable).
  const { data: tpl } = await supabase.from('message_templates').select('is_system').eq('id', id).maybeSingle()
  if ((tpl as { is_system?: boolean } | null)?.is_system) {
    throw new Error('SYSTEM_TEMPLATE_PROTECTED')
  }
  const { error } = await supabase.from('message_templates').delete().eq('id', id)
  if (error) throw error
}

export type ConfigWriteInput = {
  type: 'smtp' | 'whatsapp'
  name: string
  smtp_host?: string | null
  smtp_port?: number | null
  smtp_user?: string | null
  smtp_from_name?: string | null
  smtp_from_email?: string | null
  wa_account_id?: string | null
  wa_phone_number?: string | null
  is_active?: boolean
}

export async function createConfig(input: ConfigWriteInput): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('channel_configs').insert(input).select('id').single()
  if (error) throw error
  return data as { id: string }
}

export async function updateConfig(id: string, patch: Partial<ConfigWriteInput>): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('channel_configs').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteConfig(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('channel_configs').delete().eq('id', id)
  if (error) throw error
}

export async function verifyConfig(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('channel_configs')
    .update({ is_verified: true, last_verified_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export type BroadcastWriteInput = {
  template_id?: string | null
  channel: CommunicationChannel
  /** 'marketing' (respeta opt-out + lleva unsubscribe) | 'transactional'. Default marketing. */
  kind?: 'marketing' | 'transactional'
  subject?: string | null
  body: string
  body_format?: 'text' | 'html'
  segment_label?: string | null
  recipient_filter?: unknown
  total_recipients?: number
  smtp_config_id?: string | null
  whatsapp_config_id?: string | null
}

export async function createBroadcast(input: BroadcastWriteInput): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('message_broadcasts')
    .insert({ ...input, status: 'draft' } as Insertable<'message_broadcasts'>)
    .select('id')
    .single()
  if (error) throw error
  return data as { id: string }
}

export type Recipient = { member_id?: string | null; channel: 'whatsapp' | 'email' | 'interna'; recipient: string }

/** Prefijo del error de "nadie quedó elegible": el endpoint lo traduce a 409
 *  con el motivo (lo que va después de los dos puntos). */
export const NO_RECIPIENTS = 'SIN_DESTINATARIOS'

// "Hoy" SIEMPRE en zona Costa Rica (UTC-6): el runtime corre en UTC y
// `toISOString()` daría el día equivocado de noche, desfasando el rate limit
// diario y las comparaciones de scheduled_date.
function todayStr(): string {
  return todayCR()
}

/** Emails enviados hoy por todos los broadcasts (para el rate limit diario). */
export async function getDailyEmailsSent(): Promise<number> {
  const supabase = createAdminClient()
  // Medianoche CR de hoy expresada en UTC (CR = UTC-6 → 00:00 CR = 06:00 UTC).
  const startOfDay = `${todayStr()}T06:00:00.000Z`
  const { count, error } = await supabase
    .from('message_logs')
    .select('id', { count: 'exact', head: true })
    .eq('channel', 'email')
    .in('status', ['sent', 'delivered'])
    .gte('sent_at', startOfDay)
  if (error) throw error
  return count ?? 0
}

/** Distribuye N emails en días respetando el límite diario. Pura, testeable. */
export function distributeEmailSchedule(
  total: number,
  availableToday: number,
  dailyLimit: number,
  now: Date = new Date(),
): string[] {
  const dates: string[] = []
  let remaining = total
  // Hoy: hasta lo disponible del día.
  const today = Math.min(remaining, Math.max(0, availableToday))
  for (let i = 0; i < today; i++) dates.push(ymdCR(now))
  remaining -= today
  // Días siguientes: bloques de dailyLimit.
  let dayOffset = 1
  while (remaining > 0) {
    const batch = Math.min(remaining, dailyLimit)
    const d = new Date(now)
    d.setDate(d.getDate() + dayOffset)
    const ds = ymdCR(d)
    for (let i = 0; i < batch; i++) dates.push(ds)
    remaining -= batch
    dayOffset++
  }
  return dates
}

/**
 * Envía un broadcast real:
 * 1. Canal 'interna': inserta internal_notifications (campana) por destinatario
 *    y deja el log como 'sent' de una vez — sin correo ni configuración.
 * 2. Email: crea message_logs 'pending' con scheduled_date distribuida por días
 *    según el límite diario de envío (lo de hoy se procesa inmediatamente; el
 *    resto lo recoge el cron diario).
 * 3. WhatsApp queda en 'pending' sin procesar (se integra después).
 * Lanza error claro si hay emails y el proveedor (SES) no está configurado.
 */
export type AudienceType = 'all' | 'sede' | 'servidonantes'

/** Miembros ELEGIBLES para una campaña de marketing: activos, con email, sin
 *  baja de newsletter ni rebote/queja. `type` acota la audiencia. Devuelve los
 *  member_ids (para encolar) y el total. Paginado (PostgREST corta en 1000). */
export async function getEligibleAudience(
  type: AudienceType,
  sedeCodes: string[] = [],
): Promise<{ member_ids: string[]; count: number }> {
  const supabase = createAdminClient()

  // Servidonantes: además de donante, debe ser servidor activo (volunteers).
  let serverIds: Set<string> | null = null
  if (type === 'servidonantes') {
    const ids = new Set<string>()
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase.from('volunteers')
        .select('member_id').eq('status', 'active').order('member_id').range(from, from + 999)
      const batch = (data ?? []) as Array<{ member_id: string | null }>
      for (const v of batch) if (v.member_id) ids.add(v.member_id)
      if (batch.length < 1000) break
    }
    serverIds = ids
    if (serverIds.size === 0) return { member_ids: [], count: 0 }
  }

  // Sede: resolver códigos → uuids de sede_id.
  let sedeUuids: string[] | null = null
  if (type === 'sede') {
    if (sedeCodes.length === 0) return { member_ids: [], count: 0 }
    const { data: sd } = await supabase.from('sedes').select('id, code').in('code', sedeCodes)
    sedeUuids = ((sd ?? []) as Array<{ id: string }>).map(s => s.id)
    if (sedeUuids.length === 0) return { member_ids: [], count: 0 }
  }

  const out: string[] = []
  for (let from = 0; ; from += 1000) {
    let q = supabase.from('members')
      .select('id')
      .eq('is_active', true)
      .eq('email_bounced', false)
      .eq('email_complained', false)
      .eq('newsletter_opt_out', false)
      .not('email', 'is', null)
      .neq('email', '')
      .order('id')
      .range(from, from + 999)
    if (type === 'servidonantes') q = q.eq('is_donor', true)
    if (sedeUuids) q = q.in('sede_id', sedeUuids)
    const { data, error } = await q
    if (error) throw error
    const batch = (data ?? []) as Array<{ id: string }>
    for (const m of batch) {
      if (serverIds && !serverIds.has(m.id)) continue
      out.push(m.id)
    }
    if (batch.length < 1000) break
  }
  return { member_ids: out, count: out.length }
}

/** Resuelve el correo real (desde members) de los destinatarios email y excluye
 *  a los bloqueados: bounced/complained siempre; opt-out solo si es marketing. */
async function resolveEmailRecipients(
  supabase: ReturnType<typeof createAdminClient>,
  raw: Recipient[],
  isMarketing: boolean,
  reasons: SkipReasons = emptySkipReasons(),
): Promise<Recipient[]> {
  const ids = Array.from(new Set(raw.map(r => r.member_id).filter(Boolean))) as string[]
  type MRow = { id: string; email: string | null; email_bounced: boolean; email_complained: boolean; newsletter_opt_out: boolean }
  const byId = new Map<string, MRow>()
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await supabase
      .from('members')
      .select('id, email, email_bounced, email_complained, newsletter_opt_out')
      .in('id', ids.slice(i, i + 300))
    for (const m of (data ?? []) as MRow[]) byId.set(m.id, m)
  }
  const out: Recipient[] = []
  for (const r of raw) {
    const m = r.member_id ? byId.get(r.member_id) : null
    const email = r.recipient && r.recipient.includes('@') ? r.recipient : (m?.email ?? '')
    // Se cuenta la causa de cada exclusión: si al final no queda NADIE, el
    // envío explica por qué en vez de dejar un 'fallido' sin motivo.
    if (!email) { reasons.sin_correo++; continue }                     // sin correo → no se puede enviar
    if (m?.email_bounced) { reasons.rebotado++; continue }             // rebote → excluir siempre
    if (m?.email_complained) { reasons.queja++; continue }             // queja → excluir siempre
    if (isMarketing && m?.newsletter_opt_out) { reasons.baja++; continue } // baja → excluir en marketing
    out.push({ ...r, recipient: email })
  }
  return out
}

export async function sendBroadcast(id: string, recipients: Recipient[]): Promise<void> {
  const supabase = createAdminClient()

  const emailRecipientsRaw = recipients.filter(r => r.channel === 'email')
  if (emailRecipientsRaw.length > 0 && !isEmailConfigured()) {
    throw new Error(EMAIL_NOT_CONFIGURED)
  }

  // Claim atómico draft → sending: sin esto, dos POST /send al mismo broadcast
  // (doble clic, retry del navegador tras timeout) insertarían dos sets
  // completos de logs y notificaciones — cada destinatario recibiría el
  // comunicado dos veces.
  const { data: claimed, error: claimErr } = await supabase
    .from('message_broadcasts')
    .update({ status: 'sending', started_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'draft')
    .select('id')
  if (claimErr) throw claimErr
  if ((claimed ?? []).length === 0) throw new Error('BROADCAST_YA_ENVIADO')

  try {
  // Tipo de broadcast: marketing (respeta opt-out + bounced) vs transaccional.
  const { data: bMeta } = await supabase
    .from('message_broadcasts').select('kind').eq('id', id).single()
  const isMarketing = (bMeta as { kind?: string } | null)?.kind !== 'transactional'

  // Resolver el correo real de cada destinatario desde members (el cliente manda
  // recipient vacío) y EXCLUIR a quienes no deben recibir:
  //   · siempre: rebotados (email_bounced) y quejas (email_complained)
  //   · marketing: además los que se dieron de baja (newsletter_opt_out)
  const skipReasons = emptySkipReasons()
  const emailRecipients = await resolveEmailRecipients(supabase, emailRecipientsRaw, isMarketing, skipReasons)

  // Canal interna: notificación en el sistema para cada destinatario con member_id.
  // Es un anuncio general → respeta el toggle "Mensajes del sistema" del miembro
  // (las alertas operativas/seguridad usan inserts directos, no este broadcast).
  const internalRecipientsRaw = recipients.filter(r => r.channel === 'interna' && r.member_id)
  const internalAllowed = new Set(
    await filterByNotifPref(supabase, internalRecipientsRaw.map(r => r.member_id!), 'mensajes_sistema'),
  )
  const internalRecipients = internalRecipientsRaw.filter(r => internalAllowed.has(r.member_id!))
  skipReasons.silenciado += internalRecipientsRaw.length - internalRecipients.length
  // NADIE elegible: se aborta con el motivo. El catch de abajo devuelve el
  // broadcast a 'draft' (no hay logs), así el usuario puede corregir el tipo de
  // correo o el destinatario y reintentar — antes quedaba 'fallido' sin
  // explicación y sin forma de reenviarlo.
  const waCount = recipients.filter(r => r.channel === 'whatsapp').length
  if (emailRecipients.length + internalRecipients.length + waCount === 0) {
    throw new Error(`${NO_RECIPIENTS}:${noRecipientsMessage(skipReasons, isMarketing)}`)
  }

  if (internalRecipients.length > 0) {
    const { data: b, error: bErr } = await supabase
      .from('message_broadcasts').select('subject, body').eq('id', id).single()
    if (bErr) throw bErr
    const broadcast = b as { subject: string | null; body: string }
    // Nombre por miembro para la variable {nombre}.
    const intIds = internalRecipients.map(r => r.member_id!).filter(Boolean)
    const firstName = new Map<string, string>()
    for (let i = 0; i < intIds.length; i += 300) {
      const { data: ms } = await supabase.from('members')
        .select('id, first_name').in('id', intIds.slice(i, i + 300))
      for (const m of (ms ?? []) as Array<{ id: string; first_name: string }>) firstName.set(m.id, m.first_name)
    }
    const { error: nErr } = await supabase.from('internal_notifications').insert(
      internalRecipients.map(r => {
        const nombre = firstName.get(r.member_id!) ?? ''
        return {
          recipient_member_id: r.member_id!,
          type: 'broadcast',
          title: applyVars(broadcast.subject, { nombre }) || 'Comunicado de Theos Place',
          body: applyVars(broadcast.body, { nombre }),
          link: null,
        }
      }),
    )
    if (nErr) throw nErr
  }
  const internalLogs = internalRecipients.map(r => ({
    broadcast_id: id,
    member_id: r.member_id ?? null,
    channel: r.channel,
    recipient: r.recipient,
    status: 'sent',
    sent_at: new Date().toISOString(),
  }))

  const waRecipients = recipients.filter(r => r.channel === 'whatsapp')

  // Distribución por días según el cupo de hoy.
  const dailyUsed = await getDailyEmailsSent()
  const availableToday = Math.max(0, DAILY_LIMIT - dailyUsed)
  const schedule = distributeEmailSchedule(emailRecipients.length, availableToday, DAILY_LIMIT)

  const emailLogs = emailRecipients.map((r, i) => ({
    broadcast_id: id,
    member_id: r.member_id ?? null,
    channel: r.channel,
    recipient: r.recipient,
    status: 'pending',
    scheduled_date: schedule[i],
  }))
  // WhatsApp: pending sin procesamiento (pendiente de integración).
  const waLogs = waRecipients.map(r => ({
    broadcast_id: id,
    member_id: r.member_id ?? null,
    channel: r.channel,
    recipient: r.recipient,
    status: 'pending',
  }))

  if (emailLogs.length + waLogs.length + internalLogs.length > 0) {
    const { error } = await supabase.from('message_logs').insert([...emailLogs, ...waLogs, ...internalLogs])
    if (error) throw error
  }

  // Saltados = email excluidos (baja/rebote/queja) + internos que silenciaron
  // "Mensajes del sistema".
  const skipped = totalSkipped(skipReasons)
  await supabase.from('message_broadcasts')
    .update({
      total_recipients: internalLogs.length + emailLogs.length + waLogs.length,
      skipped_count: skipped,
    })
    .eq('id', id)

  // Procesar inmediatamente el batch de hoy.
  const today = todayStr()
  if (emailLogs.some(l => l.scheduled_date === today)) {
    await processPendingEmails(id)
  } else {
    await refreshBroadcastCounters(id)
  }
  } catch (err) {
    // A8: sin esto, un fallo después del claim dejaba el broadcast ZOMBI —
    // 'sending' sin logs, con el retry rebotando en BROADCAST_YA_ENVIADO para
    // siempre. Si todavía no se insertó ningún log, el claim se revierte a
    // draft para que el reintento del usuario funcione.
    const { count } = await createAdminClient()
      .from('message_logs')
      .select('id', { count: 'exact', head: true })
      .eq('broadcast_id', id)
    if ((count ?? 0) === 0) {
      await createAdminClient()
        .from('message_broadcasts')
        .update({ status: 'draft', started_at: null })
        .eq('id', id)
        .eq('status', 'sending')
    }
    throw err
  }
}

/** Recalcula sent/failed del broadcast desde los logs y cierra si no queda nada pendiente. */
async function refreshBroadcastCounters(broadcastId: string): Promise<void> {
  const supabase = createAdminClient()
  const countBy = async (statuses: string[], onlyEmail = false) => {
    let q = supabase.from('message_logs')
      .select('id', { count: 'exact', head: true })
      .eq('broadcast_id', broadcastId)
      .in('status', statuses)
    if (onlyEmail) q = q.eq('channel', 'email')
    const { count } = await q
    return count ?? 0
  }
  const [sent, failed, pendingEmails] = await Promise.all([
    countBy(['sent', 'delivered']),
    countBy(['failed', 'bounced']),
    countBy(['pending'], true),
  ])
  // Estados según la 016: 'sending' mientras quede cola; al terminar,
  // 'sent' (todo ok), 'partial' (mezcla) o 'failed' (nada salió).
  const done = pendingEmails === 0
  // Con 0 logs (nadie recibió nada: todos excluidos/sin correo) el broadcast
  // es 'failed', no 'sent' — un "enviado" sin destinatarios engaña al usuario.
  const finalStatus = sent === 0 && failed === 0 ? 'failed'
    : failed === 0 ? 'sent' : sent > 0 ? 'partial' : 'failed'
  // Condicionado a 'sending' (A8): sin esto, procesar un DRAFT (0 logs) lo
  // marcaba 'failed' con completed_at y quedaba insendable para siempre (el
  // claim de envío exige status='draft').
  const { error } = await supabase.from('message_broadcasts').update({
    sent_count: sent,
    failed_count: failed,
    status: done ? finalStatus : 'sending',
    completed_at: done ? new Date().toISOString() : null,
  }).eq('id', broadcastId).in('status', ['sending', 'sent', 'partial', 'failed'])
  if (error) console.warn('refreshBroadcastCounters:', error.message)
}

/**
 * Procesa los emails 'pending' programados para hoy (o antes) de un broadcast.
 * Devuelve cuántos salieron y cuántos fallaron. Los contadores del broadcast
 * se recalculan desde los logs (acumulativo entre días, no se pisan).
 */
export async function processPendingEmails(
  broadcastId: string,
  recipientEmails?: string[],
): Promise<{ sent: number; failed: number }> {
  const supabase = createAdminClient()
  const today = todayStr()

  const { data: broadcastRow, error: bErr } = await supabase
    .from('message_broadcasts')
    .select('subject, body, body_format, kind, smtp_config_id, config:channel_configs!message_broadcasts_smtp_config_id_fkey(smtp_from_name, smtp_from_email)')
    .eq('id', broadcastId)
    .single()
  if (bErr || !broadcastRow) throw new Error('Broadcast no encontrado')
  const broadcast = broadcastRow as {
    subject: string | null; body: string; body_format?: 'text' | 'html'; kind?: string
    config: { smtp_from_name: string | null; smtp_from_email: string | null } | null
  }

  // Pendientes de hoy o atrasados (lte: si el cron falló un día, los recoge).
  let query = supabase.from('message_logs')
    .select('id, recipient, member_id, attempts')
    .eq('broadcast_id', broadcastId)
    .eq('status', 'pending')
    .eq('channel', 'email')
    .lte('scheduled_date', today)
    .order('created_at')
  if (recipientEmails?.length) query = query.in('recipient', recipientEmails)

  // Recuperar claims huérfanos: si el proceso murió entre el claim (status
  // 'sending' + claimed_at) y el envío, esas filas quedarían en 'sending' para
  // siempre y el broadcast nunca cerraría. Un envío real tarda segundos, así
  // que 10 minutos de antigüedad ya es señal inequívoca de proceso muerto;
  // las devolvemos a 'pending' (claimed_at null) para que este mismo run las
  // retome. El filtro por claimed_at < umbral mantiene la atomicidad frente a
  // otro run concurrente: nunca toca claims recién hechos. También rescata
  // filas 'sending' con claimed_at NULL (anteriores a la migración 054, que
  // no registraba el claim) — sin esto quedarían huérfanas para siempre.
  const staleThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  await supabase.from('message_logs')
    .update({ status: 'pending', claimed_at: null })
    .eq('broadcast_id', broadcastId)
    .eq('status', 'sending')
    .or(`claimed_at.lt.${staleThreshold},claimed_at.is.null`)

  const { data: logsData, error: lErr } = await query
  if (lErr) throw lErr
  const logs = (logsData ?? []) as Array<{ id: string; recipient: string; member_id: string | null; attempts: number | null }>
  if (!logs.length) {
    await refreshBroadcastCounters(broadcastId)
    return { sent: 0, failed: 0 }
  }

  // Respetar el cupo del día aunque se procese manualmente varias veces.
  const dailyUsed = await getDailyEmailsSent()
  const available = Math.max(0, DAILY_LIMIT - dailyUsed)

  // Candidatos del run (respetando el cupo). El claim real es POR FILA justo
  // antes de cada envío (ver el loop): la auditoría A6 encontró que el claim
  // por LOTE dejaba filas en 'sending' durante 15-30 min (lotes grandes a
  // ~100ms+SMTP por correo) — más que el umbral de rescate de 10 min — y un
  // segundo run las "rescataba" y RE-ENVIABA mientras el primero seguía vivo.
  // Con claim por fila, la ventana claim→envío es de ~1s y el rescate solo
  // puede tocar filas de procesos realmente muertos.
  const batch = logs.slice(0, available)
  if (batch.length === 0) {
    await refreshBroadcastCounters(broadcastId)
    return { sent: 0, failed: 0 }
  }

  // Nombre + token de baja de los miembros en un solo query (no N+1).
  const memberIds = Array.from(new Set(batch.map(l => l.member_id).filter(Boolean))) as string[]
  const names = new Map<string, string>()
  const firstNames = new Map<string, string>()
  const tokens = new Map<string, string>()
  // Chunking por 300: memberIds puede llegar a ~DAILY_LIMIT (5000) en un run,
  // y un .in() con miles de ids revienta la query (auditoría db 2026-07-18).
  for (let i = 0; i < memberIds.length; i += 300) {
    const { data: members } = await supabase
      .from('members').select('id, first_name, last_name, unsubscribe_token').in('id', memberIds.slice(i, i + 300))
    for (const m of (members ?? []) as Array<{ id: string; first_name: string; last_name: string; unsubscribe_token: string }>) {
      names.set(m.id, `${m.first_name} ${m.last_name}`.trim())
      firstNames.set(m.id, m.first_name ?? '')
      tokens.set(m.id, m.unsubscribe_token)
    }
  }

  // Marketing → el layout incluye el pie de baja (con token) + header List-Unsubscribe.
  // Transaccional → sin baja. El contenido SIEMPRE se envuelve con el layout base.
  const kind: 'marketing' | 'transactional' = broadcast.kind === 'transactional' ? 'transactional' : 'marketing'

  let sent = 0, failed = 0
  for (const log of batch) {
    // Claim atómico por fila: si otro run (cron + botón manual) la tomó, saltar.
    const { data: claimed, error: clErr } = await supabase
      .from('message_logs')
      .update({ status: 'sending', claimed_at: new Date().toISOString() })
      .eq('id', log.id)
      .eq('status', 'pending')
      .select('id')
    if (clErr) { console.warn('claim log:', clErr.message); continue }
    if ((claimed ?? []).length === 0) continue

    const attempts = (log.attempts ?? 0) + 1
    const token = log.member_id ? tokens.get(log.member_id) : undefined
    const nombre = log.member_id ? (firstNames.get(log.member_id) ?? '') : ''
    // Variables ({nombre}) → HTML del cuerpo → envuelto en el layout base (mismo
    // que el preview). Marketing lleva el pie de baja DENTRO del layout.
    const bodyHtml = bodyToHtml(applyVars(broadcast.body, { nombre }), broadcast.body_format ?? 'html')
    const html = renderEmail(bodyHtml, kind === 'marketing' && token ? { unsubscribeUrl: unsubscribeUrl(token) } : undefined)
    const subject = applyVars(broadcast.subject ?? 'Mensaje de Theos Place', { nombre })
    try {
      await sendEmail({
        to: { email: log.recipient, name: (log.member_id && names.get(log.member_id)) || log.recipient },
        fromName: broadcast.config?.smtp_from_name ?? undefined,
        subject,
        html,
        kind,
        unsubscribeToken: token,
      })
      await supabase.from('message_logs')
        .update({ status: 'sent', sent_at: new Date().toISOString(), attempts, last_error: null })
        .eq('id', log.id)
      sent++
      // Pausa corta entre envíos para no exceder el rate de SES.
      await new Promise(r => setTimeout(r, 100))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      await supabase.from('message_logs')
        .update({ status: 'failed', last_error: msg.slice(0, 500), attempts })
        .eq('id', log.id)
      failed++
    }
  }

  await refreshBroadcastCounters(broadcastId)
  return { sent, failed }
}

/** Reencola los fallidos de un broadcast: status pending con fecha de hoy.
 *  A10: excluye destinatarios SUPRIMIDOS (rebote duro/queja posteriores al
 *  envío original — reenviarles daña la reputación SES) y respeta un tope de
 *  intentos para no reencolar eternamente lo que siempre falla. */
const MAX_EMAIL_ATTEMPTS = 3

export async function retryFailedEmails(broadcastId: string): Promise<number> {
  const supabase = createAdminClient()
  const { data: failedLogs, error: fErr } = await supabase
    .from('message_logs')
    .select('id, member_id, attempts')
    .eq('broadcast_id', broadcastId)
    .eq('channel', 'email')
    .in('status', ['failed', 'bounced'])
  if (fErr) throw fErr
  const logs = (failedLogs ?? []) as Array<{ id: string; member_id: string | null; attempts: number | null }>
  if (!logs.length) return 0

  // Supresión vigente de los miembros involucrados.
  const memberIds = [...new Set(logs.map(l => l.member_id).filter((m): m is string => Boolean(m)))]
  const suppressed = new Set<string>()
  for (let i = 0; i < memberIds.length; i += 300) {
    const { data: ms } = await supabase
      .from('members').select('id, email_bounced, email_complained')
      .in('id', memberIds.slice(i, i + 300))
    for (const m of (ms ?? []) as Array<{ id: string; email_bounced: boolean | null; email_complained: boolean | null }>) {
      if (m.email_bounced || m.email_complained) suppressed.add(m.id)
    }
  }

  const retryIds = logs
    .filter(l => (l.attempts ?? 0) < MAX_EMAIL_ATTEMPTS)
    .filter(l => !l.member_id || !suppressed.has(l.member_id))
    .map(l => l.id)
  if (!retryIds.length) return 0

  // Chunking por 300: un broadcast con muchos fallos genera miles de retryIds;
  // un .in() masivo en el UPDATE revienta la query (auditoría db 2026-07-18).
  let requeued = 0
  for (let i = 0; i < retryIds.length; i += 300) {
    const { data, error } = await supabase
      .from('message_logs')
      .update({ status: 'pending', scheduled_date: todayStr(), last_error: null })
      .in('id', retryIds.slice(i, i + 300))
      .in('status', ['failed', 'bounced'])
      .select('id')
    if (error) throw error
    requeued += data?.length ?? 0
  }
  return requeued
}

export type QueueStats = {
  total: number
  sent: number
  pending: number
  failed: number
  lastScheduledDate: string | null
  emailConfigured: boolean
  dailyLimit: number
  sentToday: number
}

/** Estado de la cola de un broadcast (para la barra de progreso del detalle). */
export async function getBroadcastQueueStats(broadcastId: string): Promise<QueueStats> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('message_logs')
    .select('status, scheduled_date')
    .eq('broadcast_id', broadcastId)
    .eq('channel', 'email')
  if (error) throw error
  const logs = (data ?? []) as Array<{ status: string; scheduled_date: string | null }>
  const pendingDates = logs.filter(l => l.status === 'pending').map(l => l.scheduled_date).filter(Boolean) as string[]
  return {
    total: logs.length,
    sent: logs.filter(l => l.status === 'sent' || l.status === 'delivered').length,
    pending: pendingDates.length,
    failed: logs.filter(l => l.status === 'failed' || l.status === 'bounced').length,
    lastScheduledDate: pendingDates.length ? pendingDates.sort().at(-1)! : null,
    emailConfigured: isEmailConfigured(),
    dailyLimit: DAILY_LIMIT,
    sentToday: await getDailyEmailsSent(),
  }
}

export type MessageRecipient = {
  id: string
  name: string
  email: string | null
  phone: string | null
  channel: 'whatsapp' | 'email'
  status: 'sent' | 'failed'
  delivered_at: string | null
}

/** Destinatarios reales de un broadcast (desde message_logs + member),
 *  paginados server-side con count exacto. `status` filtra exitosos/fallidos. */
export async function getMessageRecipients(
  broadcastId: string,
  opts: { page?: number; pageSize?: number; status?: 'all' | 'sent' | 'failed' } = {},
): Promise<{ rows: MessageRecipient[]; total: number }> {
  const supabase = createAdminClient()
  const page = Math.max(1, Math.trunc(opts.page ?? 1))
  const pageSize = Math.min(200, Math.max(1, Math.trunc(opts.pageSize ?? 50)))

  let q = supabase
    .from('message_logs')
    .select('id, member_id, recipient, channel, status, delivered_at, member:members(first_name, last_name, email, phone)', { count: 'exact' })
    .eq('broadcast_id', broadcastId)
    .order('created_at', { ascending: true })
  if (opts.status === 'failed') q = q.in('status', ['failed', 'bounced'])
  else if (opts.status === 'sent') q = q.not('status', 'in', '("failed","bounced")')

  const { data, error, count } = await q.range((page - 1) * pageSize, page * pageSize - 1)
  if (error) throw error
  const rows = (data ?? []) as Array<{
    id: string; recipient: string; channel: 'whatsapp' | 'email'; status: string; delivered_at: string | null
    member: { first_name: string; last_name: string; email: string | null; phone: string | null } | null
  }>
  return {
    rows: rows.map(r => ({
      id: r.id,
      name: r.member ? `${r.member.first_name} ${r.member.last_name}`.trim() : r.recipient,
      email: r.member?.email ?? null,
      phone: r.member?.phone ?? null,
      channel: r.channel,
      status: r.status === 'failed' || r.status === 'bounced' ? 'failed' : 'sent',
      delivered_at: r.delivered_at,
    })),
    total: count ?? 0,
  }
}
