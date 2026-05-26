'use client'

import { cn } from '@/lib/utils'
import { X, Check } from 'lucide-react'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'

interface ModalAjusteSalarialProps {
  currentSalary: number
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
  const canRaise = raiseAmount !== '' && parseFloat(raiseAmount) > currentSalary && raiseDate !== ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-ink/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        {raiseSaved ? (
          <div className="text-center space-y-3 py-4">
            <div className="h-12 w-12 rounded-full bg-teal-soft/30 flex items-center justify-center mx-auto">
              <Check size={22} className="text-teal-deep" />
            </div>
            <p className="text-base font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>Ajuste registrado</p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>Registrar ajuste salarial</h2>
              <button type="button" onClick={onClose}>
                <X size={18} className="text-navy-light/40" />
              </button>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Salario actual</label>
              <p className="text-sm text-navy" style={{ fontFamily: 'var(--font-mono)' }}>₡{currentSalary.toLocaleString('es-CR')}</p>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Nuevo salario <span className="text-coral">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-navy-light/50" style={{ fontFamily: 'var(--font-mono)' }}>₡</span>
                <input
                  type="number"
                  className={cn(inputCls, 'pl-7')}
                  style={{ fontFamily: 'var(--font-body)' }}
                  placeholder={String(currentSalary)}
                  value={raiseAmount}
                  onChange={e => onRaiseAmountChange(e.target.value)}
                />
              </div>
              {raiseAmount && parseFloat(raiseAmount) <= currentSalary && (
                <p className="text-[11px] text-coral" style={{ fontFamily: 'var(--font-body)' }}>El nuevo salario debe ser mayor al actual.</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Motivo <span className="text-coral">*</span></label>
              <input
                className={inputCls}
                style={{ fontFamily: 'var(--font-body)' }}
                placeholder="Ej: Ajuste por desempeño"
                value={raiseReason}
                onChange={e => onRaiseReasonChange(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Fecha efectiva <span className="text-coral">*</span></label>
              <input
                type="date"
                className={inputCls}
                style={{ fontFamily: 'var(--font-body)' }}
                value={raiseDate}
                onChange={e => onRaiseDateChange(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
                style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={!canRaise || !raiseReason}
                className={cn(
                  'rounded-full px-4 py-2 text-sm text-white transition-colors',
                  canRaise && raiseReason ? 'bg-coral hover:bg-coral-deep' : 'bg-navy-light/20 cursor-not-allowed'
                )}
                style={{ fontFamily: 'var(--font-body)' }}
              >
                Guardar ajuste
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
