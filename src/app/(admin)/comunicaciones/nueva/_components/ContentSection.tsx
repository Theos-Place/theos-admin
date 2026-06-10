import { type RefObject } from 'react'
import type { CommunicationChannel } from '@/types/communication'
import { VariableChips } from '@/components/communications/VariableChips'
import { cn } from '@/lib/utils'
import { FileText } from 'lucide-react'

const SECTION_TITLE = 'text-[10px] uppercase tracking-widests text-navy-light/40 font-display'

type Props = {
  channel: CommunicationChannel
  subject: string
  setSubject: (v: string) => void
  waBody: string
  setWaBody: (v: string) => void
  emailBody: string
  setEmailBody: (v: string) => void
  previewChannel: 'whatsapp' | 'email'
  setPreviewChannel: (c: 'whatsapp' | 'email') => void
  waRef: RefObject<HTMLTextAreaElement | null>
  emailRef: RefObject<HTMLTextAreaElement | null>
  onInsertVariable: (v: string) => void
  onOpenTemplateModal: () => void
}

export function ContentSection({
  channel,
  subject,
  setSubject,
  waBody,
  setWaBody,
  emailBody,
  setEmailBody,
  previewChannel,
  setPreviewChannel,
  waRef,
  emailRef,
  onInsertVariable,
  onOpenTemplateModal,
}: Props) {
  return (
    <div className="rounded-2xl p-5 space-y-4 bg-surface-card shadow-[var(--shadow-md)]">
      <div className="flex items-center justify-between">
        <p className={cn(SECTION_TITLE)}>
          3 · Contenido
        </p>
        <button
          type="button"
          onClick={onOpenTemplateModal}
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
        >
          <FileText size={12} />
          Usar plantilla
        </button>
      </div>

      {(channel === 'email' || channel === 'both') && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-navy-light/50 font-body">Asunto del correo</p>
          <input
            className="w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
            placeholder="Asunto del correo..."
            value={subject}
            onChange={e => setSubject(e.target.value)}
          />
        </div>
      )}

      {(channel === 'whatsapp' || channel === 'both') && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-navy-light/50 font-body">
              Mensaje de WhatsApp <span className="text-navy-light/60">(soporta *negrita*, _itálica_, ~tachado~)</span>
            </p>
            <span className="text-[11px] text-navy-light/60 tabular-nums font-mono">
              {waBody.length}/1000
            </span>
          </div>
          <textarea
            ref={waRef}
            rows={6}
            maxLength={1000}
            className="w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 resize-none font-body"
            placeholder="Hola {nombre} 👋&#10;&#10;Tu mensaje aquí..."
            value={waBody}
            onChange={e => setWaBody(e.target.value)}
            onFocus={() => setPreviewChannel('whatsapp')}
          />
        </div>
      )}

      {(channel === 'email' || channel === 'both') && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-navy-light/50 font-body">
            Cuerpo del correo
          </p>
          <textarea
            ref={emailRef}
            rows={6}
            className="w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 resize-none font-body"
            placeholder="Hola {nombre},&#10;&#10;Tu mensaje aquí..."
            value={emailBody}
            onChange={e => setEmailBody(e.target.value)}
            onFocus={() => setPreviewChannel('email')}
          />
        </div>
      )}

      <VariableChips onInsert={onInsertVariable} />
    </div>
  )
}
