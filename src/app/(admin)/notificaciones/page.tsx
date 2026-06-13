'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, AlertCircle, Info, AlertTriangle, ChevronRight, Inbox, CheckCheck } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { useToast } from '@/components/shared/Toast'
import { cn } from '@/lib/utils'
import type { ActiveAlert, AlertType } from '@/lib/supabase/queries/alerts'
import type { InternalNotification } from '@/types/notification'
import { formatDateTime } from '@/lib/format'

const TYPE_CONFIG: Record<AlertType, { Icon: React.ElementType; color: string; bg: string; label: string }> = {
  alert:   { Icon: AlertCircle,   color: '#EF5554', bg: 'rgba(239,85,84,0.10)',  label: 'Urgente' },
  warning: { Icon: AlertTriangle, color: '#E9B949', bg: 'rgba(233,185,73,0.12)', label: 'Atención' },
  info:    { Icon: Info,          color: '#519DA2', bg: 'rgba(81,157,162,0.10)', label: 'Informativo' },
}

export default function NotificacionesPage() {
  const router = useRouter()
  const toast = useToast()
  const [notifications, setNotifications] = useState<InternalNotification[]>([])
  const [alerts, setAlerts] = useState<ActiveAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.all([
      fetch('/api/notifications/internal').then(r => (r.ok ? r.json() : [])),
      fetch('/api/alerts').then(r => (r.ok ? r.json() : [])),
    ])
      .then(([n, a]) => {
        if (!alive) return
        setNotifications(Array.isArray(n) ? n : [])
        setAlerts(Array.isArray(a) ? a : [])
        setLoading(false)
      })
      .catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  // Marca como leída (optimista) y navega al recurso de la notificación.
  function openNotification(n: InternalNotification) {
    if (!n.read) {
      setNotifications(prev => prev.map(x => (x.id === n.id ? { ...x, read: true } : x)))
      fetch(`/api/notifications/internal/${n.id}`, { method: 'PATCH' })
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`) })
        .catch(() => {
          // Rollback del optimista si falló el PATCH.
          setNotifications(prev => prev.map(x => (x.id === n.id ? { ...x, read: false } : x)))
          toast('No se pudo marcar la notificación como leída', 'error')
        })
    }
    router.push(n.link || '/notificaciones')
  }

  async function markAllRead() {
    if (markingAll || unreadCount === 0) return
    setMarkingAll(true)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    try {
      await fetch('/api/notifications/internal/read-all', { method: 'POST' })
    } catch {
      // El refetch del próximo render corrige si falló.
    } finally {
      setMarkingAll(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">
            Notificaciones
          </h1>
          <p className="mt-1 text-sm text-navy-light/60 font-body">
            {unreadCount > 0
              ? `Tenés ${unreadCount} notificación${unreadCount !== 1 ? 'es' : ''} sin leer`
              : 'Todas tus notificaciones, leídas y no leídas'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={markingAll}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--outline-variant)] px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors font-body disabled:opacity-60"
          >
            <CheckCheck size={14} />
            Marcar todas como leídas
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 rounded-full border-2 border-coral border-t-transparent animate-spin" />
        </div>
      ) : (
        <>
          {/* Notificaciones del usuario */}
          {notifications.length === 0 ? (
            <div className="rounded-2xl bg-surface-card shadow-card">
              <EmptyState
                icon={Bell}
                title="Sin notificaciones"
                description="Cuando recibás notificaciones (solicitudes, alertas de dirigentes…) van a aparecer acá."
              />
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => openNotification(n)}
                  className={cn(
                    'flex w-full items-start gap-4 rounded-2xl px-5 py-4 text-left transition-colors shadow-card',
                    n.read
                      ? 'bg-surface-card hover:bg-surface-low'
                      : 'bg-coral/5 border border-coral/20 hover:bg-coral/10',
                  )}
                >
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                    n.read ? 'bg-surface-low' : 'bg-coral/10',
                  )}>
                    <Inbox size={18} className={n.read ? 'text-navy-light/60' : 'text-coral'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-body leading-snug', n.read ? 'text-navy-light/70' : 'text-navy font-semibold')}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-[13px] text-navy-light/70 font-body mt-0.5">{n.body}</p>
                    )}
                    <p className="text-[11px] text-navy-light/60 font-body mt-1">{formatDateTime(n.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-center">
                    {!n.read && <span className="h-2 w-2 rounded-full bg-coral" aria-label="No leída" />}
                    <ChevronRight size={16} className="text-navy-light/60" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Alertas del sistema (calculadas en vivo, sin estado leída/no leída) */}
          {alerts.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-navy font-display pt-2">
                Alertas del sistema
              </h2>
              {alerts.map(a => {
                const cfg = TYPE_CONFIG[a.type]
                return (
                  <Link
                    key={a.id}
                    href={a.url}
                    className="flex items-center gap-4 rounded-2xl px-5 py-4 hover:bg-surface-low transition-colors bg-surface-card shadow-card"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: cfg.bg }}>
                      <cfg.Icon size={18} style={{ color: cfg.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-navy font-body">{a.message}</p>
                      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: cfg.color, fontFamily: 'var(--font-display)' }}>
                        {cfg.label}
                      </span>
                    </div>
                    <ChevronRight size={18} className="text-navy-light/60 shrink-0" />
                  </Link>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
