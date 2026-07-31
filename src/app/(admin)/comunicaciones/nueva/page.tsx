'use client'

import { useState, useRef, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { type CommunicationChannel } from '@/types/communication'
import { useCommunications } from '@/hooks/useCommunications'
import type { MemberList } from '@/types/member-list'
import { MessagePreview } from '@/components/communications/MessagePreview'
import { type RecipientState, type RecipientMode } from '@/components/communications/RecipientSelector'
import {
  inferEmailKind, emailKindNotice, NOTICE_OVERRIDE_LABEL, NOTICE_OVERRIDE_HINT, type EmailKind,
} from '@/lib/communications/email-kind'
import { ChevronLeft, Send, Save, Check } from 'lucide-react'
import { useToast } from '@/components/shared/Toast'

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
  const toast = useToast()
  const router = useRouter()
  const [savingDraft, setSavingDraft] = useState(false)
  const { templates, messages, configs } = useCommunications('templates', 'messages', 'configs')

  const initialMode = (searchParams.get('mode') as RecipientMode) || 'filters'
  const initialMemberIds = useMemo(
    () => searchParams.get('members')?.split(',').filter(Boolean) ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  const reenviarId = searchParams.get('reenviar') ?? ''
  const reenviarMsg = useMemo(
    () => reenviarId ? messages.find(m => m.id === reenviarId) : null,
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

  // Canal por defecto: alerta interna (decisión 2026-06-11). Email ya envía por SES.
  const [channel, setChannel] = useState<CommunicationChannel>(reenviarMsg?.channel ?? 'interna')
  // Tipo de correo: NO se elige, se infiere de la plantilla (decisión
  // 2026-07-31, ver src/lib/communications/email-kind.ts). Queda la casilla
  // "es un aviso necesario" como única escapatoria.
  const [emailKind, setEmailKind] = useState<EmailKind>('marketing')
  const [subject, setSubject] = useState(reenviarMsg?.subject ?? '')
  const [waBody, setWaBody] = useState(reenviarMsg?.channel !== 'email' ? (reenviarMsg?.body ?? '') : '')
  const [emailBody, setEmailBody] = useState(reenviarMsg?.channel !== 'whatsapp' ? (reenviarMsg?.body ?? '') : '')
  // El cuerpo de correo se edita con el editor enriquecido (EmailEditor) → siempre HTML.
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
  const [memberLists, setMemberLists] = useState<MemberList[]>([])

  useEffect(() => {
    let alive = true
    fetch('/api/member-lists').then(r => (r.ok ? r.json() : [])).then(d => { if (alive) setMemberLists(Array.isArray(d) ? d : []) }).catch(() => {})
    return () => { alive = false }
  }, [])

  const filteredLists = useMemo(() => {
    if (!listSearch.trim()) return memberLists
    const q = listSearch.toLowerCase()
    return memberLists.filter(l => l.name.toLowerCase().includes(q) || l.segment_label.toLowerCase().includes(q))
  }, [listSearch, memberLists])

  function applyList(listId: string) {
    const list = memberLists.find(l => l.id === listId)
    if (!list) return
    setRecipients({ mode: 'manual', manualMemberIds: list.member_ids, groupEntity: null, groupId: '', label: list.name, count: list.member_count })
    setIsImported(true)
    setShowListModal(false)
    setListSearch('')
  }

  const waRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (channel === 'whatsapp') setPreviewChannel('whatsapp')
    if (channel === 'email') setPreviewChannel('email')
    if (channel === 'both') setPreviewChannel('whatsapp')
  }, [channel])

  // Email: el envío usa SES por env (no channel_configs). WhatsApp pendiente.
  const waConfig = configs.find(c => c.type === 'whatsapp' && c.is_active && c.is_verified)

  const filteredTemplates = templates.filter(
    t => t.channel === channel || t.channel === 'both' || channel === 'both'
  )

  function applyTemplate(tplId: string) {
    const tpl = templates.find(t => t.id === tplId)
    if (!tpl) return
    if (tpl.channel !== 'email') setWaBody(tpl.body)
    if (tpl.channel !== 'whatsapp') { setSubject(tpl.subject); setEmailBody(tpl.body) }
    if (tpl.channel === 'both') { setWaBody(tpl.body); setEmailBody(tpl.body); setSubject(tpl.subject) }
    // Plantilla transaccional → el tipo de correo arranca en Transaccional.
    setEmailKind(inferEmailKind(tpl))
    setShowTemplateModal(false)
  }

  // "Usar plantilla" desde el listado llega como ?template=ID: precargar esa
  // plantilla (canal + asunto + cuerpo) una sola vez, cuando ya cargaron.
  const [tplApplied, setTplApplied] = useState(false)
  useEffect(() => {
    const tid = searchParams.get('template')
    if (tplApplied || !tid || templates.length === 0) return
    const tpl = templates.find(t => t.id === tid)
    if (!tpl) return
    setChannel(tpl.channel)
    if (tpl.channel !== 'whatsapp') { setSubject(tpl.subject); setEmailBody(tpl.body) }
    if (tpl.channel !== 'email') setWaBody(tpl.body)
    setEmailKind(inferEmailKind(tpl))
    setTplApplied(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tplApplied, templates])

  // Guarda como borrador (sin enviar): crea el broadcast en estado 'draft'.
  async function saveDraft() {
    if (savingDraft) return
    if (!subject.trim() && !emailBody.trim() && !waBody.trim()) {
      toast('Escribí un asunto o un mensaje antes de guardar', 'error')
      return
    }
    setSavingDraft(true)
    try {
      const res = await fetch('/api/communications/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          kind: channel === 'email' ? emailKind : 'transactional',
          subject: channel !== 'whatsapp' ? (subject || null) : null,
          body: channel === 'email' ? emailBody : waBody,
          body_format: 'html',
          segment_label: recipients.label || null,
          total_recipients: recipients.count,
          smtp_config_id: null,
          whatsapp_config_id: null,
        }),
      })
      if (!res.ok) throw new Error()
      toast('Borrador guardado', 'success')
      router.push('/comunicaciones')
    } catch {
      toast('No se pudo guardar el borrador', 'error')
    } finally {
      setSavingDraft(false)
    }
  }

  async function handleSend() {
    setSending(true)
    try {
      const channels: ('whatsapp' | 'email' | 'interna')[] = channel === 'both' ? ['whatsapp', 'email'] : [channel]
      const recips = recipients.manualMemberIds.flatMap(id =>
        channels.map(ch => ({ member_id: id, channel: ch, recipient: '' })),
      )
      const createRes = await fetch('/api/communications/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          kind: (channel === 'email' || channel === 'both') ? emailKind : 'transactional',
          subject: (channel === 'email' || channel === 'both' || channel === 'interna') ? (subject || null) : null,
          body: channel === 'email' ? emailBody : waBody,
          body_format: 'html',
          segment_label: recipients.label || null,
          total_recipients: recipients.count,
          smtp_config_id: null,
          whatsapp_config_id: (channel === 'whatsapp' || channel === 'both') ? (waConfig?.id ?? null) : null,
        }),
      })
      if (!createRes.ok) throw new Error()
      const { id } = await createRes.json()
      const sendRes = await fetch(`/api/communications/messages/${id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: recips }),
      })
      if (!sendRes.ok) {
        const data = await sendRes.json().catch(() => null)
        throw new Error(data?.error)
      }
      setSending(false)
      setSent(true)
      // Refresca la campana (si el envío incluye notificación interna a quien envía).
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('notifications:changed'))
    } catch (e) {
      setSending(false)
      toast(e instanceof Error && e.message ? e.message : 'No se pudo enviar la comunicación', 'error')
    }
  }

  if (sent) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-5">
        <div className="h-16 w-16 rounded-full bg-teal-soft/30 flex items-center justify-center">
          <Check size={28} className="text-teal-deep" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-extrabold text-navy font-display tracking-[-0.02em]">
            ¡Mensaje enviado!
          </h2>
          <p className="text-sm text-navy-light/60 mt-1 font-body">
            Enviado a {recipients.count.toLocaleString('es-CR')} personas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/comunicaciones"
            className="rounded-full border px-5 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
          >
            Ver historial
          </Link>
          <button
            type="button"
            onClick={() => { setSent(false); setWaBody(''); setEmailBody(''); setSubject('') }}
            className="rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body"
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
          className="inline-flex items-center gap-1.5 text-sm text-navy-light/60 hover:text-navy transition-colors mb-2 font-body"
        >
          <ChevronLeft size={15} />
          Comunicaciones
        </Link>
        <h1 className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">
          Nueva comunicación
        </h1>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_620px] gap-6 items-start">
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
            onInsertVariable={v => insertAtCursor(waRef, v, setWaBody)}
            onOpenTemplateModal={() => setShowTemplateModal(true)}
          />

          {(channel === 'email' || channel === 'both') && (
            <div className="rounded-2xl bg-surface-card p-4 sm:p-5 shadow-[var(--shadow-md)] space-y-3">
              <p className="text-[13px] text-navy-light/70 font-body leading-relaxed">
                {emailKindNotice(emailKind)}
              </p>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailKind === 'transactional'}
                  onChange={e => setEmailKind(e.target.checked ? 'transactional' : 'marketing')}
                  className="mt-0.5 h-4 w-4 accent-coral"
                />
                <span>
                  <span className="block text-sm text-navy font-body">{NOTICE_OVERRIDE_LABEL}</span>
                  <span className="block text-[11px] text-navy-light/70 font-body mt-0.5">{NOTICE_OVERRIDE_HINT}</span>
                </span>
              </label>
            </div>
          )}

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
              onClick={saveDraft}
              disabled={savingDraft}
              className="flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors disabled:opacity-40 border-[var(--outline-variant)] font-body"
            >
              <Save size={14} />
              {savingDraft ? 'Guardando…' : 'Guardar borrador'}
            </button>
            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              disabled={recipients.count === 0 || (!waBody && !emailBody)}
              className="flex items-center gap-1.5 rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-all disabled:opacity-40 disabled:cursor-not-allowed font-body"
            >
              <Send size={14} />
              {scheduled ? 'Programar envío' : 'Enviar ahora'}
            </button>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="space-y-3 xl:sticky xl:top-4">
          <p className="text-[10px] uppercase tracking-widest text-navy-light/60 font-display">
            Vista previa
          </p>
          <MessagePreview
            channel={channel}
            subject={subject}
            waBody={waBody || 'Tu mensaje aparecerá aquí...'}
            emailBody={emailBody || 'Tu mensaje aparecerá aquí...'}
            marketing={emailKind === 'marketing'}
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
        <div className="text-sm text-navy-light/60 font-body">Cargando...</div>
      </div>
    }>
      <NuevaComunicacionContent />
    </Suspense>
  )
}
