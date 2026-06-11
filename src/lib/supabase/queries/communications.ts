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
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, isBrevoConfigured, DAILY_LIMIT } from '@/lib/email/brevo'
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
  variables: unknown
  is_active: boolean
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
      created_by, started_at, completed_at, created_at, smtp_config_id, whatsapp_config_id,
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
      id, name, category, channel, subject, body, variables, is_active, created_at,
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
  variables?: unknown
  is_active?: boolean
}

export async function createTemplate(input: TemplateWriteInput): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('message_templates').insert(input).select('id').single()
  if (error) throw error
  return data as { id: string }
}

export async function updateTemplate(id: string, patch: Partial<TemplateWriteInput>): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('message_templates').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteTemplate(id: string): Promise<void> {
  const supabase = createAdminClient()
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
  subject?: string | null
  body: string
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
    .insert({ ...input, status: 'draft' })
    .select('id')
    .single()
  if (error) throw error
  return data as { id: string }
}

export type Recipient = { member_id?: string | null; channel: 'whatsapp' | 'email'; recipient: string }

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

/** Emails enviados hoy por todos los broadcasts (para el rate limit diario). */
export async function getDailyEmailsSent(): Promise<number> {
  const supabase = createAdminClient()
  const startOfDay = `${todayStr()}T00:00:00.000Z`
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
  for (let i = 0; i < today; i++) dates.push(now.toISOString().split('T')[0])
  remaining -= today
  // Días siguientes: bloques de dailyLimit.
  let dayOffset = 1
  while (remaining > 0) {
    const batch = Math.min(remaining, dailyLimit)
    const d = new Date(now)
    d.setDate(d.getDate() + dayOffset)
    const ds = d.toISOString().split('T')[0]
    for (let i = 0; i < batch; i++) dates.push(ds)
    remaining -= batch
    dayOffset++
  }
  return dates
}

/**
 * Envía un broadcast real:
 * 1. Crea message_logs 'pending' con scheduled_date distribuida por días según
 *    el límite diario de Brevo (lo de hoy se procesa inmediatamente; el resto
 *    lo recoge el cron diario).
 * 2. WhatsApp queda en 'pending' sin procesar (se integra después).
 * Lanza error claro si Brevo no está configurado (antes de crear logs).
 */
