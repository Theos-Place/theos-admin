import { Bell } from 'lucide-react'
import { WhatsAppPreview } from './WhatsAppPreview'
import { EmailPreview } from './EmailPreview'
import { renderEmail } from '@/lib/email/baseLayout'
import type { CommunicationChannel } from '@/types/communication'

interface Props {
  channel: CommunicationChannel
  subject: string
  waBody: string
  emailBody: string
  emailFormat?: 'text' | 'html'
  /** Marketing → muestra el pie de baja en el preview (igual que el envío). */
  marketing?: boolean
}

export function MessagePreview({ channel, subject, waBody, emailBody, marketing = true }: Props) {
  // El correo se previsualiza envuelto en el layout base (mismo que el envío).
  const emailDoc = renderEmail(emailBody, marketing ? { unsubscribeUrl: '#' } : undefined)
  return (
    <div>
      {channel === 'interna' && (
        <div className="rounded-2xl p-4 bg-surface-card shadow-[var(--shadow-md)]">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-coral/10 flex items-center justify-center shrink-0">
              <Bell size={14} className="text-coral" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-navy font-body">
                {subject || 'Título de la alerta'}
              </p>
              <p className="text-[13px] text-navy-light/70 font-body whitespace-pre-wrap mt-0.5">
                {waBody}
              </p>
              <p className="text-[11px] text-navy-light/60 font-body mt-1.5">
                Así se verá en la campana de notificaciones
              </p>
            </div>
          </div>
        </div>
      )}

      {(channel === 'whatsapp' || channel === 'both') && (
        <WhatsAppPreview fromName="Theos Place" body={waBody} />
      )}

      {channel === 'both' && (
        <div className="flex items-center gap-2 my-4 text-[var(--fg-muted)] text-[11px]">
          <div className="flex-1 h-px bg-[var(--outline)]" />
          <span className="font-display tracking-[0.08em] text-[var(--navy-light)] opacity-40">
            Y TAMBIÉN
          </span>
          <div className="flex-1 h-px bg-[var(--outline)]" />
        </div>
      )}

      {(channel === 'email' || channel === 'both') && (
        <EmailPreview subject={subject} body={emailDoc} format="html" fullDocument />
      )}
    </div>
  )
}
