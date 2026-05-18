'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { mockMembers } from '@/data/mock-members'
import { MOCK_TEMPLATES, MOCK_CHANNEL_CONFIGS, type CommunicationChannel } from '@/data/mock-communications'
import { MessagePreview } from '@/components/communications/MessagePreview'
import { VariableChips } from '@/components/communications/VariableChips'
import { RecipientSelector, type RecipientState, type RecipientMode } from '@/components/communications/RecipientSelector'
import { ChannelBadge } from '@/components/communications/ChannelBadge'
import { cn } from '@/lib/utils'
import {
  ChevronLeft,
  FileText,
  X,
  Send,
  Save,
  Check,
  Clock,
  MessageCircle,
  Mail,
  Layers,
  AlertTriangle,
} from 'lucide-react'

const SECTION_TITLE = 'text-[10px] uppercase tracking-widests text-navy-light/40'

function insertAtCursor(ref: React.RefObject<HTMLTextAreaElement | null>, value: string, setter: (v: string) => void) {
  const el = ref.current
  if (!el) { setter(value); return }
  const start = el.selectionStart ?? 0
  const end = el.selectionEnd ?? 0
  const text = el.value
  const newText = text.slice(0, start) + value + text.slice(end)
  setter(newText)
  setTimeout(() => {
    el.focus()
    el.setSelectionRange(start + value.length, start + value.length)
  }, 0)
}

