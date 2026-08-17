import { useState, useEffect } from 'react'
import { RecipientSelector, type RecipientState } from '@/components/communications/RecipientSelector'
import { cn } from '@/lib/utils'
import { Check, X } from 'lucide-react'
import type { CommunicationMessage } from '@/types/communication'

const SECTION_TITLE = 'text-[11px] uppercase tracking-widest text-navy-light/70 font-display'
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
  // Nombres reales para el preview de la lista importada (antes venían de
  // mockMembers, que no coincide con los ids reales → preview vacío).
  const [previewMembers, setPreviewMembers] = useState<Array<{ id: string; first_name: string; last_name: string }>>([])
  useEffect(() => {
    const ids = initialMemberIds.slice(0, PREVIEW_COUNT)
    if (ids.length === 0) { setPreviewMembers([]); return }
    let alive = true
    fetch('/api/members/by-ids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d?.members) setPreviewMembers(d.members) })
      .catch(() => {})
    return () => { alive = false }
  }, [initialMemberIds])

  return (
    <div className="rounded-2xl p-5 space-y-4 bg-surface-card shadow-[var(--shadow-md)]">
      <p className={cn(SECTION_TITLE)}>
        1 · Destinatarios
      </p>

      {reenviarMsg && (
        <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] bg-[rgba(112,189,194,0.1)] font-body">
          <Check size={13} className="text-teal-deep shrink-0" />
          <span className="text-teal-deep">Reenviando: &ldquo;{reenviarMsg.subject || reenviarMsg.body.slice(0, 60)}&rdquo;</span>
        </div>
      )}

      {isImported ? (
        <div className="space-y-3">
          <div
            className="rounded-xl p-4 space-y-2 bg-surface-low border border-[var(--outline-variant)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-navy font-body">
                  Destinatarios ({recipients.count.toLocaleString('es-CR')})
                </p>
                <div className="h-px my-1.5 bg-[var(--outline-variant)]" />
                <p className="text-[12px] text-navy-light/70 font-body">
                  Importado desde lista de miembros
                </p>
                {initialSegmentLabel && (
                  <p className="text-[13px] font-medium text-navy font-body">
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
                className="flex items-center gap-1 text-[12px] text-navy-light/70 hover:text-coral transition-colors shrink-0 font-body"
              >
                <X size={12} />
                Limpiar
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowExpandedList(v => !v)}
              className="text-[12px] text-coral hover:underline transition-colors font-body"
            >
              {showExpandedList ? 'Ocultar lista ↑' : 'Ver lista completa ↓'}
            </button>

            {showExpandedList && (
              <div className="space-y-1.5 pt-1">
                {previewMembers.map(m => (
                  <div key={m.id} className="flex items-center gap-2 text-[12px] text-navy-light/70 font-body">
                    <div className="h-5 w-5 rounded-full bg-navy/10 flex items-center justify-center text-[10px] font-bold text-navy shrink-0">
                      {m.first_name[0]}{m.last_name[0]}
                    </div>
                    {m.first_name} {m.last_name}
                  </div>
                ))}
                {recipients.count > previewMembers.length && (
                  <p className="text-[12px] text-navy-light/70 pt-0.5 font-body">
                    y {(recipients.count - previewMembers.length).toLocaleString('es-CR')} más
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        // "Lista guardada" es el 4º botón de la fila del selector (antes estaba
        // suelto debajo y pasaba desapercibido).
        <RecipientSelector
          value={recipients}
          onChange={setRecipients}
          onOpenListModal={onOpenListModal}
          fromList={isImported}
        />
      )}
    </div>
  )
}
