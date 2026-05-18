'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Bell, AlertCircle, Info, AlertTriangle, CheckCheck } from 'lucide-react'

type NotifType = 'alert' | 'info' | 'warning'

type Notification = {
  id: string
  type: NotifType
  message: string
  url: string
  time: string
  read: boolean
}

const INITIAL_NOTIFICATIONS: Notification[] = [
  { id: '1', type: 'alert',   message: '3 devoluciones SINPE pendientes de procesar',    url: '/finanzas/devoluciones',      time: 'Hace 5 min',  read: false },
  { id: '2', type: 'info',    message: 'Diego Salazar cerró el grupo Nivel 4 — San José B', url: '/estudios/grupos',           time: 'Hace 1 hora', read: false },
  { id: '3', type: 'warning', message: '3 grupos de estudio sin dirigente asignado',     url: '/estudios/grupos',             time: 'Hace 2 horas',read: false },
  { id: '4', type: 'info',    message: '8 aplicaciones de servicio pendientes de revisión', url: '/servidores/aplicaciones',  time: 'Ayer',        read: true  },
  { id: '5', type: 'info',    message: 'Jennifer Zamora importó 23 donaciones',           url: '/finanzas/donaciones',        time: 'Ayer',        read: true  },
]

const TYPE_CONFIG: Record<NotifType, { Icon: React.ElementType; color: string; bg: string }> = {
  alert:   { Icon: AlertCircle,   color: '#EF5554', bg: 'rgba(239,85,84,0.10)'   },
  info:    { Icon: Info,          color: '#519DA2', bg: 'rgba(81,157,162,0.10)'  },
  warning: { Icon: AlertTriangle, color: '#E9B949', bg: 'rgba(233,185,73,0.12)'  },
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS)
  const ref = useRef<HTMLDivElement>(null)

  const unread = notifications.filter(n => !n.read).length

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function markRead(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative rounded-lg p-1.5 text-navy-light hover:bg-surface-low transition-colors"
        aria-label="Notificaciones"
      >
        <Bell size={20} strokeWidth={1.75} />
        {unread > 0 && (
          <span
            className="absolute top-0.5 right-0.5 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white px-1"
            style={{ background: '#EF5554', fontFamily: 'var(--font-display)' }}
          >
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] w-80 rounded-2xl overflow-hidden z-50"
          style={{
            background: 'var(--surface-card)',
            boxShadow: '0 20px 48px rgba(22,20,64,0.14)',
            border: '1px solid var(--outline-variant)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b" style={{ borderColor: 'var(--outline-variant)' }}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
                Notificaciones
              </span>
              {unread > 0 && (
                <span
                  className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full text-[10px] font-bold text-white px-1.5"
                  style={{ background: '#EF5554', fontFamily: 'var(--font-display)' }}
                >
                  {unread}
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-[11px] text-navy-light/50 hover:text-navy transition-colors"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <CheckCheck size={13} />
                Marcar todas
              </button>
            )}
          </div>

          {/* Notifications list */}
          <div className="max-h-[340px] overflow-y-auto">
            {notifications.map(n => {
              const cfg = TYPE_CONFIG[n.type]
              return (
                <Link
                  key={n.id}
                  href={n.url}
                  onClick={() => { markRead(n.id); setOpen(false) }}
                  className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-low transition-colors border-b last:border-b-0"
                  style={{ borderColor: 'var(--outline-variant)' }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: cfg.bg }}
                  >
                    <cfg.Icon size={14} style={{ color: cfg.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-[13px] leading-snug ${n.read ? 'text-navy-light/60' : 'text-navy'}`}
                      style={{ fontFamily: 'var(--font-body)' }}
                    >
                      {n.message}
                    </p>
                    <p className="text-[11px] text-navy-light/40 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
                      {n.time}
                    </p>
                  </div>
                  {!n.read && (
                    <div className="w-2 h-2 rounded-full bg-[#519DA2] shrink-0 mt-1.5" />
                  )}
                </Link>
              )
            })}
          </div>

          {/* Footer */}
          <div className="border-t px-4 py-3" style={{ borderColor: 'var(--outline-variant)' }}>
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="text-[12px] text-navy-light/50 hover:text-navy transition-colors"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Ver todas las notificaciones →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
