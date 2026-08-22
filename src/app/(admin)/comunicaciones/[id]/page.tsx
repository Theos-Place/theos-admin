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
import { generateCSV } from '@/lib/export'
import { ChevronLeft, RotateCcw, CheckCircle2, XCircle, Users, Send, Clock, Zap, MinusCircle, Download } from 'lucide-react'
import { skipReasonLabel, skipReasonAction } from '@/lib/communications/skip-reasons'

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

type RecipientFilter = 'all' | 'sent' | 'failed' | 'skipped'

const STATUS_STYLE: Record<CommunicationStatus, string> = {
  draft:     'bg-navy/10 text-navy-light/80',
  scheduled: 'bg-teal-soft/20 text-teal-deep',
  sending:   'bg-amber-50 text-amber-700',
  sent:    'bg-teal-soft/30 text-teal-deep',
  failed:  'bg-coral/10 text-coral',
  partial: 'bg-amber-50 text-amber-700',
}
const STATUS_LABEL: Record<CommunicationStatus, string> = {
  draft: 'Borrador', scheduled: 'Programado', sending: 'Enviando',
  sent: 'Enviado', failed: 'Fallido', partial: 'Parcial',
}

type RecipientRow = {
  id: string
  name: string
  email: string | null
  phone: string | null
  channel: 'whatsapp' | 'email'
  status: 'sent' | 'failed' | 'skipped'
  delivered_at: string | null
  /** En 'skipped' es el código del motivo; en 'failed', el texto del error. */
  reason: string | null
}

/** Estado de un destinatario. 'skipped' no es un fallo: a esa persona nunca se
 *  le intentó enviar, y mostrarla como "Fallido" haría pensar que el sistema falló. */
