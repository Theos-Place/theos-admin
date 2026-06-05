'use client'

import { AlertTriangle } from 'lucide-react'

type ActiveWarningModalProps = {
  open: boolean
  title: string
  message: string
  onClose: () => void
}

/**
 * Modal de advertencia cuando NO se puede eliminar porque hay entidades activas
 * ligadas. Solo informa (botón "Entendido"), no permite acción destructiva.
 */
export function ActiveWarningModal({ open, title, message, onClose }: ActiveWarningModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-ink/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-lg)' }}>
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(233,185,73,0.15)' }}>
            <AlertTriangle size={18} className="text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>{title}</p>
            <p className="text-[13px] text-navy-light/60 mt-1 leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>
              {message}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-full rounded-xl bg-navy py-2.5 text-sm text-white hover:bg-navy/80 transition-colors"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Entendido
        </button>
      </div>
    </div>
  )
}
