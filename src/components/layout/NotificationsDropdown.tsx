'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, AlertCircle, Info, AlertTriangle, Inbox } from 'lucide-react'
import type { ActiveAlert, AlertType } from '@/lib/supabase/queries/alerts'
import type { InternalNotification } from '@/types/notification'

const TYPE_CONFIG: Record<AlertType, { Icon: React.ElementType; color: string; bg: string }> = {
  alert:   { Icon: AlertCircle,   color: '#EF5554', bg: 'rgba(239,85,84,0.10)'   },
  info:    { Icon: Info,          color: '#519DA2', bg: 'rgba(81,157,162,0.10)'  },
  warning: { Icon: AlertTriangle, color: '#E9B949', bg: 'rgba(233,185,73,0.12)'  },
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  return `hace ${Math.floor(hours / 24)} d`
}

export function NotificationsBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [alerts, setAlerts] = useState<ActiveAlert[]>([])
  const [notifications, setNotifications] = useState<InternalNotification[]>([])
  const ref = useRef<HTMLDivElement>(null)

  const unread = notifications.filter(n => !n.read)
  const count = alerts.length + unread.length

  const load = useCallback(() => {
    fetch('/api/alerts')
      .then(r => (r.ok ? r.json() : []))
      .then(d => setAlerts(Array.isArray(d) ? d : []))
      .catch(() => setAlerts([]))
    fetch('/api/notifications/internal')
      .then(r => (r.ok ? r.json() : []))
      .then(d => setNotifications(Array.isArray(d) ? d : []))
      .catch(() => setNotifications([]))
  }, [])

  useEffect(() => {
    load()
    // Refresca el conteo: al marcar/borrar en otra parte, al volver el foco, y
    // por polling periódico (notificaciones nuevas llegan sin recargar).
    const onChanged = () => load()
    const poll = setInterval(load, 60000)
    window.addEventListener('notifications:changed', onChanged)
    window.addEventListener('focus', onChanged)
    return () => {
      clearInterval(poll)
      window.removeEventListener('notifications:changed', onChanged)
      window.removeEventListener('focus', onChanged)
    }
  }, [load])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Marca como leída (optimista) y navega al destino de la notificación.
  function openNotification(n: InternalNotification) {
    setOpen(false)
    setNotifications(prev => prev.map(x => (x.id === n.id ? { ...x, read: true } : x)))
    fetch(`/api/notifications/internal/${n.id}`, { method: 'PATCH' })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        window.dispatchEvent(new Event('notifications:changed'))
      })
      .catch(() => {
        // Rollback del optimista si falló el PATCH.
        setNotifications(prev => prev.map(x => (x.id === n.id ? { ...x, read: false } : x)))
      })
    router.push(n.link || '/estudios/solicitudes')
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative rounded-lg p-1.5 text-navy-light hover:bg-surface-low transition-colors"
        aria-label="Notificaciones"
      >
        <Bell size={20} strokeWidth={1.75} />
        {count > 0 && (
          <span
            className="absolute top-0.5 right-0.5 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white px-1 bg-coral font-display"
          >
            {count}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] w-80 rounded-2xl overflow-hidden z-50 bg-surface-card shadow-[0_20px_48px_rgba(22,20,64,0.14)] border border-outline"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-outline">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-navy font-display">
                Notificaciones
              </span>
              {count > 0 && (
                <span
                  className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full text-[10px] font-bold text-white px-1.5 bg-coral font-display"
                >
                  {count}
                </span>
              )}
            </div>
          </div>

          <div className="max-h-[340px] overflow-y-auto">
            {count === 0 && (
              <p className="px-4 py-8 text-center text-[13px] text-navy-light/60 font-body">
                Todo al día. No hay notificaciones pendientes.
              </p>
            )}

            {/* Notificaciones internas (solicitudes de estudios, etc.) */}
            {unread.map(n => (
              <button
                key={n.id}
                onClick={() => openNotification(n)}
                className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-surface-low transition-colors border-b border-outline"
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-coral/10">
                  <Inbox size={14} className="text-coral" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold leading-snug text-navy font-body">{n.title}</p>
                  {n.body && <p className="text-[12px] leading-snug text-navy-light/70 font-body mt-0.5 line-clamp-2">{n.body}</p>}
                  <p className="text-[11px] text-navy-light/60 font-body mt-1">{timeAgo(n.created_at)}</p>
                </div>
              </button>
            ))}

            {/* Alertas del sistema */}
            {alerts.map(a => {
              const cfg = TYPE_CONFIG[a.type]
              return (
                <Link
                  key={a.id}
                  href={a.url}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-low transition-colors border-b last:border-b-0 border-outline"
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: cfg.bg }}>
                    <cfg.Icon size={14} style={{ color: cfg.color }} />
                  </div>
                  <p className="flex-1 text-[13px] leading-snug text-navy font-body">
                    {a.message}
                  </p>
                </Link>
              )
            })}
          </div>

          {/* Footer */}
          <div className="border-t px-4 py-3 border-outline">
            <Link
              href="/notificaciones"
              onClick={() => setOpen(false)}
              className="text-[12px] text-navy-light/60 hover:text-navy transition-colors font-body"
            >
              Ver todas las alertas →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