export async function sendBroadcast(id: string, recipients: Recipient[]): Promise<void> {
  const supabase = createAdminClient()

  const emailRecipients = recipients.filter(r => r.channel === 'email')
  if (emailRecipients.length > 0 && !isBrevoConfigured()) {
    throw new Error('BREVO_NOT_CONFIGURED')
  }

  await supabase.from('message_broadcasts')
    .update({ status: 'sending', started_at: new Date().toISOString() })
    .eq('id', id)

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

  if (emailLogs.length + waLogs.length > 0) {
    const { error } = await supabase.from('message_logs').insert([...emailLogs, ...waLogs])
    if (error) throw error
  }

  await supabase.from('message_broadcasts')
    .update({ total_recipients: recipients.length })
    .eq('id', id)

  // Procesar inmediatamente el batch de hoy.
  const today = todayStr()
  if (emailLogs.some(l => l.scheduled_date === today)) {
    await processPendingEmails(id)
  } else {
    await refreshBroadcastCounters(id)
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
  const finalStatus = failed === 0 ? 'sent' : sent > 0 ? 'partial' : 'failed'
  const { error } = await supabase.from('message_broadcasts').update({
    sent_count: sent,
    failed_count: failed,
    status: done ? finalStatus : 'sending',
    completed_at: done ? new Date().toISOString() : null,
  }).eq('id', broadcastId)
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
    .select('subject, body, smtp_config_id, config:channel_configs!message_broadcasts_smtp_config_id_fkey(smtp_from_name, smtp_from_email)')
    .eq('id', broadcastId)
    .single()
  if (bErr || !broadcastRow) throw new Error('Broadcast no encontrado')
  const broadcast = broadcastRow as unknown as {
    subject: string | null; body: string
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

  // Recuperar claims huérfanos: filas que quedaron en 'sending' hace más de
  // una hora (proceso muerto entre el claim y el envío) vuelven a 'pending'.
  await supabase.from('message_logs')
    .update({ status: 'pending', claimed_at: null })
    .eq('broadcast_id', broadcastId)
    .eq('status', 'sending')
    .lt('claimed_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())

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

  // CLAIM ATÓMICO (auditoría S6): reclamamos el lote pasándolo a 'sending'
  // con un UPDATE condicionado a status='pending'. Si otra ejecución corre a
  // la vez (cron + botón manual), cada fila la reclama solo una — adiós
  // emails duplicados. Solo se procesa lo efectivamente reclamado.
  const candidateIds = logs.slice(0, available).map(l => l.id)
  if (candidateIds.length === 0) {
    await refreshBroadcastCounters(broadcastId)
    return { sent: 0, failed: 0 }
  }
  const { data: claimedData, error: clErr } = await supabase
    .from('message_logs')
    .update({ status: 'sending', claimed_at: new Date().toISOString() })
    .in('id', candidateIds)
    .eq('status', 'pending')
    .select('id, recipient, member_id, attempts')
  if (clErr) throw clErr
  const batch = (claimedData ?? []) as Array<{ id: string; recipient: string; member_id: string | null; attempts: number | null }>
  if (!batch.length) {
    await refreshBroadcastCounters(broadcastId)
    return { sent: 0, failed: 0 }
  }

  // Nombres de los miembros en un solo query (no N+1).
  const memberIds = Array.from(new Set(batch.map(l => l.member_id).filter(Boolean))) as string[]
  const names = new Map<string, string>()
  if (memberIds.length) {
    const { data: members } = await supabase
      .from('members').select('id, first_name, last_name').in('id', memberIds)
    for (const m of (members ?? []) as Array<{ id: string; first_name: string; last_name: string }>) {
      names.set(m.id, `${m.first_name} ${m.last_name}`.trim())
    }
  }

  let sent = 0, failed = 0
  for (const log of batch) {
    const attempts = (log.attempts ?? 0) + 1
    try {
      await sendEmail({
        to: { email: log.recipient, name: (log.member_id && names.get(log.member_id)) || log.recipient },
        fromName: broadcast.config?.smtp_from_name ?? 'Theos Place',
        fromEmail: broadcast.config?.smtp_from_email ?? 'notificaciones@theosplace.org',
        subject: broadcast.subject ?? 'Mensaje de Theos Place',
        html: broadcast.body,
      })
      await supabase.from('message_logs')
        .update({ status: 'sent', sent_at: new Date().toISOString(), attempts, last_error: null })
        .eq('id', log.id)
      sent++
      // Delay corto para no saturar la API de Brevo.
      await new Promise(r => setTimeout(r, 200))
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

/** Reencola los fallidos de un broadcast: status pending con fecha de hoy. */
export async function retryFailedEmails(broadcastId: string): Promise<number> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('message_logs')
    .update({ status: 'pending', scheduled_date: todayStr(), last_error: null })
    .eq('broadcast_id', broadcastId)
    .eq('channel', 'email')
    .in('status', ['failed', 'bounced'])
    .select('id')
  if (error) throw error
  return data?.length ?? 0
}

export type QueueStats = {
  total: number
  sent: number
  pending: number
  failed: number
  lastScheduledDate: string | null
  brevoConfigured: boolean
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
    brevoConfigured: isBrevoConfigured(),
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

/** Destinatarios reales de un broadcast (desde message_logs + member). */
export async function getMessageRecipients(broadcastId: string): Promise<MessageRecipient[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('message_logs')
    .select('id, member_id, recipient, channel, status, delivered_at, member:members(first_name, last_name, email, phone)')
    .eq('broadcast_id', broadcastId)
    .order('created_at', { ascending: true })
  if (error) throw error
  const rows = (data ?? []) as unknown as Array<{
    id: string; recipient: string; channel: 'whatsapp' | 'email'; status: string; delivered_at: string | null
    member: { first_name: string; last_name: string; email: string | null; phone: string | null } | null
  }>
  return rows.map(r => ({
    id: r.id,
    name: r.member ? `${r.member.first_name} ${r.member.last_name}`.trim() : r.recipient,
    email: r.member?.email ?? null,
    phone: r.member?.phone ?? null,
    channel: r.channel,
    status: r.status === 'failed' || r.status === 'bounced' ? 'failed' : 'sent',
    delivered_at: r.delivered_at,
  }))
}
