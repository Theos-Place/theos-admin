'use client'
import { useState } from 'react'
import { X, AlertTriangle, Info } from 'lucide-react'
import type { PaymentMethod } from '@/data/mock-finance'
import { AmountDisplay } from './AmountDisplay'

interface RefundModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: { type: 'full' | 'partial'; amount: number; reason: string; reasonDetail: string }) => void
  payment: {
    member_name: string
    entity_name: string
    amount: number
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(22,20,64,0.40)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-lg)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--outline-variant)' }}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,85,84,0.10)' }}>
              <AlertTriangle size={17} style={{ color: '#EF5554' }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: '#161440' }}>
                Solicitar devolución
              </p>
              <p className="text-[11px]" style={{ fontFamily: 'var(--font-body)', color: 'rgba(22,20,64,0.45)' }}>
                {payment.member_name}
              </p>
            </div>
          </div>
          <button onClick={onClose}>
            <X size={18} style={{ color: 'rgba(22,20,64,0.40)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">

          {/* Summary */}
          <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(22,20,64,0.03)', border: '1px solid rgba(22,20,64,0.08)' }}>
            <div className="flex justify-between text-[13px]" style={{ fontFamily: 'var(--font-body)' }}>
              <span style={{ color: 'rgba(22,20,64,0.55)' }}>Concepto</span>
              <span style={{ color: '#161440' }} className="font-medium">{payment.entity_name}</span>
            </div>
            <div className="flex justify-between text-[13px]" style={{ fontFamily: 'var(--font-body)' }}>
              <span style={{ color: 'rgba(22,20,64,0.55)' }}>Monto pagado</span>
              <span style={{ color: '#161440' }} className="font-medium">
                <AmountDisplay amount={payment.amount} defaultHidden={false} />
              </span>
            </div>
          </div>

          {/* Type */}
          <div>
            <p className="text-[11px] uppercase tracking-widest mb-2" style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>
              Tipo de devolución
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(['full', 'partial'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className="rounded-xl p-3 text-sm font-medium border transition-all text-left"
                  style={{
                    borderColor: type === t ? '#EF5554' : 'var(--outline-variant)',
                    background: type === t ? 'rgba(239,85,84,0.05)' : 'var(--surface-low)',
                    color: type === t ? '#EF5554' : 'rgba(22,20,64,0.70)',
                    fontFamily: 'var(--font-body)',
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
              <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>
                Monto a devolver (₡)
              </label>
              <input
                type="number"
                min={1}
                max={payment.amount}
                value={partialAmount}
                onChange={e => setPartialAmount(e.target.value)}
                placeholder={`Máx. ₡${payment.amount.toLocaleString('es-CR')}`}
                className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none"
                style={{
                  borderColor: 'var(--outline-variant)',
                  fontFamily: 'var(--font-body)',
                  color: '#161440',
                }}
              />
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>
              Motivo
            </label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none"
              style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)', color: '#161440' }}
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
              className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none resize-none"
              style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)', color: '#161440' }}
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
            <Info size={15} style={{ color: isSinpe ? '#E9B949' : '#3DB97A', marginTop: 1, flexShrink: 0 }} />
            <p className="text-[12px] leading-relaxed" style={{ fontFamily: 'var(--font-body)', color: isSinpe ? '#9B7200' : '#1E6B42' }}>
              {isSinpe
                ? 'Este pago fue por SINPE. La devolución requiere procesamiento manual — el equipo de finanzas coordinará la transferencia.'
                : 'Este pago fue por tarjeta y se procesará automáticamente a través de la pasarela de pago.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex gap-3" style={{ borderColor: 'var(--outline-variant)' }}>
          <button
            onClick={onClose}
            className="flex-1 rounded-full border py-2.5 text-sm transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)', color: 'rgba(22,20,64,0.70)' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 rounded-full py-2.5 text-sm text-white transition-colors"
            style={{ background: '#EF5554', fontFamily: 'var(--font-body)' }}
          >
            {isSinpe ? 'Crear solicitud' : 'Procesar automáticamente'}
          </button>
        </div>
      </div>
    </div>
  )
}
