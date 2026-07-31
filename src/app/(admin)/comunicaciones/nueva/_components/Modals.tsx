'use client'

import { useState } from 'react'
import type { CommunicationChannel, MessageTemplate } from '@/types/communication'
import type { MemberList } from '@/types/member-list'
import { ChannelBadge } from '@/components/communications/ChannelBadge'
import type { RecipientState } from '@/components/communications/RecipientSelector'
import { Search, Send, AlertTriangle, Eye } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { TemplatePreviewBody } from '@/components/communications/TemplatePreviewModal'
import { templateSnippet } from '@/lib/communications/template-snippet'

// ─── List Modal ──────────────────────────────────────────────────────────────

type ListModalProps = {
  filteredLists: MemberList[]
  listSearch: string
  setListSearch: (v: string) => void
  onApplyList: (id: string) => void
  onClose: () => void
}

export function ListModal({ filteredLists, listSearch, setListSearch, onApplyList, onClose }: ListModalProps) {
  return (
    <Modal onClose={onClose} titleId="seleccionar-lista" width={448}>
      <div>
        <div className="px-5 py-4 border-b border-[var(--outline-variant)]">
          <p id="seleccionar-lista" className="text-sm font-bold text-navy font-display">Seleccionar lista</p>
        </div>
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-light/60" />
            <input
              className="w-full rounded-xl bg-surface-low pl-8 pr-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
              placeholder="Buscar lista..."
              aria-label="Buscar lista"
              value={listSearch}
              onChange={e => setListSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        <div className="px-4 pb-4 space-y-2 max-h-80 overflow-y-auto">
          {filteredLists.length === 0 ? (
            <p className="text-sm text-navy-light/60 py-4 text-center font-body">Sin listas.</p>
          ) : filteredLists.map(list => (
            <button
              key={list.id}
              type="button"
              onClick={() => onApplyList(list.id)}
              className="w-full text-left rounded-xl border px-4 py-3 hover:bg-surface-low transition-colors border-[var(--outline-variant)]"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[13px] font-medium text-navy font-body">{list.name}</p>
                  <p className="text-[11px] text-navy-light/60 mt-0.5 font-body">{list.segment_label}</p>
                </div>
                <span className="shrink-0 rounded-full bg-navy/10 px-2 py-0.5 text-[11px] font-semibold text-navy-light/60 tabular-nums font-display">
                  {list.member_count.toLocaleString('es-CR')}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}

// ─── Template Modal ───────────────────────────────────────────────────────────

type TemplateModalProps = {
  filteredTemplates: MessageTemplate[]
  onApplyTemplate: (id: string) => void
  onClose: () => void
}

function norm(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

export function TemplateModal({ filteredTemplates, onApplyTemplate, onClose }: TemplateModalProps) {
  const [q, setQ] = useState('')
  // Preview EN EL MISMO modal (no anidado): el ojo reemplaza la lista y el
  // botón "Volver" regresa a elegir.
  const [preview, setPreview] = useState<MessageTemplate | null>(null)
  const term = norm(q)
  const visible = term
    ? filteredTemplates.filter(t =>
        norm(t.name).includes(term) || norm(t.subject ?? '').includes(term) || norm(t.category ?? '').includes(term))
    : filteredTemplates

  if (preview) {
    return (
      <Modal onClose={onClose} titleId="preview-plantilla" width={680}>
        <TemplatePreviewBody
          template={preview}
          onBack={() => setPreview(null)}
          onUse={t => onApplyTemplate(t.id)}
        />
      </Modal>
    )
  }

  return (
    <Modal onClose={onClose} titleId="seleccionar-plantilla" width={512}>
      <div>
        <div className="px-5 py-4 border-b border-[var(--outline-variant)]">
          <p id="seleccionar-plantilla" className="text-sm font-bold text-navy font-display">Seleccionar plantilla</p>
        </div>
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-light/60" />
            <input
              className="w-full rounded-xl bg-surface-low pl-8 pr-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
              placeholder="Buscar plantilla..."
              aria-label="Buscar plantilla"
              value={q}
              onChange={e => setQ(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        <div className="px-4 pb-4 space-y-2 max-h-96 overflow-y-auto">
          {visible.length === 0 ? (
            <p className="text-sm text-navy-light/60 py-4 text-center font-body">
              {term ? 'Sin coincidencias.' : 'No hay plantillas para este canal.'}
            </p>
          ) : (
            visible.map(tpl => (
              <div
                key={tpl.id}
                className="flex items-start gap-2 rounded-xl border px-3 py-3 hover:bg-surface-low transition-colors border-[var(--outline-variant)]"
              >
                <button
                  type="button"
                  onClick={() => onApplyTemplate(tpl.id)}
                  className="flex-1 min-w-0 text-left space-y-1"
                >
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium text-navy font-body">{tpl.name}</p>
                    <ChannelBadge channel={tpl.channel} size="sm" />
                  </div>
                  {/* El cuerpo es HTML: la primera línea suele ser un comentario
                      o un <style>, así que se resume a texto legible. */}
                  <p className="text-[12px] text-navy-light/70 line-clamp-2 font-body">
                    {templateSnippet(tpl.body, 110) || 'Sin texto visible'}
                  </p>
                  <p className="text-[11px] text-navy-light/70 font-body">Usado {tpl.used_count} veces</p>
                </button>
                <button
                  type="button"
                  onClick={() => setPreview(tpl)}
                  title="Ver cómo se ve"
                  aria-label={`Ver cómo se ve la plantilla ${tpl.name}`}
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-[var(--outline-variant)] px-2.5 py-1 text-[11px] text-navy-light hover:bg-surface-card transition-colors font-body"
                >
                  <Eye size={11} />
                  Ver
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  )
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

type ConfirmModalProps = {
  channel: CommunicationChannel
  recipients: RecipientState
  sending: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmModal({
  channel,
  recipients,
  sending,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  return (
    <Modal onClose={onClose} titleId="confirmar-envio" width={448}>
      <div>
        <div className="px-6 py-5 border-b border-[var(--outline-variant)]">
          <p id="confirmar-envio" className="text-base font-bold text-navy font-display">¿Confirmar envío?</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[13px] font-body">
              <span className="text-navy-light/60">Canal</span>
              <ChannelBadge channel={channel} />
            </div>
            <div className="flex items-center justify-between text-[13px] font-body">
              <span className="text-navy-light/60">Destinatarios</span>
              <span className="font-semibold text-navy">~{recipients.count.toLocaleString('es-CR')} {recipients.count === 1 ? 'persona' : 'personas'}</span>
            </div>
            {recipients.label && (
              <div className="flex items-start justify-between text-[13px] gap-4 font-body">
                <span className="text-navy-light/60 shrink-0">Segmento</span>
                <span className="text-navy text-right">{recipients.label}</span>
              </div>
            )}
          </div>

          {recipients.count > 500 && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5">
              <AlertTriangle size={14} className="text-amber-600 shrink-0" />
              <p className="text-[12px] text-amber-700 font-body">
                Envío masivo a más de {recipients.count.toLocaleString('es-CR')} personas.
              </p>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t flex items-center gap-3 border-[var(--outline-variant)]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 flex items-center justify-center gap-2 rounded-full bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body"
          >
            <Send size={14} />
            {sending ? 'Enviando...' : `Enviar a ${recipients.count.toLocaleString('es-CR')} persona${recipients.count !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Sending Overlay ──────────────────────────────────────────────────────────

type SendingOverlayProps = {
  recipientCount: number
}

export function SendingOverlay({ recipientCount }: SendingOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-navy-ink/60 backdrop-blur-sm">
      <div className="rounded-2xl px-8 py-8 flex flex-col items-center gap-4 bg-surface-card">
        <div className="h-12 w-12 rounded-full border-4 border-coral/30 border-t-coral animate-spin" />
        <p className="text-sm font-semibold text-navy font-display">Enviando mensaje...</p>
        <p className="text-[12px] text-navy-light/60 font-body">
          Enviando a {recipientCount.toLocaleString('es-CR')} personas
        </p>
      </div>
    </div>
  )
}
