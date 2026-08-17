'use client'

import { useEffect, useState } from 'react'
import type { CommunicationChannel, ChannelConfig } from '@/types/communication'
import { cn } from '@/lib/utils'
import { MessageCircle, Mail, Bell } from 'lucide-react'

const SECTION_TITLE = 'text-[11px] uppercase tracking-widest text-navy-light/70 font-display'

type Props = {
  channel: CommunicationChannel
  setChannel: (c: CommunicationChannel) => void
  waConfig: ChannelConfig | undefined
}

export function ChannelSection({ channel, setChannel, waConfig }: Props) {
  // Estado real de SES (env del servidor), no de channel_configs en BD.
  const [email, setEmail] = useState<{ configured: boolean; fromEmail: string } | null>(null)
  useEffect(() => {
    let alive = true
    fetch('/api/communications/email-status')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d) setEmail({ configured: !!d.configured, fromEmail: d.fromEmail ?? '' }) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  return (
    <div className="rounded-2xl p-5 space-y-4 bg-surface-card shadow-[var(--shadow-md)]">
      <p className={cn(SECTION_TITLE)}>
        2 · Canal de envío
      </p>
      <div className="flex gap-2">
        {([
          { key: 'interna',  label: 'Alerta interna', icon: Bell,          color: 'text-coral',       disabled: false },
          { key: 'email',    label: 'Correo',         icon: Mail,          color: 'text-blue-600',    disabled: false },
          { key: 'whatsapp', label: 'WhatsApp',       icon: MessageCircle, color: 'text-emerald-600', disabled: true  },
        ] as const).map(opt => (
          <button
            key={opt.key}
            type="button"
            disabled={opt.disabled}
            onClick={() => { if (!opt.disabled) setChannel(opt.key) }}
            aria-label={opt.disabled ? `${opt.label} (próximamente)` : opt.label}
            className={cn(
              'flex-1 flex flex-col items-center gap-1.5 rounded-xl border p-3 text-[12px] font-medium transition-all font-body',
              opt.disabled
                ? 'opacity-50 cursor-not-allowed text-navy-light/70'
                : channel === opt.key ? 'bg-navy border-navy text-white' : 'text-navy-light/70 hover:text-navy'
            )}
            style={{ borderColor: !opt.disabled && channel === opt.key ? undefined : 'var(--outline-variant)' }}
          >
            <opt.icon size={16} className={!opt.disabled && channel === opt.key ? 'text-white' : opt.color} />
            {opt.label}
            {opt.disabled && (
              <span className="text-[11px] font-normal text-navy-light/70 font-body">Próximamente</span>
            )}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        {channel === 'interna' && (
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-surface-low">
            <Bell size={13} className="text-coral shrink-0" />
            <p className="text-[12px] text-navy-light/70 font-body">
              Se entrega como notificación dentro del sistema (campana). El destinatario la ve al iniciar sesión; no requiere configurar correo ni WhatsApp.
            </p>
          </div>
        )}
        {(channel === 'whatsapp' || channel === 'both') && (
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-surface-low">
            <MessageCircle size={13} className="text-emerald-600 shrink-0" />
            <p className="text-[12px] text-navy-light/70 font-body">
              {waConfig
                ? `${waConfig.name} · ${waConfig.wa_phone_number}`
                : <span className="text-coral">Sin configuración WhatsApp activa</span>}
            </p>
          </div>
        )}
        {(channel === 'email' || channel === 'both') && (
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-surface-low">
            <Mail size={13} className="text-blue-600 shrink-0" />
            <p className="text-[12px] text-navy-light/70 font-body">
              {email?.configured
                ? `AWS SES${email.fromEmail ? ` · ${email.fromEmail}` : ''}`
                : <span className="text-coral">El proveedor de email (SES) no está configurado</span>}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