export default function NuevaComunicacionPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const initialMode = (searchParams.get('mode') as RecipientMode) || 'filters'
  const initialMemberIds = searchParams.get('members')?.split(',').filter(Boolean) ?? []
  const initialEntity = searchParams.get('entity') as 'event' | 'study_group' | null
  const initialGroupId = searchParams.get('id') ?? ''

  const [recipients, setRecipients] = useState<RecipientState>({
    mode: initialMode,
    manualMemberIds: initialMemberIds,
    groupEntity: initialEntity,
    groupId: initialGroupId,
    label: initialMemberIds.length > 0
      ? `${initialMemberIds.length} persona${initialMemberIds.length !== 1 ? 's' : ''} seleccionada${initialMemberIds.length !== 1 ? 's' : ''}`
      : '',
    count: initialMemberIds.length,
  })

  const [channel, setChannel] = useState<CommunicationChannel>('whatsapp')
  const [subject, setSubject] = useState('')
  const [waBody, setWaBody] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [scheduled, setScheduled] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [previewChannel, setPreviewChannel] = useState<'whatsapp' | 'email'>('whatsapp')

  const waRef = useRef<HTMLTextAreaElement>(null)
  const emailRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (channel === 'whatsapp') setPreviewChannel('whatsapp')
    if (channel === 'email') setPreviewChannel('email')
    if (channel === 'both') setPreviewChannel('whatsapp')
  }, [channel])

  const body = previewChannel === 'whatsapp' ? waBody : emailBody
  const smtpConfig = MOCK_CHANNEL_CONFIGS.find(c => c.type === 'smtp' && c.is_active && c.is_verified)
  const waConfig = MOCK_CHANNEL_CONFIGS.find(c => c.type === 'whatsapp' && c.is_active && c.is_verified)

  const filteredTemplates = MOCK_TEMPLATES.filter(
    t => t.channel === channel || t.channel === 'both' || channel === 'both'
  )

  function applyTemplate(tplId: string) {
    const tpl = MOCK_TEMPLATES.find(t => t.id === tplId)
    if (!tpl) return
    if (tpl.channel !== 'email') setWaBody(tpl.body)
    if (tpl.channel !== 'whatsapp') { setSubject(tpl.subject); setEmailBody(tpl.body) }
    if (tpl.channel === 'both') { setWaBody(tpl.body); setEmailBody(tpl.body); setSubject(tpl.subject) }
    setShowTemplateModal(false)
  }

  function handleSend() {
    setSending(true)
    setTimeout(() => { setSending(false); setSent(true) }, 2200)
  }

  if (sent) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-5">
        <div className="h-16 w-16 rounded-full bg-teal-soft/30 flex items-center justify-center">
          <Check size={28} className="text-teal-deep" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-extrabold text-navy" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
            ¡Mensaje enviado!
          </h2>
          <p className="text-sm text-navy-light/60 mt-1" style={{ fontFamily: 'var(--font-body)' }}>
            Enviado a {recipients.count.toLocaleString('es-CR')} personas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/comunicaciones"
            className="rounded-full border px-5 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            Ver historial
          </Link>
          <button
            type="button"
            onClick={() => { setSent(false); setWaBody(''); setEmailBody(''); setSubject('') }}
            className="rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Nueva comunicación
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <Link
          href="/comunicaciones"
          className="inline-flex items-center gap-1.5 text-sm text-navy-light/50 hover:text-navy transition-colors mb-2"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          <ChevronLeft size={15} />
          Comunicaciones
        </Link>
        <h1 className="text-2xl text-navy" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}>
          Nueva comunicación
        </h1>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
        {/* Left: Editor */}
        <div className="space-y-5">

          {/* Section 1 — Destinatarios */}
          <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <p className={cn(SECTION_TITLE)} style={{ fontFamily: 'var(--font-display)' }}>
              1 · Destinatarios
            </p>
            <RecipientSelector value={recipients} onChange={setRecipients} />
          </div>

          {/* Section 2 — Canal */}
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
            {/* Config indicator */}
            <div className="space-y-1.5">
              {(channel === 'whatsapp' || channel === 'both') && (
                <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--surface-low)' }}>
                  <MessageCircle size={13} className="text-emerald-600 shrink-0" />
                  <p className="text-[12px] text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
                    {waConfig ? `${waConfig.name} · ${waConfig.wa_phone_number}` : <span className="text-coral">Sin configuración WhatsApp activa</span>}
                  </p>
                </div>
              )}
              {(channel === 'email' || channel === 'both') && (
                <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--surface-low)' }}>
                  <Mail size={13} className="text-blue-600 shrink-0" />
                  <p className="text-[12px] text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
                    {smtpConfig ? `${smtpConfig.name} · ${smtpConfig.smtp_from_email}` : <span className="text-coral">Sin configuración SMTP activa</span>}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Section 3 — Contenido */}
          <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center justify-between">
              <p className={cn(SECTION_TITLE)} style={{ fontFamily: 'var(--font-display)' }}>
                3 · Contenido
              </p>
              <button
                type="button"
                onClick={() => setShowTemplateModal(true)}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] text-navy-light hover:bg-surface-low transition-colors"
                style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
              >
                <FileText size={12} />
                Usar plantilla
              </button>
            </div>

            {/* Email subject */}
            {(channel === 'email' || channel === 'both') && (
              <div className="space-y-1.5">
                <p className="text-[11px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>Asunto del correo</p>
                <input
                  className="w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30"
                  style={{ fontFamily: 'var(--font-body)' }}
                  placeholder="Asunto del correo..."
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                />
              </div>
            )}

            {/* WhatsApp body */}
            {(channel === 'whatsapp' || channel === 'both') && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
                    Mensaje de WhatsApp <span className="text-navy-light/30">(soporta *negrita*, _itálica_, ~tachado~)</span>
                  </p>
                  <span className="text-[11px] text-navy-light/30 tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                    {waBody.length}/1000
                  </span>
                </div>
                <textarea
                  ref={waRef}
                  rows={6}
                  maxLength={1000}
                  className="w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 resize-none"
                  style={{ fontFamily: 'var(--font-body)' }}
                  placeholder="Hola {nombre} 👋&#10;&#10;Tu mensaje aquí..."
                  value={waBody}
                  onChange={e => setWaBody(e.target.value)}
                  onFocus={() => setPreviewChannel('whatsapp')}
                />
              </div>
            )}

            {/* Email body */}
            {(channel === 'email' || channel === 'both') && (
              <div className="space-y-1.5">
                <p className="text-[11px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
                  Cuerpo del correo
                </p>
                <textarea
                  ref={emailRef}
                  rows={6}
                  className="w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 resize-none"
                  style={{ fontFamily: 'var(--font-body)' }}
                  placeholder="Hola {nombre},&#10;&#10;Tu mensaje aquí..."
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  onFocus={() => setPreviewChannel('email')}
                />
              </div>
            )}

            {/* Variables */}
            <VariableChips
              onInsert={v => {
                if (previewChannel === 'whatsapp' || channel === 'whatsapp') {
                  insertAtCursor(waRef, v, setWaBody)
                } else {
                  insertAtCursor(emailRef, v, setEmailBody)
                }
              }}
            />
          </div>

          {/* Section 4 — Programar */}
          <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <p className={cn(SECTION_TITLE)} style={{ fontFamily: 'var(--font-display)' }}>
              4 · Programar (opcional)
            </p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>¿Programar envío?</p>
                <p className="text-[12px] text-navy-light/40 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
                  Elegí cuándo enviar el mensaje
                </p>
              </div>
              <button
                type="button"
                onClick={() => setScheduled(!scheduled)}
                className={cn(
                  'relative h-6 w-11 rounded-full transition-colors',
                  scheduled ? 'bg-coral' : 'bg-navy/20'
                )}
              >
                <span className={cn('absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', scheduled ? 'translate-x-5' : 'translate-x-0')} />
              </button>
            </div>
            {scheduled && (
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-navy-light/40 shrink-0" />
                <input
                  type="datetime-local"
                  className="flex-1 rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30"
                  value={scheduledAt}
                  onChange={e => setScheduledAt(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors"
              style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
            >
              <Save size={14} />
              Guardar borrador
            </button>
            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              disabled={recipients.count === 0 || (!waBody && !emailBody)}
              className="flex items-center gap-1.5 rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <Send size={14} />
              {scheduled ? 'Programar envío' : 'Enviar ahora'}
            </button>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="space-y-3 lg:sticky lg:top-4">
          <p className="text-[10px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
            Vista previa
          </p>
          <MessagePreview
            channel={channel}
            subject={subject}
            waBody={waBody || 'Tu mensaje aparecerá aquí...'}
            emailBody={emailBody || 'Tu mensaje aparecerá aquí...'}
          />
        </div>
      </div>

      {/* Template modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-ink/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--outline-variant)' }}>
              <p className="text-sm font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>Seleccionar plantilla</p>
              <button type="button" onClick={() => setShowTemplateModal(false)}><X size={18} className="text-navy-light/40" /></button>
            </div>
            <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
              {filteredTemplates.length === 0 ? (
                <p className="text-sm text-navy-light/40 py-4 text-center" style={{ fontFamily: 'var(--font-body)' }}>
                  No hay plantillas para este canal.
                </p>
              ) : (
                filteredTemplates.map(tpl => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => applyTemplate(tpl.id)}
                    className="w-full text-left rounded-xl border px-4 py-3 hover:bg-surface-low transition-colors space-y-1"
                    style={{ borderColor: 'var(--outline-variant)' }}
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-medium text-navy" style={{ fontFamily: 'var(--font-body)' }}>{tpl.name}</p>
                      <ChannelBadge channel={tpl.channel} size="sm" />
                    </div>
                    <p className="text-[12px] text-navy-light/50 line-clamp-1" style={{ fontFamily: 'var(--font-body)' }}>
                      {tpl.body.split('\n')[0]}
                    </p>
                    <p className="text-[11px] text-navy-light/30" style={{ fontFamily: 'var(--font-body)' }}>Usado {tpl.used_count} veces</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-ink/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <div className="px-6 py-5 border-b" style={{ borderColor: 'var(--outline-variant)' }}>
              <p className="text-base font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>¿Confirmar envío?</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[13px]" style={{ fontFamily: 'var(--font-body)' }}>
                  <span className="text-navy-light/50">Canal</span>
                  <ChannelBadge channel={channel} />
                </div>
                <div className="flex items-center justify-between text-[13px]" style={{ fontFamily: 'var(--font-body)' }}>
                  <span className="text-navy-light/50">Destinatarios</span>
                  <span className="font-semibold text-navy">~{recipients.count.toLocaleString('es-CR')} {recipients.count === 1 ? 'persona' : 'personas'}</span>
                </div>
                {recipients.label && (
                  <div className="flex items-start justify-between text-[13px] gap-4" style={{ fontFamily: 'var(--font-body)' }}>
                    <span className="text-navy-light/50 shrink-0">Segmento</span>
                    <span className="text-navy text-right">{recipients.label}</span>
                  </div>
                )}
              </div>

              {/* Preview snippet */}
              <div className="rounded-xl p-3 text-[12px] text-navy-light/70 leading-relaxed whitespace-pre-line" style={{ background: 'var(--surface-low)', fontFamily: 'var(--font-body)' }}>
                {(channel === 'whatsapp' ? waBody : emailBody).replace(/\{nombre\}/g, 'Juan').slice(0, 120)}
                {(channel === 'whatsapp' ? waBody : emailBody).length > 120 ? '...' : ''}
              </div>

              {recipients.count > 500 && (
                <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5">
                  <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                  <p className="text-[12px] text-amber-700" style={{ fontFamily: 'var(--font-body)' }}>
                    Envío masivo a más de {recipients.count.toLocaleString('es-CR')} personas.
                  </p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t flex items-center gap-3" style={{ borderColor: 'var(--outline-variant)' }}>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 rounded-full border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors"
                style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => { setShowConfirmModal(false); handleSend() }}
                className="flex-1 flex items-center justify-center gap-2 rounded-full bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <Send size={14} />
                {sending ? 'Enviando...' : `Enviar a ${recipients.count.toLocaleString('es-CR')} persona${recipients.count !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sending overlay */}
      {sending && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-navy-ink/60 backdrop-blur-sm">
          <div className="rounded-2xl px-8 py-8 flex flex-col items-center gap-4" style={{ background: 'var(--surface-card)' }}>
            <div className="h-12 w-12 rounded-full border-4 border-coral/30 border-t-coral animate-spin" />
            <p className="text-sm font-semibold text-navy" style={{ fontFamily: 'var(--font-display)' }}>Enviando mensaje...</p>
            <p className="text-[12px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
              Enviando a {recipients.count.toLocaleString('es-CR')} personas
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
