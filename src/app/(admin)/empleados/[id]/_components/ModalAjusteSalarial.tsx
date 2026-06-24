'use client'

import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'

interface ModalAjusteSalarialProps {
  currentSalary: number | null
  raiseAmount: string
  raiseReason: string
  raiseDate: string
  raiseSaved: boolean
  onClose: () => void
  onRaiseAmountChange: (value: string) => void
  onRaiseReasonChange: (value: string) => void
  onRaiseDateChange: (value: string) => void
  onSave: () => void
}

export function ModalAjusteSalarial({
  currentSalary,
  raiseAmount,
  raiseReason,
  raiseDate,
  raiseSaved,
  onClose,
  onRaiseAmountChange,
  onRaiseReasonChange,
  onRaiseDateChange,
  onSave,
}: ModalAjusteSalarialProps) {
  const canRaise = raiseAmount !== '' && parseFloat(raiseAmount) > (currentSalary ?? 0) && raiseDate !== ''

  return (
    <Modal onClose={onClose} titleId="modal-ajuste-salarial" width={448}>
      <div className="p-6 space-y-4">
        {raiseSaved ? (
          <div className="text-center space-y-3 py-4">
            <div className="h-12 w-12 rounded-full bg-teal-soft/30 flex items-center justify-center mx-auto">
              <Check size={22} className="text-teal-deep" />
            </div>
            <p className="text-base font-bold text-navy font-display">Ajuste registrado</p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors font-body"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <h2 id="modal-ajuste-salarial" className="text-base font-bold text-navy font-display">Registrar ajuste salarial</h2>
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-widest text-navy-light/60 font-display">Salario actual</label>
              <p className="text-sm text-navy font-mono">{currentSalary != null ? `₡${currentSalary.toLocaleString('es-CR')}` : '₡ ••••••'}</p>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-widest text-navy-light/60 font-display">Nuevo salario <span className="text-coral">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-navy-light/60 font-mono">₡</span>
                <input
                  type="number"
                  className={cn(inputCls, 'pl-7 font-body')}
                  placeholder={currentSalary != null ? String(currentSalary) : ''}
                  value={raiseAmount}
                  onChange={e => onRaiseAmountChange(e.target.value)}
                />
              </div>
              {raiseAmount && parseFloat(raiseAmount) <= (currentSalary ?? 0) && (
                <p className="text-[11px] text-coral font-body">El nuevo salario debe ser mayor al actual.</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-widest text-navy-light/60 font-display">Motivo <span className="text-coral">*</span></label>
              <input
                className={cn(inputCls, 'font-body')}
                placeholder="Ej: Ajuste por desempeño"
                value={raiseReason}
                onChange={e => onRaiseReasonChange(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-widest text-navy-light/60 font-display">Fecha efectiva <span className="text-coral">*</span></label>
              <input
                type="date"
                className={cn(inputCls, 'font-body')}
                value={raiseDate}
                onChange={e => onRaiseDateChange(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-[var(--outline-variant)] px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={!canRaise || !raiseReason}
                className={cn(
                  'rounded-full px-4 py-2 text-sm text-white transition-colors font-body',
                  canRaise && raiseReason ? 'bg-coral hover:bg-coral-deep' : 'bg-navy-light/20 cursor-not-allowed'
                )}
              >
                Guardar ajuste
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
