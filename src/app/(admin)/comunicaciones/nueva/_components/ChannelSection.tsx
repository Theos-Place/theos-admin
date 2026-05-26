import type { CommunicationChannel, ChannelConfig } from '@/types/communication'
import { cn } from '@/lib/utils'
import { MessageCircle, Mail, Layers } from 'lucide-react'

const SECTION_TITLE = 'text-[10px] uppercase tracking-widests text-navy-light/40'

type Props = {
  channel: CommunicationChannel
  setChannel: (c: CommunicationChannel) => void
  waConfig: ChannelConfig | undefined
  smtpConfig: ChannelConfig | undefined
}

export function ChannelSection({ channel, setChannel, waConfig, smtpConfig }: Props) {
  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
      <p className={cn(SECTION_TITLE)} style={{ fontFamily: 'var(--font-display)' }}>
        2 · Canal de envío
      </p>
      <div className="flex gap-2">
        {([
          { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'text-emerald-600' },
          { key: 'email',    label: 'Correo',   icon: Mail,          color: 'text-blue-600'    },
          { key: 'both',     label: 'Ambos',    icon: Layers,        color: 'text-violet-600'  },
        ] as const).map(opt => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setChannel(opt.key)}
            className={cn(
              'flex-1 flex flex-col items-center gap-1.5 rounded-xl border p-3 text-[12px] font-medium transition-all',
              channel === opt.key ? 'bg-navy border-navy text-white' : 'text-navy-light/60 hover:text-navy'
            )}
            style={{ borderColor: channel === opt.key ? undefined : 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            <opt.icon size={16} className={channel === opt.key ? 'text-white' : opt.color} />
            {opt.label}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        {(channel === 'whatsapp' || channel === 'both') && (
          <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--surface-low)' }}>
            <MessageCircle size={13} className="text-emerald-600 shrink-0" />
            <p className="text-[12px] text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
              {waConfig
                ? `${waConfig.name} · ${waConfig.wa_phone_number}`
                : <span className="text-coral">Sin configuración WhatsApp activa</span>}
            </p>
          </div>
        )}
        {(channel === 'email' || channel === 'both') && (
          <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--surface-low)' }}>
            <Mail size={13} className="text-blue-600 shrink-0" />
            <p className="text-[12px] text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
              {smtpConfig
                ? `${smtpConfig.name} · ${smtpConfig.smtp_from_email}`
                : <span className="text-coral">Sin configuración SMTP activa</span>}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
