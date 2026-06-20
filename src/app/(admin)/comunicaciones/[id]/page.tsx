'use client'

import { useMemo, useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { type CommunicationStatus } from '@/data/communication-utils'
import { useCommunications } from '@/hooks/useCommunications'
import { usePaginatedList } from '@/hooks/usePaginatedList'
import { LoadMoreFooter } from '@/components/shared/LoadMoreFooter'
import { ChannelBadge } from '@/components/communications/ChannelBadge'
import { DeliveryStats } from '@/components/communications/DeliveryStats'
import { cn } from '@/lib/utils'
import { ChevronLeft, RotateCcw, CheckCircle2, XCircle, Users, Send, Clock, Zap } from 'lucide-react'

type QueueStats = {
  total: number
  sent: number
  pending: number
  failed: number
  lastScheduledDate: string | null
  emailConfigured: boolean
  dailyLimit: number
  sentToday: number
}

type RecipientFilter = 'all' | 'sent' | 'failed'

const STATUS_STYLE: Record<CommunicationStatus, string> = {
  draft:   'bg-navy/10 text-navy-light/60',
  sending: 'bg-amber-50 text-amber-700',
  sent:    'bg-teal-soft/30 text-teal-deep',
  failed:  'bg-coral/10 text-coral',
  partial: 'bg-amber-50 text-amber-700',
}
const STATUS_LABEL: Record<CommunicationStatus, string> = {
  draft: 'Borrador', sending: 'Enviando', sent: 'Enviado', failed: 'Fallido', partial: 'Parcial',
}

type RecipientRow = {
  id: string
  name: string
  email: string | null
  phone: string | null
  status: 'sent' | 'failed'
  delivered_at: string | null
}

export default function ComunicacionDetallePage() {
  const { id } = useParams<{ id: string }>()
  const { messages } = useCommunications()
  const message = useMemo(() => messages.find(m => m.id === id), [messages, id])
  const [recipientFilter, setRecipientFilter] = useState<RecipientFilter>('all')
  const [retrying, setRetrying] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [queue, setQueue] = useState<QueueStats | null>(null)
  const [actionMsg, setActionMsg] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  // Destinatarios reales: paginados server-side (count exacto + filtro al servidor).
  const recipBuildUrl = (page: number) => {
    if (!id) return null
    const u = new URLSearchParams()
    if (recipientFilter !== 'all') u.set('status', recipientFilter)
    u.set('page', String(page))
    u.set('pageSize', '50')
    return `/api/communications/messages/${id}/recipients?${u.toString()}`
  }
  const {
    items: recipients, total: recipTotal, loading: recipLoading,
    hasMore, loadMore, reload: reloadRecipients,
  } = usePaginatedList<RecipientRow>(recipBuildUrl, { pageSize: 50, itemsKey: 'recipients' })

  // Estado de la cola de email (message_logs). Se recarga tras procesar.
  useEffect(() => {
    if (!id) return
    let alive = true
    fetch(`/api/communications/messages/${id}/process`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive) setQueue(d) })
      .catch(() => {})
    return () => { alive = false }
  }, [id, reloadKey])

  async function runQueueAction(retryFailed: boolean) {
    const setBusy = retryFailed ? setRetrying : setProcessing
    setBusy(true)
    setActionMsg('')
    try {
      const res = await fetch(`/api/communications/messages/${id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(retryFailed ? { retry_failed: true } : {}),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.error ?? 'No se pudo procesar la cola')
      setActionMsg(`Procesado: ${d.sent} enviados, ${d.failed} fallidos${d.retried ? `, ${d.retried} reencolados` : ''}`)
      setReloadKey(k => k + 1)
      reloadRecipients()
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : 'No se pudo procesar la cola')
    } finally {
      setBusy(false)
    }
  }

  if (!message) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <p className="text-sm text-navy-light/60 font-body">Mensaje no encontrado.</p>
      </div>
    )
  }

  // El filtro viaja al servidor; lo cargado ya viene filtrado.
  const filtered = recipients

  const queueFailed = queue?.failed ?? message.stats.failed
  const lastBatchLabel = queue?.lastScheduledDate
    ? new Date(queue.lastScheduledDate + 'T12:00:00').toLocaleDateString('es-CR', { day: 'numeric', month: 'long' })
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/comunicaciones"
            className="inline-flex items-center gap-1.5 text-sm text-navy-light/60 hover:text-navy transition-colors mb-2 font-body"
          >
            <ChevronLeft size={15} />
            Comunicaciones
          </Link>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">
              {message.subject || message.body.split('\n')[0].slice(0, 50)}
            </h1>
            <ChannelBadge channel={message.channel} />
            <span
              className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold font-display', STATUS_STYLE[message.status])}
            >
              {STATUS_LABEL[message.status]}
            </span>
          </div>
          <p className="text-sm text-navy-light/60 mt-1 font-body">
            {message.sent_at
              ? `Enviado el ${new Date(message.sent_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} por ${message.sent_by}`
              : `Creado el ${new Date(message.created_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' })} por ${message.sent_by}`
            }
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => window.location.href = `/comunicaciones/nueva?reenviar=${id}`}
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-all border-[var(--outline-variant)] font-body"
          >
            <Send size={13} />
            Reenviar este mensaje
          </button>
          {queueFailed > 0 && (
            <button
              type="button"
              onClick={() => runQueueAction(true)}
              disabled={retrying}
              className="inline-flex items-center gap-2 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-all disabled:opacity-60 font-body"
            >
              <RotateCcw size={14} className={retrying ? 'animate-spin' : ''} />
              {retrying ? 'Reintentando...' : `Reintentar ${queueFailed} fallidos`}
            </button>
          )}
        </div>
      </div>

      {/* Delivery stats */}
      <DeliveryStats message={message} />

      {/* Progreso de la cola de email (envíos distribuidos por el límite diario) */}
      {queue && queue.total > 0 && (queue.pending > 0 || queue.failed > 0) && (
        <div className="rounded-2xl p-5 space-y-4 bg-surface-card shadow-card">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[10px] uppercase tracking-widest text-navy-light/60 font-display">
              Progreso del envío
            </p>
            <div className="flex items-center gap-2">
              {queue.pending > 0 && (
                <button
                  type="button"
                  onClick={() => runQueueAction(false)}
                  disabled={processing || !queue.emailConfigured}
                  title={queue.emailConfigured ? undefined : 'El proveedor de email (SES) no está configurado'}
                  className="inline-flex items-center gap-1.5 rounded-full bg-navy px-3.5 py-1.5 text-[12px] text-white hover:bg-navy-ink transition-colors disabled:opacity-50 font-body"
                >
                  <Zap size={12} />
                  {processing ? 'Procesando…' : 'Procesar ahora'}
                </button>
              )}
            </div>
          </div>

          {/* Barra de progreso */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-sm font-semibold text-navy font-display">
                {queue.sent.toLocaleString('es-CR')} / {queue.total.toLocaleString('es-CR')} enviados
              </p>
              <p className="text-[12px] text-navy-light/60 font-body">
                Hoy: {queue.sentToday} / {queue.dailyLimit} del cupo diario
              </p>
            </div>
            <div className="h-2.5 rounded-full bg-surface-low overflow-hidden">
              <div
                className="h-full rounded-full bg-teal-deep transition-all"
                style={{ width: `${queue.total ? Math.round((queue.sent / queue.total) * 100) : 0}%` }}
              />
            </div>
          </div>

          {/* Desglose por estado */}
          <div className="flex items-center gap-4 flex-wrap text-[13px] font-body">
            <span className="inline-flex items-center gap-1.5 text-teal-deep">
              <CheckCircle2 size={13} /> {queue.sent.toLocaleString('es-CR')} enviados
            </span>
            {queue.pending > 0 && (
              <span className="inline-flex items-center gap-1.5 text-navy-light/70">
                <Clock size={13} /> {queue.pending.toLocaleString('es-CR')} en cola
              </span>
            )}
            <span className={cn('inline-flex items-center gap-1.5', queue.failed > 0 ? 'text-coral font-medium' : 'text-navy-light/60')}>
              <XCircle size={13} /> {queue.failed.toLocaleString('es-CR')} fallidos
            </span>
            {queue.pending > 0 && lastBatchLabel && (
              <span className="text-navy-light/60 ml-auto">
                Completado el {lastBatchLabel}
              </span>
            )}
          </div>

          {actionMsg && (
            <p className="text-[12px] text-navy-light/70 font-body">{actionMsg}</p>
          )}
        </div>
      )}

      {/* Message content */}
      <div className="rounded-2xl p-5 space-y-4 bg-surface-card shadow-[var(--shadow-md)]">
        <p className="text-[10px] uppercase tracking-widests text-navy-light/60 font-display">
          Contenido del mensaje
        </p>
        {message.subject && (
          <div>
            <p className="text-[11px] text-navy-light/60 mb-1 font-display">Asunto</p>
            <p className="text-sm font-semibold text-navy font-body">{message.subject}</p>
          </div>
        )}
        <div>
          {message.subject && <p className="text-[11px] text-navy-light/60 mb-1 font-display">Cuerpo</p>}
          <p className="text-sm text-navy leading-relaxed whitespace-pre-line font-body">
            {message.body}
          </p>
        </div>
        {/* Segment */}
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 bg-surface-low">
          <Users size={15} className="text-navy-light/60 shrink-0" />
          <div>
            <p className="text-[12px] font-medium text-navy font-body">{message.segment.label}</p>
            <p className="text-[11px] text-navy-light/60 font-body">
              {message.segment.total_recipients} destinatarios en el segmento
            </p>
          </div>
        </div>
      </div>

      {/* Recipients table */}
      <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
        <div className="px-5 py-4 border-b flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-[var(--outline-variant)]">
          <p className="text-[11px] uppercase tracking-widests text-navy-light/60 font-display">
            Destinatarios ({recipTotal})
          </p>
          <div className="flex gap-1">
            {(['all', 'sent', 'failed'] as RecipientFilter[]).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setRecipientFilter(f)}
                className={cn(
                  'rounded-full px-3 py-1 text-[11px] font-medium transition-all font-display',
                  recipientFilter === f ? 'bg-navy text-white' : 'text-navy-light/60 hover:text-navy'
                )}
              >
                {f === 'all' ? 'Todos' : f === 'sent' ? 'Exitosos' : 'Fallidos'}
              </button>
            ))}
          </div>
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['Miembro', 'Canal', 'Estado', 'Entrega'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] tracking-widests uppercase text-navy-light/60 font-display">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => (
                <tr key={r.id} className={cn('hover:bg-navy/5 transition-colors', idx % 2 === 1 ? 'bg-surface-low/40' : '')}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-full bg-navy flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-white">{r.name.split(' ').map(w => w[0]).slice(0, 2).join('')}</span>
                      </div>
                      <p className="text-[13px] text-navy font-body">{r.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ChannelBadge channel={message.channel === 'both' ? (idx % 2 === 0 ? 'whatsapp' : 'email') : message.channel} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    {r.status === 'sent' ? (
                      <span className="inline-flex items-center gap-1 text-[12px] text-teal-deep font-body">
                        <CheckCircle2 size={12} /> Enviado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[12px] text-coral font-body">
                        <XCircle size={12} /> Fallido
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-navy-light/60 font-body">
                    {r.delivered_at
                      ? new Date(r.delivered_at).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: tarjetas */}
        <ul className="md:hidden divide-y divide-[var(--outline-variant)]">
          {filtered.map((r, idx) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3">
              <div className="h-8 w-8 rounded-full bg-navy flex items-center justify-center shrink-0">
                <span className="text-[9px] font-bold text-white">{r.name.split(' ').map(w => w[0]).slice(0, 2).join('')}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-navy font-body">{r.name}</p>
                <p className="text-[11px] text-navy-light/60 font-body">
                  {r.delivered_at
                    ? new Date(r.delivered_at).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })
                    : '—'}
                </p>
              </div>
              {r.status === 'sent' ? (
                <span className="inline-flex items-center gap-1 text-[12px] text-teal-deep shrink-0 font-body">
                  <CheckCircle2 size={12} /> Enviado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[12px] text-coral shrink-0 font-body">
                  <XCircle size={12} /> Fallido
                </span>
              )}
            </li>
          ))}
        </ul>

        {filtered.length === 0 && (
          <p className="px-5 py-8 text-center text-[13px] text-navy-light/60 font-body">
            {recipLoading ? 'Cargando destinatarios…' : 'Sin destinatarios para este filtro.'}
          </p>
        )}

        {filtered.length > 0 && (
          <LoadMoreFooter
            shown={recipients.length}
            total={recipTotal}
            hasMore={hasMore}
            loading={recipLoading}
            onLoadMore={loadMore}
            noun="destinatarios"
            increment={50}
          />
        )}
      </div>
    </div>
  )
}
