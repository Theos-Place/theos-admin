// Communications module domain types.

// 'interna' = notificación interna en el sistema (campana), sin correo/WhatsApp.
export type CommunicationChannel = 'interna' | 'whatsapp' | 'email' | 'both'
export type CommunicationStatus = 'draft' | 'sending' | 'sent' | 'failed' | 'partial'

export type CommunicationMessage = {
  id: string
  subject: string
  body: string
  channel: CommunicationChannel
  status: CommunicationStatus
  sent_by: string
  sent_at: string | null
  created_at: string
  segment: {
    label: string
    filters: Record<string, unknown>
    total_recipients: number
  }
  stats: {
    total: number
    sent: number
    delivered: number
    failed: number
    skipped: number
    whatsapp_sent: number
    email_sent: number
  }
  smtp_config_id: string | null
  whatsapp_config_id: string | null
}

export type MessageTemplate = {
  id: string
  name: string
  category: 'bienvenida' | 'recordatorio' | 'inscripcion' | 'cancelacion' | 'general'
  channel: CommunicationChannel
  subject: string
  body: string
  /** 'text' = texto plano (se escapa + nl2br al enviar) | 'html' = código crudo. */
  body_format: 'text' | 'html'
  variables: string[]
  is_active: boolean
  created_at: string
  used_count: number
}

export type ChannelConfig = {
  id: string
  type: 'smtp' | 'whatsapp'
  name: string
  smtp_host?: string
  smtp_port?: number
  smtp_user?: string
  smtp_from_name?: string
  smtp_from_email?: string
  wa_account_id?: string
  wa_phone_number?: string
  is_active: boolean
  is_verified: boolean
  last_verified_at: string | null
}