function RecipientStatus({ status }: { status: RecipientRow['status'] }) {
  if (status === 'sent') {
    return (
      <span className="inline-flex items-center gap-1 text-[13px] text-teal-deep font-body">
        <CheckCircle2 size={12} /> Enviado
      </span>
    )
  }
  if (status === 'skipped') {
    return (
      <span className="inline-flex items-center gap-1 text-[13px] text-navy-light/80 font-body">
        <MinusCircle size={12} /> No se envió
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[13px] text-coral font-body">
      <XCircle size={12} /> Fallido
    </span>
  )
}

/** Motivo legible. En los saltados traduce el código; en los fallidos muestra el
 *  error real, que antes se guardaba y nunca se veía. */
function reasonText(r: RecipientRow): string {
  if (r.status === 'sent') return ''
  return r.status === 'skipped' ? skipReasonLabel(r.reason) : (r.reason?.trim() || 'Error no registrado')
}

export default function ComunicacionDetallePage() {
  const { id } = useParams<{ id: string }>()
  const { messages } = useCommunications('messages')
  const message = useMemo(() => messages.find(m => m.id === id), [messages, id])
  const [recipientFilter, setRecipientFilter] = useState<RecipientFilter>('all')
  const [retrying, setRetrying] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [queue, setQueue] = useState<QueueStats | null>(null)
  const [actionMsg, setActionMsg] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState('')

  // Exportar: trae TODAS las páginas, no solo las 50 que están en pantalla. Sin
  // esto el CSV saldría recortado justo cuando más se necesita (una lista de 400).
  async function handleExport() {
    if (!id || exporting) return
    setExporting(true)
    try {
      const rows: RecipientRow[] = []
      for (let page = 1; ; page++) {
        const u = new URLSearchParams({ page: String(page), pageSize: '200' })
        if (recipientFilter !== 'all') u.set('status', recipientFilter)
        const res = await fetch(`/api/communications/messages/${id}/recipients?${u}`)
        if (!res.ok) throw new Error()
        const d = await res.json()
        const batch: RecipientRow[] = d.recipients ?? []
        rows.push(...batch)
        if (batch.length < 200 || rows.length >= (d.total ?? rows.length)) break
      }
      generateCSV(
        ['Nombre', 'Correo', 'Teléfono', 'Canal', 'Estado', 'Hora de entrega', 'Motivo', 'Qué hacer'],
        rows.map(r => [
          r.name,
          r.email ?? '',
          r.phone ?? '',
          r.channel,
          r.status === 'sent' ? 'Enviado' : r.status === 'skipped' ? 'No se envió' : 'Fallido',
          r.delivered_at ? new Date(r.delivered_at).toLocaleString('es-CR') : '',
          reasonText(r),
          skipReasonAction(r.reason) ?? '',
        ]),
        'destinatarios-comunicado',
      )
      setExportMsg(`Exportados ${rows.length} destinatarios.`)
    } catch {
      setExportMsg('No se pudo exportar. Intentá de nuevo.')
    } finally {
      setExporting(false)
    }
  }

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
        <p className="text-sm text-navy-light/80 font-body">Mensaje no encontrado.</p>
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
            className="inline-flex items-center gap-1.5 text-sm text-navy-light/80 hover:text-navy transition-colors mb-2 font-body"
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
              className={cn('rounded-full px-2.5 py-0.5 text-[13px] font-semibold font-display', STATUS_STYLE[message.status])}
            >
              {STATUS_LABEL[message.status]}
            </span>
          </div>
          <p className="text-sm text-navy-light/80 mt-1 font-body">
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
            <p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display">
              Progreso del envío
            </p>
            <div className="flex items-center gap-2">
              {queue.pending > 0 && (
                <button
                  type="button"
                  onClick={() => runQueueAction(false)}
                  disabled={processing || !queue.emailConfigured}
                  title={queue.emailConfigured ? undefined : 'El proveedor de email (SES) no está configurado'}
                  className="inline-flex items-center gap-1.5 rounded-full bg-navy px-3.5 py-1.5 text-[13px] text-white hover:bg-navy-ink transition-colors disabled:opacity-50 font-body"
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
              <p className="text-[13px] text-navy-light/80 font-body">
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
              <span className="inline-flex items-center gap-1.5 text-navy-light/80">
                <Clock size={13} /> {queue.pending.toLocaleString('es-CR')} en cola
              </span>
            )}
            <span className={cn('inline-flex items-center gap-1.5', queue.failed > 0 ? 'text-coral font-medium' : 'text-navy-light/80')}>
              <XCircle size={13} /> {queue.failed.toLocaleString('es-CR')} fallidos
            </span>
            {message.stats.skipped > 0 && (
              <span className="inline-flex items-center gap-1.5 text-navy-light/80" title="Excluidos por baja de newsletter, rebote o queja">
                {message.stats.skipped.toLocaleString('es-CR')} saltados
              </span>
            )}
            {queue.pending > 0 && lastBatchLabel && (
              <span className="text-navy-light/80 ml-auto">
                Completado el {lastBatchLabel}
              </span>
            )}
          </div>

          {actionMsg && (
            <p className="text-[13px] text-navy-light/80 font-body">{actionMsg}</p>
          )}
        </div>
      )}

      {/* Message content */}
      <div className="rounded-2xl p-5 space-y-4 bg-surface-card shadow-[var(--shadow-md)]">
        <p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display">
          Contenido del mensaje
        </p>
        {message.subject && (
          <div>
            <p className="text-[13px] text-navy-light/80 mb-1 font-display">Asunto</p>
            <p className="text-sm font-semibold text-navy font-body">{message.subject}</p>
          </div>
        )}
        <div>
          {message.subject && <p className="text-[13px] text-navy-light/80 mb-1 font-display">Cuerpo</p>}
          <p className="text-sm text-navy leading-relaxed whitespace-pre-line font-body">
            {message.body}
          </p>
        </div>
        {/* Segment */}
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 bg-surface-low">
          <Users size={15} className="text-navy-light/80 shrink-0" />
          <div>
            <p className="text-[13px] font-medium text-navy font-body">{message.segment.label}</p>
            <p className="text-[13px] text-navy-light/80 font-body">
              {message.segment.total_recipients} destinatarios en el segmento
            </p>
          </div>
        </div>
      </div>

      {/* Recipients table */}
      <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
        <div className="px-5 py-4 border-b flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-[var(--outline-variant)]">
          <div>
            <p className="text-[13px] uppercase tracking-widest text-navy-light/80 font-display">
              Destinatarios ({recipTotal})
            </p>
            {exportMsg && (
              <p className="mt-1 text-[13px] text-navy-light/80 font-body" role="status">{exportMsg}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || recipTotal === 0}
              className="mr-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--outline-variant)] px-3 py-1 text-[13px] font-medium text-navy-light/80 transition-all hover:text-navy disabled:opacity-50 font-display"
            >
              <Download size={12} /> {exporting ? 'Exportando…' : 'Exportar'}
            </button>
            {(['all', 'sent', 'failed', 'skipped'] as RecipientFilter[]).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setRecipientFilter(f)}
                className={cn(
                  'rounded-full px-3 py-1 text-[13px] font-medium transition-all font-display',
                  recipientFilter === f ? 'bg-navy text-white' : 'text-navy-light/80 hover:text-navy'
                )}
              >
                {f === 'all' ? 'Todos' : f === 'sent' ? 'Exitosos' : f === 'failed' ? 'Fallidos' : 'Saltados'}
              </button>
            ))}
          </div>
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['Miembro', 'Canal', 'Estado', 'Entrega', 'Motivo'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
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
                        <span className="text-[11px] font-bold text-white">{r.name.split(' ').map(w => w[0]).slice(0, 2).join('')}</span>
                      </div>
                      <p className="text-[13px] text-navy font-body">{r.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ChannelBadge channel={message.channel === 'both' ? (idx % 2 === 0 ? 'whatsapp' : 'email') : message.channel} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <RecipientStatus status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-[13px] text-navy-light/80 font-body">
                    {r.delivered_at
                      ? new Date(r.delivered_at).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-navy-light/80 font-body">
                    {r.status === 'sent' ? (
                      <span className="text-navy-light/40">—</span>
                    ) : (
                      <>
                        {reasonText(r)}
                        {skipReasonAction(r.reason) && (
                          <span className="block text-[13px] text-navy-light/80">{skipReasonAction(r.reason)}</span>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: tarjetas */}
        <ul className="md:hidden divide-y divide-[var(--outline-variant)]">
          {filtered.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3">
              <div className="h-8 w-8 rounded-full bg-navy flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-white">{r.name.split(' ').map(w => w[0]).slice(0, 2).join('')}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-navy font-body">{r.name}</p>
                <p className="text-[13px] text-navy-light/80 font-body">
                  {r.status === 'sent'
                    ? (r.delivered_at
                        ? new Date(r.delivered_at).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })
                        : '—')
                    : reasonText(r)}
                </p>
              </div>
              <span className="shrink-0">
                <RecipientStatus status={r.status} />
              </span>
            </li>
          ))}
        </ul>

        {filtered.length === 0 && (
          <p className="px-5 py-8 text-center text-[13px] text-navy-light/80 font-body">
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
