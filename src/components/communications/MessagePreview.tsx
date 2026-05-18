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
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          margin: '16px 0', color: 'var(--fg-muted)', fontSize: 11,
        }}>
          <div style={{ flex: 1, height: 1, background: 'var(--outline)' }} />
          <span style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.08em', color: 'var(--navy-light)', opacity: 0.4 }}>
            Y TAMBIÉN
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--outline)' }} />
        </div>
      )}

      {(channel === 'email' || channel === 'both') && (
        <EmailPreview subject={subject} body={emailBody} />
      )}
    </div>
  )
}
