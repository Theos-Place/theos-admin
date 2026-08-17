'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, AlertCircle, Info, AlertTriangle, ChevronRight, Inbox, CheckCheck, Trash2 } from 'lucide-react'
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
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Avisa al ícono (NotificationsBell, otro componente) que el conteo cambió.
  function notifyChanged() {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('notifications:changed'))
  }

  function toggleSelected(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const allSelected = notifications.length > 0 && selected.size === notifications.length
  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(notifications.map(n => n.id)))
  }

  async function markSelectedRead() {
    const ids = [...selected]
    if (ids.length === 0) return
    setNotifications(prev => prev.map(n => (selected.has(n.id) ? { ...n, read: true } : n)))
    setSelected(new Set())
    try {
      await fetch('/api/notifications/internal/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      notifyChanged()
    } catch {
      toast('No se pudieron marcar las notificaciones', 'error')
    }
  }

  async function deleteSelected() {
    const ids = [...selected]
    if (ids.length === 0) return
    setNotifications(prev => prev.filter(n => !selected.has(n.id)))
    setSelected(new Set())
    try {
      await fetch('/api/notifications/internal/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      notifyChanged()
    } catch {
      toast('No se pudieron eliminar las notificaciones', 'error')
    }
  }

  async function deleteOne(id: string) {
    setNotifications(prev => prev.filter(n => n.id !== id))
    setSelected(prev => { const s = new Set(prev); s.delete(id); return s })
    try {
      const r = await fetch(`/api/notifications/internal/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error()
      notifyChanged()
    } catch {
      toast('No se pudo eliminar la notificación', 'error')
    }
  }

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
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); notifyChanged() })
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
      notifyChanged()
    } catch {
      // El refetch del próximo render corrige si falló.
    } finally {
      setMarkingAll(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">
            Notificaciones
          </h1>
          <p className="mt-1 text-sm text-navy-light/70 font-body">
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
              {/* Barra de selección */}
              <div className="flex items-center justify-between gap-3 px-1 py-1 flex-wrap">
                <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-navy-light/70 font-body">
                  <input
                    type="checkbox"
                    className="accent-coral h-4 w-4"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label="Seleccionar todas"
                  />
                  Seleccionar todas
                  {selected.size > 0 && <span className="text-navy-light/70">· {selected.size} seleccionada{selected.size !== 1 ? 's' : ''}</span>}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={markSelectedRead}
                    disabled={selected.size === 0}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--outline-variant)] px-4 py-1.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body disabled:opacity-50"
                  >
                    <CheckCheck size={14} />
                    Marcar como leídas
                  </button>
                  <button
                    onClick={deleteSelected}
                    disabled={selected.size === 0}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--outline-variant)] px-4 py-1.5 text-sm text-coral hover:bg-coral/5 transition-colors font-body disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    Eliminar
                  </button>
                </div>
              </div>

              {notifications.map(n => (
                <div
                  key={n.id}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-2xl px-4 py-4 transition-colors shadow-card',
                    n.read
                      ? 'bg-surface-card'
                      : 'bg-coral/5 border border-coral/20',
                  )}
                >
                  <input
                    type="checkbox"
                    className="accent-coral h-4 w-4 mt-3 shrink-0"
                    checked={selected.has(n.id)}
                    onChange={() => toggleSelected(n.id)}
                    aria-label={`Seleccionar ${n.title}`}
                  />
                  <button
                    onClick={() => openNotification(n)}
                    className="flex flex-1 items-start gap-3 min-w-0 text-left"
                  >
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                      n.read ? 'bg-surface-low' : 'bg-coral/10',
                    )}>
                      <Inbox size={18} className={n.read ? 'text-navy-light/70' : 'text-coral'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-body leading-snug break-words', n.read ? 'text-navy-light/70' : 'text-navy font-semibold')}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-[13px] text-navy-light/70 font-body mt-0.5 break-words">{n.body}</p>
                      )}
                      <p className="text-[12px] text-navy-light/70 font-body mt-1">{formatDateTime(n.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-center">
                      {!n.read && <span className="h-2 w-2 rounded-full bg-coral" aria-label="No leída" />}
                      <ChevronRight size={16} className="text-navy-light/70" />
                    </div>
                  </button>
                  <button
                    onClick={() => deleteOne(n.id)}
                    aria-label={`Eliminar ${n.title}`}
                    title="Eliminar"
                    className="shrink-0 self-center rounded-lg p-2 text-navy-light/50 hover:bg-coral/5 hover:text-coral transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
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
                      <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: cfg.color, fontFamily: 'var(--font-display)' }}>
                        {cfg.label}
                      </span>
                    </div>
                    <ChevronRight size={18} className="text-navy-light/70 shrink-0" />
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
