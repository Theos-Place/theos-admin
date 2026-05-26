import { mockMembers } from '@/data/mock-members'
import { RecipientSelector, type RecipientState } from '@/components/communications/RecipientSelector'
import { cn } from '@/lib/utils'
import { Check, X, List } from 'lucide-react'
import type { CommunicationMessage } from '@/types/communication'

const SECTION_TITLE = 'text-[10px] uppercase tracking-widests text-navy-light/40'
const PREVIEW_COUNT = 20

type Props = {
  recipients: RecipientState
  setRecipients: (v: RecipientState) => void
  isImported: boolean
  setIsImported: (v: boolean) => void
  showExpandedList: boolean
  setShowExpandedList: (v: (prev: boolean) => boolean) => void
  initialSegmentLabel: string
  initialMemberIds: string[]
  reenviarMsg: CommunicationMessage | null | undefined
  onOpenListModal: () => void
}

export function RecipientsSection({
  recipients,
  setRecipients,
  isImported,
  setIsImported,
  showExpandedList,
  setShowExpandedList,
  initialSegmentLabel,
  initialMemberIds,
  reenviarMsg,
  onOpenListModal,
}: Props) {
  const previewMembers = mockMembers
    .filter(m => initialMemberIds.includes(m.id))
    .slice(0, PREVIEW_COUNT)

  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
      <p className={cn(SECTION_TITLE)} style={{ fontFamily: 'var(--font-display)' }}>
        1 · Destinatarios
      </p>

      {reenviarMsg && (
        <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px]" style={{ background: 'rgba(112,189,194,0.1)', fontFamily: 'var(--font-body)' }}>
          <Check size={13} className="text-teal-deep shrink-0" />
          <span className="text-teal-deep">Reenviando: &ldquo;{reenviarMsg.subject || reenviarMsg.body.slice(0, 60)}&rdquo;</span>
        </div>
      )}

      {isImported ? (
        <div className="space-y-3">
          <div
            className="rounded-xl p-4 space-y-2"
            style={{ background: 'var(--surface-low)', border: '1px solid var(--outline-variant)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                  Destinatarios ({recipients.count.toLocaleString('es-CR')})
                </p>
                <div className="h-px my-1.5" style={{ background: 'var(--outline-variant)' }} />
                <p className="text-[12px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
                  Importado desde lista de miembros
                </p>
                {initialSegmentLabel && (
                  <p className="text-[13px] font-medium text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                    &quot;{initialSegmentLabel}&quot;
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsImported(false)
                  setRecipients({ mode: 'manual', manualMemberIds: [], groupEntity: null, groupId: '', label: '', count: 0 })
                }}
                className="flex items-center gap-1 text-[11px] text-navy-light/50 hover:text-coral transition-colors shrink-0"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <X size={12} />
                Limpiar
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowExpandedList(v => !v)}
              className="text-[12px] text-coral hover:underline transition-colors"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {showExpandedList ? 'Ocultar lista ↑' : 'Ver lista completa ↓'}
            </button>

            {showExpandedList && (
              <div className="space-y-1.5 pt-1">
                {previewMembers.map(m => (
                  <div key={m.id} className="flex items-center gap-2 text-[12px] text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
                    <div className="h-5 w-5 rounded-full bg-navy/10 flex items-center justify-center text-[9px] font-bold text-navy shrink-0">
                      {m.first_name[0]}{m.last_name[0]}
                    </div>
                    {m.first_name} {m.last_name}
                  </div>
                ))}
                {recipients.count > previewMembers.length && (
                  <p className="text-[11px] text-navy-light/40 pt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
                    y {(recipients.count - previewMembers.length).toLocaleString('es-CR')} más
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <RecipientSelector value={recipients} onChange={setRecipients} />
          <button
            type="button"
            onClick={onOpenListModal}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            <List size={12} />
            Usar lista existente
          </button>
        </>
      )}
    </div>
  )
}
