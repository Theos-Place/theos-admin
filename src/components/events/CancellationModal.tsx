'use client'

import { useState } from 'react'
import { Modal } from '@/components/shared/Modal'
import { AlertTriangle, CheckCircle } from 'lucide-react'

interface CancellationModalProps {
  eventName: string
  registrationCount: number
  /** Ejecuta la cancelación real; debe lanzar si falla (el modal muestra el error). */
  onConfirm: (reason: string) => Promise<void>
  onClose: () => void
}

export function CancellationModal({ eventName, registrationCount, onConfirm, onClose }: CancellationModalProps) {
  const [reason, setReason] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [state, setState] = useState<'form' | 'working' | 'done' | 'error'>('form')

  const canConfirm = confirmText === 'CANCELAR' && reason.trim().length > 0

  async function handleConfirm() {
    if (state === 'working') return
    setState('working')
    try {
      await onConfirm(reason)
      setState('done')
    } catch {
      setState('error')
    }
  }

  if (state === 'form' || state === 'error') {
    return (
      <Modal onClose={onClose} titleId="cancelar-evento-titulo" width={448}>
          <>
            {/* Header rojo */}
            <div className="bg-coral/10 border-b px-5 py-4 flex items-center gap-3 border-[var(--outline-variant)]">
              <div className="h-8 w-8 rounded-full bg-coral/20 flex items-center justify-center">
                <AlertTriangle size={16} className="text-coral" />
              </div>
              <div>
                <h3 id="cancelar-evento-titulo" className="text-sm font-semibold text-navy font-display">
                  Cancelar evento
                </h3>
                <p className="text-[11px] text-navy-light/60 font-body">
                  El evento quedará cancelado; hay {registrationCount} inscritos
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
                  className="text-[11px] tracking-widest uppercase text-navy-light/60 font-display"
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
                  className="text-[11px] tracking-widest uppercase text-navy-light/60 font-display"
                >
                  Escribí &quot;CANCELAR&quot; para confirmar
                </label>
                <input
                  className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
                  placeholder="CANCELAR"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                />
              </div>

              {state === 'error' && (
                <p className="text-sm text-coral font-body" role="alert">
                  No se pudo cancelar el evento. Revisá tu conexión e intentá de nuevo.
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleConfirm}
                  disabled={!canConfirm}
                  className="flex-1 rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-all disabled:opacity-40 disabled:cursor-not-allowed font-body"
                >
                  {state === 'error' ? 'Reintentar' : 'Cancelar evento'}
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
      </Modal>
    )
  }

  // working / done: overlay NO cerrable mientras corre la petición real —
  // fuera del Modal compartido a propósito. El éxito solo se muestra cuando
  // el servidor respondió OK.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-navy-ink/60 backdrop-blur-sm" />
      <div
        className="relative rounded-2xl w-full max-w-md mx-4 overflow-hidden bg-surface-card shadow-[var(--shadow-lg)]"
      >
        <div className="p-6 space-y-4 text-center">
          {state === 'working' ? (
            <>
              <div className="h-8 w-8 mx-auto rounded-full border-2 border-navy-light/20 border-t-coral animate-spin" />
              <p className="font-semibold text-navy font-display">Cancelando evento…</p>
            </>
          ) : (
            <>
              <div className="h-10 w-10 mx-auto rounded-full bg-teal-soft/30 flex items-center justify-center">
                <CheckCircle size={20} className="text-teal-deep" />
              </div>
              <p className="font-semibold text-navy font-display">Evento cancelado</p>
              <p className="text-sm text-navy-light/70 font-body">
                El motivo quedó registrado y los cupos fueron liberados.
              </p>
              <button
                onClick={onClose}
                className="rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body"
              >
                Cerrar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
