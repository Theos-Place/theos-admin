'use client'
import { useState } from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import type { PaymentMethod } from '@/types/finance'
import { Modal } from '@/components/shared/Modal'
import { AmountDisplay } from './AmountDisplay'
import { formatCRC } from '@/lib/format'

interface RefundModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: { type: 'full' | 'partial'; amount: number; reason: string; reasonDetail: string }) => void
  payment: {
    member_name: string
    entity_name: string
    amount: number
    /** INT-2: moneda del pago (la devolución la hereda en BD). */
    currency?: string
    method: PaymentMethod
  }
}

const REASONS = [
  'Cancelación de evento',
  'Solicitud del miembro',
  'Error de cobro',
  'Otro',
]

export function RefundModal({ isOpen, onClose, onConfirm, payment }: RefundModalProps) {
  const [type, setType] = useState<'full' | 'partial'>('full')
  const [partialAmount, setPartialAmount] = useState('')
  const [reason, setReason] = useState(REASONS[0])
  const [reasonDetail, setReasonDetail] = useState('')

  if (!isOpen) return null

  const effectiveAmount = type === 'full'
    ? payment.amount
    : Math.min(Number(partialAmount) || 0, payment.amount)

  const isSinpe = payment.method === 'sinpe'

  function handleConfirm() {
    if (type === 'partial' && (!partialAmount || Number(partialAmount) <= 0)) return
    onConfirm({ type, amount: effectiveAmount, reason, reasonDetail })
  }

  return (
    <Modal onClose={onClose} titleId="solicitar-devolucion" width={448}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--outline-variant)]">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-[rgba(239,85,84,0.10)]">
              <AlertTriangle size={17} className="text-coral" />
            </div>
            <div>
              <p id="solicitar-devolucion" className="text-sm font-bold font-display text-navy">
                Solicitar devolución
              </p>
              <p className="text-[13px] font-body text-[rgba(22,20,64,0.45)]">
                {payment.member_name}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">

          {/* Summary */}
          <div className="rounded-xl p-4 space-y-2 bg-[rgba(22,20,64,0.03)] border border-[rgba(22,20,64,0.08)]">
            <div className="flex justify-between text-[13px] font-body">
              <span className="text-[rgba(22,20,64,0.55)]">Concepto</span>
              <span className="text-navy font-medium">{payment.entity_name}</span>
            </div>
            <div className="flex justify-between text-[13px] font-body">
              <span className="text-[rgba(22,20,64,0.55)]">Monto pagado</span>
              <span className="text-navy font-medium">
                <AmountDisplay amount={payment.amount} currency={payment.currency} defaultHidden={false} />
              </span>
            </div>
          </div>

          {/* Type */}
          <div>
            <p className="text-[13px] uppercase tracking-widest mb-2 font-display text-[rgba(22,20,64,0.60)]">
              Tipo de devolución
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(['full', 'partial'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className="rounded-xl p-3 text-sm font-medium border transition-all text-left font-body"
                  style={{
                    borderColor: type === t ? '#D63E3D' : 'var(--outline-variant)',
                    background: type === t ? 'rgba(239,85,84,0.05)' : 'var(--surface-low)',
                    color: type === t ? '#D63E3D' : 'rgba(22,20,64,0.70)',
                  }}
                >
                  {t === 'full' ? 'Devolución completa' : 'Devolución parcial'}
                </button>
              ))}
            </div>
          </div>

          {/* Partial amount input */}
          {type === 'partial' && (
            <div>
              <label className="text-[13px] uppercase tracking-widest mb-1.5 block font-display text-[rgba(22,20,64,0.60)]">
                Monto a devolver (₡)
              </label>
              <input
                type="number"
                min={1}
                max={payment.amount}
                value={partialAmount}
                onChange={e => setPartialAmount(e.target.value)}
                placeholder={`Máx. ${formatCRC(payment.amount)}`}
                className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none border-[var(--outline-variant)] font-body text-navy"
              />
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="text-[13px] uppercase tracking-widest mb-1.5 block font-display text-[rgba(22,20,64,0.60)]">
              Motivo
            </label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none border-[var(--outline-variant)] font-body text-navy"
            >
              {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {reason === 'Otro' && (
            <textarea
              value={reasonDetail}
              onChange={e => setReasonDetail(e.target.value)}
              placeholder="Describí el motivo..."
              rows={3}
              className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none resize-none border-[var(--outline-variant)] font-body text-navy"
            />
          )}

          {/* SINPE / Card notice */}
          <div
            className="flex items-start gap-2.5 rounded-xl p-3.5"
            style={{
              background: isSinpe ? 'rgba(233,185,73,0.10)' : 'rgba(61,185,122,0.08)',
              border: `1px solid ${isSinpe ? 'rgba(233,185,73,0.25)' : 'rgba(61,185,122,0.20)'}`,
            }}
          >
            <Info size={15} className="mt-px shrink-0" style={{ color: isSinpe ? '#E9B949' : '#3DB97A' }} />
            <p className="text-[13px] leading-relaxed font-body" style={{ color: isSinpe ? '#9B7200' : '#1E6B42' }}>
              {isSinpe
                ? 'Este pago fue por SINPE. La devolución requiere procesamiento manual — el equipo de finanzas coordinará la transferencia.'
                : 'Este pago fue por tarjeta y se procesará automáticamente a través de la pasarela de pago.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex gap-3 border-[var(--outline-variant)]">
          <button
            onClick={onClose}
            className="flex-1 rounded-full border py-2.5 text-sm transition-colors border-[var(--outline-variant)] font-body text-[rgba(22,20,64,0.70)]"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={type === 'partial' && (!partialAmount || Number(partialAmount) <= 0)}
            className="flex-1 rounded-full py-2.5 text-sm text-white transition-colors bg-coral font-body disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {/* Siempre crea una SOLICITUD pendiente — "Procesar automáticamente" prometía de más. */}
            Crear solicitud de devolución
          </button>
        </div>
    </Modal>
  )
}
