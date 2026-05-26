'use client'

import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { MOCK_MESSAGES, type CommunicationStatus } from '@/data/mock-communications'
import { mockMembers } from '@/data/mock-members'
import { ChannelBadge } from '@/components/communications/ChannelBadge'
import { DeliveryStats } from '@/components/communications/DeliveryStats'
import { cn } from '@/lib/utils'
import { MOCK_SAVE_DELAY_MS } from '@/lib/constants'
import { ChevronLeft, RotateCcw, CheckCircle2, XCircle, Users, RefreshCw, Send } from 'lucide-react'

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

// Simulated recipient list from real member data
function buildRecipients(total: number, failed: number) {
  const pool = [...mockMembers].sort(() => Math.random() - 0.5).slice(0, Math.min(total, mockMembers.length))
  return pool.map((m, i) => ({
    id: m.id,
    name: `${m.first_name} ${m.last_name}`,
    email: m.email,
    phone: m.phone,
    status: i < failed ? 'failed' : 'sent' as 'sent' | 'failed',
    delivered_at: i < failed ? null : new Date(Date.now() - Math.random() * 3600000).toISOString(),
  }))
}

export default function ComunicacionDetallePage() {
  const { id } = useParams<{ id: string }>()
  const message = useMemo(() => MOCK_MESSAGES.find(m => m.id === id), [id])
  const [recipientFilter, setRecipientFilter] = useState<RecipientFilter>('all')
  const [retrying, setRetrying] = useState(false)

  const recipients = useMemo(
    () => message ? buildRecipients(Math.min(message.stats.total, 20), Math.min(message.stats.failed, 5)) : [],
    [message]
  )

  if (!message) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <p className="text-sm text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>Mensaje no encontrado.</p>
      </div>
    )
  }

  const filtered = recipients.filter(r => {
    if (recipientFilter === 'sent') return r.status === 'sent'
    if (recipientFilter === 'failed') return r.status === 'failed'
    return true
  })

  function handleRetry() {
    setRetrying(true)
    setTimeout(() => setRetrying(false), MOCK_SAVE_DELAY_MS)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/comunicaciones"
            className="inline-flex items-center gap-1.5 text-sm text-navy-light/50 hover:text-navy transition-colors mb-2"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <ChevronLeft size={15} />
            Comunicaciones
          </Link>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl text-navy" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}>
              {message.subject || message.body.split('\n')[0].slice(0, 50)}
            </h1>
            <ChannelBadge channel={message.channel} />
            <span
              className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', STATUS_STYLE[message.status])}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {STATUS_LABEL[message.status]}
            </span>
          </div>
          <p className="text-sm text-navy-light/50 mt-1" style={{ fontFamily: 'var(--font-body)' }}>
            {message.sent_at
              ? `Enviado el ${new Date(message.sent_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} por ${message.sent_by}`
              : `Creado el ${new Date(message.created_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' })} por ${message.sent_by}`
            }
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => window.location.href = `/comunicaciones/nueva?reenviar=${id}`}
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-all"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            <Send size={13} />
            Reenviar este mensaje
          </button>
          {message.stats.failed > 0 && (
            <button
              type="button"
              onClick={handleRetry}
              disabled={retrying}
              className="inline-flex items-center gap-2 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-all disabled:opacity-60"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <RotateCcw size={14} className={retrying ? 'animate-spin' : ''} />
              {retrying ? 'Reintentando...' : `Reintentar ${message.stats.failed} fallidos`}
            </button>
          )}
        </div>
      </div>

      {/* Delivery stats */}
      <DeliveryStats message={message} />

      {/* Message content */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <p className="text-[10px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
          Contenido del mensaje
        </p>
        {message.subject && (
          <div>
            <p className="text-[11px] text-navy-light/40 mb-1" style={{ fontFamily: 'var(--font-display)' }}>Asunto</p>
            <p className="text-sm font-semibold text-navy" style={{ fontFamily: 'var(--font-body)' }}>{message.subject}</p>
          </div>
        )}
        <div>
          {message.subject && <p className="text-[11px] text-navy-light/40 mb-1" style={{ fontFamily: 'var(--font-display)' }}>Cuerpo</p>}
          <p className="text-sm text-navy leading-relaxed whitespace-pre-line" style={{ fontFamily: 'var(--font-body)' }}>
            {message.body}
          </p>
        </div>
        {/* Segment */}
        <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: 'var(--surface-low)' }}>
          <Users size={15} className="text-navy-light/40 shrink-0" />
          <div>
            <p className="text-[12px] font-medium text-navy" style={{ fontFamily: 'var(--font-body)' }}>{message.segment.label}</p>
            <p className="text-[11px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
              {message.segment.total_recipients} destinatarios en el segmento
            </p>
          </div>
        </div>
      </div>

      {/* Recipients table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <div className="px-5 py-4 border-b flex items-center justify-between gap-4" style={{ borderColor: 'var(--outline-variant)' }}>
          <p className="text-[11px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
            Destinatarios (muestra de {recipients.length})
          </p>
          <div className="flex gap-1">
            {(['all', 'sent', 'failed'] as RecipientFilter[]).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setRecipientFilter(f)}
                className={cn(
                  'rounded-full px-3 py-1 text-[11px] font-medium transition-all',
                  recipientFilter === f ? 'bg-navy text-white' : 'text-navy-light/50 hover:text-navy'
                )}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {f === 'all' ? 'Todos' : f === 'sent' ? 'Exitosos' : 'Fallidos'}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['Miembro', 'Canal', 'Estado', 'Entrega'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
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
                      <p className="text-[13px] text-navy" style={{ fontFamily: 'var(--font-body)' }}>{r.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ChannelBadge channel={message.channel === 'both' ? (idx % 2 === 0 ? 'whatsapp' : 'email') : message.channel} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    {r.status === 'sent' ? (
                      <span className="inline-flex items-center gap-1 text-[12px] text-teal-deep" style={{ fontFamily: 'var(--font-body)' }}>
                        <CheckCircle2 size={12} /> Enviado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[12px] text-coral" style={{ fontFamily: 'var(--font-body)' }}>
                        <XCircle size={12} /> Fallido
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
                    {r.delivered_at
                      ? new Date(r.delivered_at).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {message.stats.total > recipients.length && (
          <div className="px-5 py-3 border-t flex items-center justify-center gap-2" style={{ borderColor: 'var(--outline-variant)' }}>
            <RefreshCw size={13} className="text-navy-light/40" />
            <p className="text-[12px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
              Mostrando {recipients.length} de {message.stats.total} destinatarios
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
