'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { getDeliveryRate, type CommunicationChannel, type CommunicationStatus } from '@/data/mock-communications'
import { useCommunications } from '@/hooks/useCommunications'
import { useClientPagination } from '@/hooks/useClientPagination'
import { LoadMoreFooter } from '@/components/shared/LoadMoreFooter'
import { ChannelBadge } from '@/components/communications/ChannelBadge'
import { cn } from '@/lib/utils'
import {
  Plus,
  CheckCircle2,
  AlertTriangle,
  Users,
  TrendingUp,
  ChevronRight,
  FileEdit,
  Calendar,
  MessageSquare,
} from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'

type MainTab = 'historial' | 'borradores'
type ChannelFilter = 'all' | CommunicationChannel
type StatusFilter = 'all' | CommunicationStatus

function thisMonth(dateStr: string | null) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
}

const LAST_7_DAYS = Array.from({ length: 7 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() - (6 - i))
  return d
})

export default function ComunicacionesPage() {
  const [tab, setTab] = useState<MainTab>('historial')
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { messages: MOCK_MESSAGES } = useCommunications()
  const sent = useMemo(() => MOCK_MESSAGES.filter(m => m.status !== 'draft'), [MOCK_MESSAGES])
  const drafts = useMemo(() => MOCK_MESSAGES.filter(m => m.status === 'draft'), [MOCK_MESSAGES])

  const stats = useMemo(() => {
    const sentThisMonth = sent.filter(m => thisMonth(m.sent_at))
    const totalRecipients = sentThisMonth.reduce((sum, m) => sum + m.stats.total, 0)
    const totalDelivered = sentThisMonth.reduce((sum, m) => sum + m.stats.delivered, 0)
    const avgRate = totalRecipients > 0 ? Math.round((totalDelivered / totalRecipients) * 100) : 0
    const withErrors = sent.filter(m => m.stats.failed > 0).length
    return { sentThisMonth: sentThisMonth.length, totalRecipients, avgRate, withErrors }
  }, [sent])

  const activityData = useMemo(() => {
    return LAST_7_DAYS.map(day => ({
      label: day.toLocaleDateString('es-CR', { weekday: 'short' }),
      count: sent.filter(m => {
        if (!m.sent_at) return false
        const d = new Date(m.sent_at)
        return d.getDate() === day.getDate() && d.getMonth() === day.getMonth()
      }).length,
    }))
  }, [sent])

  const maxActivity = Math.max(...activityData.map(d => d.count), 1)

  const filtered = useMemo(() => {
    return sent.filter(m => {
      if (channelFilter !== 'all' && m.channel !== channelFilter) return false
      if (statusFilter !== 'all' && m.status !== statusFilter) return false
      if (dateFrom && m.sent_at && m.sent_at < dateFrom) return false
      if (dateTo && m.sent_at && m.sent_at > dateTo + 'T23:59:59') return false
      return true
    }).sort((a, b) => (b.sent_at ?? b.created_at).localeCompare(a.sent_at ?? a.created_at))
  }, [sent, channelFilter, statusFilter, dateFrom, dateTo])

  const histPage = useClientPagination(filtered, 15)

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className="rounded-2xl bg-navy px-6 py-5 flex items-start justify-between gap-4 shadow-[var(--shadow-md)]"
      >
        <div>
          <h1
            className="text-2xl text-white font-display font-extrabold tracking-[-0.02em]"
          >
            Comunicaciones
          </h1>
          <p className="mt-1 text-sm text-white/70 font-body">
            Mensajería masiva por WhatsApp y correo
          </p>
        </div>
        <Link
          href="/comunicaciones/nueva"
          className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-all shrink-0 font-body"
        >
          <Plus size={14} />
          Nueva comunicación
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Mensajes este mes', value: stats.sentThisMonth, color: 'text-navy', icon: CheckCircle2 },
          { label: 'Destinatarios alcanzados', value: stats.totalRecipients.toLocaleString('es-CR'), color: 'text-teal-deep', icon: Users },
          { label: 'Tasa de entrega', value: `${stats.avgRate}%`, color: stats.avgRate >= 90 ? 'text-teal-deep' : 'text-amber-600', icon: TrendingUp },
          { label: 'Con errores', value: stats.withErrors, color: stats.withErrors > 0 ? 'text-coral' : 'text-navy-light/60', icon: AlertTriangle },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] tracking-widests uppercase text-navy-light/60 font-display">
                {label}
              </p>
              <Icon size={14} className={color} />
            </div>
            <p className={cn('text-4xl font-extrabold tabular-nums font-display', color)}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Activity chart */}
      <div className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)]">
        <p className="text-[10px] uppercase tracking-widests text-navy-light/60 mb-4 font-display">
          Actividad — últimos 7 días
        </p>
        <div className="flex items-end gap-2 h-20">
          {activityData.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full relative flex items-end justify-center h-[56px]">
                <div
                  className="w-full rounded-t-md bg-coral/70 transition-all duration-300"
                  style={{ height: `${maxActivity > 0 ? (d.count / maxActivity) * 56 : 0}px`, minHeight: d.count > 0 ? 4 : 0 }}
                />
                {d.count > 0 && (
                  <span className="absolute -top-5 text-[10px] font-bold text-coral font-mono">
                    {d.count}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-navy-light/60 capitalize font-body">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div className="flex gap-1 border-b mb-4 border-[var(--outline-variant)]">
          {(['historial', 'borradores'] as MainTab[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-all capitalize font-body',
                tab === t ? 'border-coral text-navy' : 'border-transparent text-navy-light/60 hover:text-navy'
              )}
            >
              {t === 'historial' ? 'Historial' : `Borradores${drafts.length > 0 ? ` (${drafts.length})` : ''}`}
            </button>
          ))}
        </div>

        {tab === 'historial' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <select
                className="rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
                value={channelFilter}
                onChange={e => setChannelFilter(e.target.value as ChannelFilter)}
              >
                <option value="all">Canal: Todos</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="both">Ambos</option>
              </select>
              <select
                className="rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              >
                <option value="all">Estado: Todos</option>
                <option value="sent">Enviado</option>
                <option value="partial">Parcial</option>
                <option value="failed">Fallido</option>
              </select>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  className="rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                />
                <span className="text-navy-light/60 text-sm">—</span>
                <input
                  type="date"
                  className="rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                />
              </div>
            </div>

            {/* Message list */}
            <div className="space-y-3">
              {filtered.length === 0 ? (
                <div className="rounded-2xl bg-surface-card">
                  <EmptyState icon={MessageSquare} title="No hay mensajes con ese filtro" />
                </div>
              ) : (
                histPage.visible.map(msg => (
                  <div
                    key={msg.id}
                    className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <ChannelBadge channel={msg.channel} size="sm" />
                          <span
                            className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold font-display', STATUS_STYLE[msg.status])}
                          >
                            {STATUS_LABEL[msg.status]}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-navy truncate font-body">
                          {msg.subject || msg.body.split('\n')[0].slice(0, 60)}
                        </p>
                        <p className="text-[12px] text-navy-light/60 mt-0.5 font-body">
                          {msg.segment.label}
                        </p>
                      </div>
                      <Link
                        href={`/comunicaciones/${msg.id}`}
                        className="shrink-0 flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
                      >
                        Ver detalles
                        <ChevronRight size={12} />
                      </Link>
                    </div>

                    <div className="mt-3 pt-3 border-t flex items-center justify-between flex-wrap gap-2 border-[var(--outline-variant)]">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1 text-[12px] text-teal-deep font-body">
                          <CheckCircle2 size={12} />
                          {msg.stats.delivered} entregados
                        </span>
                        {msg.stats.failed > 0 && (
                          <span className="inline-flex items-center gap-1 text-[12px] text-coral font-body">
                            <AlertTriangle size={12} />
                            {msg.stats.failed} fallidos
                          </span>
                        )}
                        <span className="text-[12px] text-navy-light/60 font-body">
                          {getDeliveryRate(msg)}% entrega
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-navy-light/60 font-body">
                        <span className="flex items-center gap-1">
                          <Calendar size={11} />
                          {msg.sent_at ? new Date(msg.sent_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </span>
                        <span>por {msg.sent_by}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
              {filtered.length > 0 && (
                <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)]">
                  <LoadMoreFooter
                    shown={histPage.shown}
                    total={histPage.total}
                    hasMore={histPage.hasMore}
                    loading={false}
                    onLoadMore={histPage.loadMore}
                    noun="mensajes"
                    increment={15}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'borradores' && (
          <div className="space-y-3">
            {drafts.length === 0 ? (
              <div className="rounded-2xl bg-surface-card">
                <EmptyState icon={FileEdit} title="No hay borradores guardados" />
              </div>
            ) : (
              drafts.map(msg => (
                <div
                  key={msg.id}
                  className="rounded-2xl p-5 flex items-center justify-between gap-4 bg-surface-card shadow-[var(--shadow-md)]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <ChannelBadge channel={msg.channel} size="sm" />
                    </div>
                    <p className="text-sm font-semibold text-navy truncate font-body">
                      {msg.subject || msg.body.split('\n')[0].slice(0, 60)}
                    </p>
                    <p className="text-[11px] text-navy-light/60 mt-0.5 font-body">
                      Guardado el {new Date(msg.created_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <Link
                    href={`/comunicaciones/nueva`}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-coral px-3.5 py-1.5 text-[12px] text-white hover:bg-coral-deep transition-colors font-body"
                  >
                    <FileEdit size={12} />
                    Continuar editando
                  </Link>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
