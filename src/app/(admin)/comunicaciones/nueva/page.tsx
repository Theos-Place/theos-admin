'use client'

import { useState, useRef, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { type CommunicationChannel } from '@/types/communication'
import { useCommunications } from '@/hooks/useCommunications'
import { MOCK_MEMBER_LISTS } from '@/data/mock-member-lists'
import { MessagePreview } from '@/components/communications/MessagePreview'
import { type RecipientState, type RecipientMode } from '@/components/communications/RecipientSelector'
import { ChevronLeft, Send, Save, Check } from 'lucide-react'

import { RecipientsSection } from './_components/RecipientsSection'
import { ChannelSection } from './_components/ChannelSection'
import { ContentSection } from './_components/ContentSection'
import { ScheduleSection } from './_components/ScheduleSection'
import { ListModal, TemplateModal, ConfirmModal, SendingOverlay } from './_components/Modals'

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

function NuevaComunicacionContent() {
  const searchParams = useSearchParams()
  const { templates: MOCK_TEMPLATES, messages: MOCK_MESSAGES, configs: MOCK_CHANNEL_CONFIGS } = useCommunications()

  const initialMode = (searchParams.get('mode') as RecipientMode) || 'filters'
  const initialMemberIds = useMemo(
    () => searchParams.get('members')?.split(',').filter(Boolean) ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  const reenviarId = searchParams.get('reenviar') ?? ''
  const reenviarMsg = useMemo(
    () => reenviarId ? MOCK_MESSAGES.find(m => m.id === reenviarId) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  const initialEntity = searchParams.get('entity') as 'event' | 'study_group' | null
  const initialGroupId = searchParams.get('id') ?? ''
  const initialSegmentLabel = useMemo(
    () => searchParams.get('segment_label') ? decodeURIComponent(searchParams.get('segment_label')!) : '',
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const [recipients, setRecipients] = useState<RecipientState>({
    mode: initialMode,
    manualMemberIds: initialMemberIds,
    groupEntity: initialEntity,
    groupId: initialGroupId,
    label: initialSegmentLabel || (initialMemberIds.length > 0
      ? `${initialMemberIds.length} persona${initialMemberIds.length !== 1 ? 's' : ''} seleccionada${initialMemberIds.length !== 1 ? 's' : ''}`
      : ''),
    count: initialMemberIds.length,
  })

  const [isImported, setIsImported] = useState(initialSegmentLabel !== '' && initialMemberIds.length > 0)
  const [showExpandedList, setShowExpandedList] = useState(false)

  const [channel, setChannel] = useState<CommunicationChannel>(reenviarMsg?.channel ?? 'whatsapp')
  const [subject, setSubject] = useState(reenviarMsg?.subject ?? '')
  const [waBody, setWaBody] = useState(reenviarMsg?.channel !== 'email' ? (reenviarMsg?.body ?? '') : '')
  const [emailBody, setEmailBody] = useState(reenviarMsg?.channel !== 'whatsapp' ? (reenviarMsg?.body ?? '') : '')
  const [scheduled, setScheduled] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [timezone, setTimezone] = useState('America/Costa_Rica')
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showListModal, setShowListModal] = useState(false)
  const [listSearch, setListSearch] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [previewChannel, setPreviewChannel] = useState<'whatsapp' | 'email'>(reenviarMsg?.channel === 'email' ? 'email' : 'whatsapp')

  const filteredLists = useMemo(() => {
    if (!listSearch.trim()) return MOCK_MEMBER_LISTS
    const q = listSearch.toLowerCase()
    return MOCK_MEMBER_LISTS.filter(l => l.name.toLowerCase().includes(q) || l.segment_label.toLowerCase().includes(q))
  }, [listSearch])

  function applyList(listId: string) {
    const list = MOCK_MEMBER_LISTS.find(l => l.id === listId)
    if (!list) return
    setRecipients({ mode: 'manual', manualMemberIds: list.member_ids, groupEntity: null, groupId: '', label: list.name, count: list.member_count })
    setIsImported(true)
    setShowListModal(false)
    setListSearch('')
  }

  const waRef = useRef<HTMLTextAreaElement>(null)
  const emailRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (channel === 'whatsapp') setPreviewChannel('whatsapp')
    if (channel === 'email') setPreviewChannel('email')
    if (channel === 'both') setPreviewChannel('whatsapp')
  }, [channel])

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

  async function handleSend() {
    setSending(true)
    try {
      const channels: ('whatsapp' | 'email')[] = channel === 'both' ? ['whatsapp', 'email'] : [channel]
      const recips = recipients.manualMemberIds.flatMap(id =>
        channels.map(ch => ({ member_id: id, channel: ch, recipient: '' })),
      )
      const createRes = await fetch('/api/communications/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          subject: (channel === 'email' || channel === 'both') ? (subject || null) : null,
          body: channel === 'email' ? emailBody : waBody,
          segment_label: recipients.label || null,
          total_recipients: recipients.count,
          smtp_config_id: (channel === 'email' || channel === 'both') ? (smtpConfig?.id ?? null) : null,
          whatsapp_config_id: (channel === 'whatsapp' || channel === 'both') ? (waConfig?.id ?? null) : null,
        }),
      })
      if (!createRes.ok) throw new Error()
      const { id } = await createRes.json()
      await fetch(`/api/communications/messages/${id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: recips }),
      })
      setSending(false)
      setSent(true)
    } catch {
      setSending(false)
    }
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

          <RecipientsSection
            recipients={recipients}
            setRecipients={setRecipients}
            isImported={isImported}
            setIsImported={setIsImported}
            showExpandedList={showExpandedList}
            setShowExpandedList={setShowExpandedList}
            initialSegmentLabel={initialSegmentLabel}
            initialMemberIds={initialMemberIds}
            reenviarMsg={reenviarMsg}
            onOpenListModal={() => setShowListModal(true)}
          />

          <ChannelSection
            channel={channel}
            setChannel={setChannel}
            waConfig={waConfig}
            smtpConfig={smtpConfig}
          />

          <ContentSection
            channel={channel}
            subject={subject}
            setSubject={setSubject}
            waBody={waBody}
            setWaBody={setWaBody}
            emailBody={emailBody}
            setEmailBody={setEmailBody}
            previewChannel={previewChannel}
            setPreviewChannel={setPreviewChannel}
            waRef={waRef}
            emailRef={emailRef}
            onInsertVariable={v => {
              if (previewChannel === 'whatsapp' || channel === 'whatsapp') {
                insertAtCursor(waRef, v, setWaBody)
              } else {
                insertAtCursor(emailRef, v, setEmailBody)
              }
            }}
            onOpenTemplateModal={() => setShowTemplateModal(true)}
          />

          <ScheduleSection
            scheduled={scheduled}
            setScheduled={setScheduled}
            scheduledAt={scheduledAt}
            setScheduledAt={setScheduledAt}
            timezone={timezone}
            setTimezone={setTimezone}
          />

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

      {showListModal && (
        <ListModal
          filteredLists={filteredLists}
          listSearch={listSearch}
          setListSearch={setListSearch}
          onApplyList={applyList}
          onClose={() => { setShowListModal(false); setListSearch('') }}
        />
      )}

      {showTemplateModal && (
        <TemplateModal
          filteredTemplates={filteredTemplates}
          onApplyTemplate={applyTemplate}
          onClose={() => setShowTemplateModal(false)}
        />
      )}

      {showConfirmModal && (
        <ConfirmModal
          channel={channel}
          recipients={recipients}
          waBody={waBody}
          emailBody={emailBody}
          sending={sending}
          onConfirm={() => { setShowConfirmModal(false); handleSend() }}
          onClose={() => setShowConfirmModal(false)}
        />
      )}

      {sending && (
        <SendingOverlay recipientCount={recipients.count} />
      )}
    </div>
  )
}

export default function NuevaComunicacionPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-sm text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>Cargando...</div>
      </div>
    }>
      <NuevaComunicacionContent />
    </Suspense>
  )
}
