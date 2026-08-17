'use client'

import { AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'

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
    <Modal onClose={onClose} titleId="active-warning-title" width={384}>
      <div className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 bg-[rgba(233,185,73,0.15)]">
            <AlertTriangle size={18} className="text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p id="active-warning-title" className="text-base font-bold text-navy font-display">{title}</p>
            <p className="text-[13px] text-navy-light/70 mt-1 leading-relaxed font-body">
              {message}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-full rounded-xl bg-navy py-2.5 text-sm text-white hover:bg-navy/80 transition-colors font-body"
        >
          Entendido
        </button>
      </div>
    </Modal>
  )
}
