import { createAdminClient } from '@/lib/supabase/admin'
import type { CommunicationChannel, CommunicationStatus } from '@/types/communication'

// NOTA: createAdminClient (service role) porque la app corre con mock auth.

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

/** Envía un broadcast: crea message_logs por destinatario y actualiza estado/conteos.
 *  En esta fase (sin proveedor real) marca todos como 'sent'. */
export async function sendBroadcast(id: string, recipients: Recipient[]): Promise<void> {
  const supabase = createAdminClient()

  await supabase.from('message_broadcasts')
    .update({ status: 'sending', started_at: new Date().toISOString() }).eq('id', id)

  if (recipients.length > 0) {
    const logs = recipients.map((r) => ({
      broadcast_id: id,
      member_id: r.member_id ?? null,
      channel: r.channel,
      recipient: r.recipient,
      status: 'sent',
      sent_at: new Date().toISOString(),
    }))
    const { error: lErr } = await supabase.from('message_logs').insert(logs)
    if (lErr) throw lErr
  }

  const { error } = await supabase.from('message_broadcasts').update({
    status: 'sent',
    total_recipients: recipients.length,
    sent_count: recipients.length,
    completed_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw error
}
