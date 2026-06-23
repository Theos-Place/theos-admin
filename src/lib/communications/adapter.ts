// Adapta filas de Supabase a los tipos de dominio de comunicaciones.

import type { DbBroadcast, DbTemplate, DbChannelConfig } from '@/lib/supabase/queries/communications'
import type { CommunicationMessage, MessageTemplate, ChannelConfig } from '@/types/communication'

export function toDomainMessage(db: DbBroadcast): CommunicationMessage {
  const logs = db.logs ?? []
  const isOk = (s: string) => s === 'sent' || s === 'delivered'
  const stats = {
    total: db.total_recipients || logs.length,
    sent: logs.filter((l) => isOk(l.status)).length,
    delivered: logs.filter((l) => l.status === 'delivered').length,
    failed: logs.filter((l) => l.status === 'failed' || l.status === 'bounced').length,
    skipped: db.skipped_count ?? 0,
    whatsapp_sent: logs.filter((l) => l.channel === 'whatsapp' && isOk(l.status)).length,
    email_sent: logs.filter((l) => l.channel === 'email' && isOk(l.status)).length,
  }

  return {
    id: db.id,
    subject: db.subject ?? '',
    body: db.body,
    channel: db.channel,
    status: db.status,
    sent_by: db.created_by ?? '',
    sent_at: db.completed_at ?? db.started_at,
    created_at: db.created_at,
    segment: {
      label: db.segment_label ?? '',
      filters: (db.recipient_filter as Record<string, unknown>) ?? {},
      total_recipients: db.total_recipients,
    },
    stats,
    smtp_config_id: db.smtp_config_id,
    whatsapp_config_id: db.whatsapp_config_id,
  }
}

export function toDomainTemplate(db: DbTemplate): MessageTemplate {
  return {
    id: db.id,
    name: db.name,
    category: (db.category as MessageTemplate['category']) ?? 'general',
    channel: db.channel,
    subject: db.subject ?? '',
    body: db.body,
    body_format: db.body_format ?? 'html',
    variables: Array.isArray(db.variables) ? db.variables.map(String) : [],
    is_active: db.is_active,
    is_system: !!db.is_system,
    system_key: db.system_key ?? null,
    available_variables: Array.isArray(db.available_variables) ? db.available_variables.map(String) : [],
    created_at: db.created_at,
    used_count: db.broadcasts?.length ?? 0,
  }
}

export function toDomainChannelConfig(db: DbChannelConfig): ChannelConfig {
  return {
    id: db.id,
    type: db.type,
    name: db.name,
    smtp_host: db.smtp_host ?? undefined,
    smtp_port: db.smtp_port ?? undefined,
    smtp_user: db.smtp_user ?? undefined,
    smtp_from_name: db.smtp_from_name ?? undefined,
    smtp_from_email: db.smtp_from_email ?? undefined,
    wa_account_id: db.wa_account_id ?? undefined,
    wa_phone_number: db.wa_phone_number ?? undefined,
    is_active: db.is_active,
    is_verified: db.is_verified,
    last_verified_at: db.last_verified_at,
  }
}
