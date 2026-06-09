'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Bell, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import type { ActiveAlert, AlertType } from '@/lib/supabase/queries/alerts'

const TYPE_CONFIG: Record<AlertType, { Icon: React.ElementType; color: string; bg: string }> = {
  alert:   { Icon: AlertCircle,   color: '#EF5554', bg: 'rgba(239,85,84,0.10)'   },
  info:    { Icon: Info,          color: '#519DA2', bg: 'rgba(81,157,162,0.10)'  },
  warning: { Icon: AlertTriangle, color: '#E9B949', bg: 'rgba(233,185,73,0.12)'  },
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const [alerts, setAlerts] = useState<ActiveAlert[]>([])
  const ref = useRef<HTMLDivElement>(null)

  const count = alerts.length

  useEffect(() => {
    let alive = true
    fetch('/api/alerts')
      .then(r => (r.ok ? r.json() : []))
      .then(d => { if (alive) setAlerts(Array.isArray(d) ? d : []) })
      .catch(() => { if (alive) setAlerts([]) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

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
          className="absolute right-0 top-[calc(100%+8px)] w-80 rounded-2xl overflow-hidden z-50 bg-surface-card shadow-[0_20px_48px_rgba(22,20,64,0.14)] border border-[var(--outline-variant)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--outline-variant)]">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-navy font-display">
                Alertas
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

          {/* Alerts list */}
          <div className="max-h-[340px] overflow-y-auto">
            {count === 0 && (
              <p className="px-4 py-8 text-center text-[13px] text-navy-light/40 font-body">
                Todo al día. No hay alertas pendientes.
              </p>
            )}
            {alerts.map(a => {
              const cfg = TYPE_CONFIG[a.type]
              return (
                <Link
                  key={a.id}
                  href={a.url}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-low transition-colors border-b last:border-b-0 border-[var(--outline-variant)]"
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
          <div className="border-t px-4 py-3 border-[var(--outline-variant)]">
            <Link
              href="/notificaciones"
              onClick={() => setOpen(false)}
              className="text-[12px] text-navy-light/50 hover:text-navy transition-colors font-body"
            >
              Ver todas las alertas →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
