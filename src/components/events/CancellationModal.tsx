'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { AlertTriangle, CheckCircle } from 'lucide-react'

interface CancellationModalProps {
  eventName: string
  registrationCount: number
  onConfirm: (reason: string) => void
  onClose: () => void
}

const CHECKLIST_ITEMS = [
  'Notificando a inscritos...',
  'Liberando cupos...',
  'Actualizando estado del evento...',
  'Registrando motivo de cancelación...',
  'Evento cancelado correctamente.',
]

export function CancellationModal({ eventName, registrationCount, onConfirm, onClose }: CancellationModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [reason, setReason] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [visibleItems, setVisibleItems] = useState<number[]>([])

  const canConfirm = confirmText === 'CANCELAR' && reason.trim().length > 0

  function handleConfirm() {
    setStep(2)
    CHECKLIST_ITEMS.forEach((_, i) => {
      setTimeout(() => {
        setVisibleItems(prev => [...prev, i])
        if (i === CHECKLIST_ITEMS.length - 1) {
          setTimeout(() => onConfirm(reason), 800)
        }
      }, i * 400)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-navy-ink/60 backdrop-blur-sm" onClick={step === 1 ? onClose : undefined} />
      <div
        className="relative rounded-2xl w-full max-w-md mx-4 overflow-hidden bg-surface-card shadow-[var(--shadow-lg)]"
      >
        {step === 1 ? (
          <>
            {/* Header rojo */}
            <div className="bg-coral/10 border-b px-5 py-4 flex items-center gap-3 border-[var(--outline-variant)]">
              <div className="h-8 w-8 rounded-full bg-coral/20 flex items-center justify-center">
                <AlertTriangle size={16} className="text-coral" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-navy font-display">
                  Cancelar evento
                </h3>
                <p className="text-[11px] text-navy-light/60 font-body">
                  Esta acción notificará a {registrationCount} inscritos
                </p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-xl bg-coral/5 border border-coral/20 px-4 py-3">
                <p className="text-sm text-coral font-medium font-body">
                  {eventName}
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  className="text-[11px] tracking-widest uppercase text-navy-light/40 font-display"
                >
                  Motivo de cancelación *
                </label>
                <textarea
                  className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 resize-none font-body"
                  rows={3}
                  placeholder="Explica el motivo para los registros internos..."
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  className="text-[11px] tracking-widest uppercase text-navy-light/40 font-display"
                >
                  Escribí "CANCELAR" para confirmar
                </label>
                <input
                  className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
                  placeholder="CANCELAR"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleConfirm}
                  disabled={!canConfirm}
                  className="flex-1 rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-all disabled:opacity-40 disabled:cursor-not-allowed font-body"
                >
                  Cancelar evento
                </button>
                <button
                  onClick={onClose}
                  className="rounded-full border px-5 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-all border-[var(--outline-variant)] font-body"
                >
                  Volver
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-teal-soft/30 flex items-center justify-center">
                <CheckCircle size={20} className="text-teal-deep" />
              </div>
              <p className="font-semibold text-navy font-display">
                Procesando cancelación...
              </p>
            </div>
            <div className="space-y-2">
              {CHECKLIST_ITEMS.map((item, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-2.5 transition-all duration-300',
                    visibleItems.includes(i) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                  )}
                >
                  <div
                    className={cn(
                      'h-4 w-4 rounded-full flex items-center justify-center text-white text-[10px] transition-all',
                      visibleItems.includes(i)
                        ? i === CHECKLIST_ITEMS.length - 1 ? 'bg-teal-deep' : 'bg-navy'
                        : 'bg-navy-light/20'
                    )}
                  >
                    ✓
                  </div>
                  <span
                    className={cn(
                      'text-sm transition-colors font-body',
                      i === CHECKLIST_ITEMS.length - 1 && visibleItems.includes(i)
                        ? 'text-teal-deep font-medium'
                        : 'text-navy-light/70'
                    )}
                  >
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
