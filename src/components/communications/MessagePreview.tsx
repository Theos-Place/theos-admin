import { WhatsAppPreview } from './WhatsAppPreview'
import { EmailPreview } from './EmailPreview'

interface Props {
  channel: 'whatsapp' | 'email' | 'both'
  subject: string
  waBody: string
  emailBody: string
}

export function MessagePreview({ channel, subject, waBody, emailBody }: Props) {
  return (
    <div>
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
        <EmailPreview subject={subject} body={emailBody} />
      )}
    </div>
  )
}
