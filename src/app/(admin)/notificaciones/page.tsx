'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Bell, AlertCircle, Info, AlertTriangle, ChevronRight } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import type { ActiveAlert, AlertType } from '@/lib/supabase/queries/alerts'

const TYPE_CONFIG: Record<AlertType, { Icon: React.ElementType; color: string; bg: string; label: string }> = {
  alert:   { Icon: AlertCircle,   color: '#EF5554', bg: 'rgba(239,85,84,0.10)',  label: 'Urgente' },
  warning: { Icon: AlertTriangle, color: '#E9B949', bg: 'rgba(233,185,73,0.12)', label: 'Atención' },
  info:    { Icon: Info,          color: '#519DA2', bg: 'rgba(81,157,162,0.10)', label: 'Informativo' },
}

export default function NotificacionesPage() {
  const [alerts, setAlerts] = useState<ActiveAlert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('/api/alerts')
      .then(r => (r.ok ? r.json() : []))
      .then(d => { if (alive) { setAlerts(Array.isArray(d) ? d : []); setLoading(false) } })
      .catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl text-navy" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}>
          Alertas
        </h1>
        <p className="mt-1 text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
          Pendientes derivados de la operación, calculados en vivo.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 rounded-full border-2 border-coral border-t-transparent animate-spin" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="rounded-2xl" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
          <EmptyState
            icon={Bell}
            title="Todo al día"
            description="No hay alertas pendientes en este momento."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(a => {
            const cfg = TYPE_CONFIG[a.type]
            return (
              <Link
                key={a.id}
                href={a.url}
                className="flex items-center gap-4 rounded-2xl px-5 py-4 hover:bg-surface-low transition-colors"
                style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: cfg.bg }}>
                  <cfg.Icon size={18} style={{ color: cfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>{a.message}</p>
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
    </div>
  )
}
