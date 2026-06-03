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
