'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check } from 'lucide-react'
import { FinanceGuard } from '@/components/finance/FinanceGuard'
import { AmountDisplay } from '@/components/finance/AmountDisplay'
import { PaymentMethodBadge } from '@/components/finance/PaymentMethodBadge'
import { PaymentStatusBadge } from '@/components/finance/PaymentStatusBadge'
import { RefundModal } from '@/components/finance/RefundModal'
import { type Payment } from '@/data/mock-finance'
import { useFinance } from '@/hooks/useFinance'

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function formatDateShort(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PagoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { payments } = useFinance()
  const [payment, setPayment] = useState<Payment | null>(null)
  useEffect(() => { setPayment(payments.find(p => p.id === id) ?? null) }, [payments, id])
  const [showRefund, setShowRefund] = useState(false)
  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  if (!payment) {
    return (
      <FinanceGuard>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <p className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)', color: '#161440' }}>Pago no encontrado</p>
          <Link href="/finanzas/pagos" className="text-sm" style={{ color: '#519DA2', fontFamily: 'var(--font-body)' }}>
            ← Volver a pagos
          </Link>
        </div>
      </FinanceGuard>
    )
  }

  function handleRefund(data: { type: 'full' | 'partial'; amount: number; reason: string }) {
    setPayment(prev => prev
      ? { ...prev, status: data.type === 'full' ? 'refunded' : 'partial_refund' }
      : prev
    )
    setShowRefund(false)
    showToast('Solicitud de devolución creada')
  }

  const isRefundable = payment.status === 'paid'
  const isRefunded = payment.status === 'refunded' || payment.status === 'partial_refund'

  return (
    <FinanceGuard>
      <div className="space-y-6">

        {/* Header */}
        <div
          className="rounded-2xl px-6 py-5"
          style={{ background: '#161440', boxShadow: 'var(--shadow-md)' }}
        >
          <div className="flex items-center gap-3 mb-4">
            <Link href="/finanzas/pagos" className="h-9 w-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.60)' }}>
              <ArrowLeft size={18} />
            </Link>
            <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.50)', fontFamily: 'var(--font-body)' }}>
              Pagos / Detalle
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl text-white mb-1" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}>
                {payment.entity_name}
              </h1>
              <p className="text-[14px] text-white/60" style={{ fontFamily: 'var(--font-body)' }}>
                {payment.member_name}
              </p>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-2">
              <p className="text-3xl font-extrabold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                <AmountDisplay amount={payment.amount} defaultHidden={false} />
              </p>
              <div className="flex items-center gap-2">
                <PaymentMethodBadge method={payment.method} />
                <PaymentStatusBadge status={payment.status} />
              </div>
            </div>
          </div>
        </div>

        {/* Two-column info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left */}
          <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <p className="text-[11px] uppercase tracking-widest" style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>
              Información del pago
            </p>
            {[
              { label: 'Miembro', value: payment.member_name },
              { label: 'Cédula', value: payment.member_cedula },
              { label: 'Entidad', value: payment.entity_name },
              { label: 'Tipo', value: payment.entity_type === 'event' ? 'Evento' : 'Grupo de estudio' },
              { label: 'Creado', value: formatDate(payment.created_at) },
              { label: 'Pagado', value: formatDate(payment.paid_at) },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm gap-4">
                <span style={{ fontFamily: 'var(--font-body)', color: 'rgba(22,20,64,0.50)' }}>{label}</span>
                <span className="font-medium text-right" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Right */}
          <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <p className="text-[11px] uppercase tracking-widest" style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>
              Detalles de la transacción
            </p>
            {payment.gateway_ref && (
              <div className="flex justify-between text-sm gap-4">
                <span style={{ fontFamily: 'var(--font-body)', color: 'rgba(22,20,64,0.50)' }}>Ref. pasarela</span>
                <span className="font-medium font-mono text-right text-[12px]" style={{ color: '#161440' }}>{payment.gateway_ref}</span>
              </div>
            )}
            {payment.sinpe_confirmation && (
              <div className="flex justify-between text-sm gap-4">
                <span style={{ fontFamily: 'var(--font-body)', color: 'rgba(22,20,64,0.50)' }}>Confirmación SINPE</span>
                <span className="font-medium font-mono text-right text-[12px]" style={{ color: '#519DA2' }}>{payment.sinpe_confirmation}</span>
              </div>
            )}
            {payment.scholarship_id && (
              <div className="rounded-xl p-3" style={{ background: 'rgba(61,185,122,0.08)', border: '1px solid rgba(61,185,122,0.20)' }}>
                <p className="text-[12px] font-medium" style={{ color: '#1E6B42', fontFamily: 'var(--font-body)' }}>
                  Beca aplicada — ID: {payment.scholarship_id}
                </p>
              </div>
            )}
            {payment.notes && (
              <div className="rounded-xl p-3" style={{ background: 'rgba(22,20,64,0.04)', border: '1px solid rgba(22,20,64,0.08)' }}>
                <p className="text-[12px]" style={{ color: 'rgba(22,20,64,0.65)', fontFamily: 'var(--font-body)' }}>
                  {payment.notes}
                </p>
              </div>
            )}
            {!payment.gateway_ref && !payment.sinpe_confirmation && !payment.scholarship_id && !payment.notes && (
              <p className="text-sm" style={{ color: 'rgba(22,20,64,0.35)', fontFamily: 'var(--font-body)' }}>
                Sin detalles adicionales
              </p>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="rounded-2xl p-6" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
          <p className="text-[11px] uppercase tracking-widests mb-5" style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>
            Línea de tiempo
          </p>
          <div className="relative">
            <div className="absolute left-3.5 top-3 bottom-3 w-0.5" style={{ background: 'rgba(22,20,64,0.10)' }} />
            <div className="space-y-6">
              <TimelineItem
                label="Creado"
                date={formatDateShort(payment.created_at)}
                color="#161440"
                active
              />
              {payment.paid_at && (
                <TimelineItem
                  label="Pago confirmado"
                  date={formatDateShort(payment.paid_at)}
                  color="#3DB97A"
                  active
                />
              )}
              {isRefunded && (
                <TimelineItem
                  label={payment.status === 'refunded' ? 'Devuelto completamente' : 'Devolución parcial'}
                  date={formatDateShort(payment.paid_at)}
                  color="#519DA2"
                  active
                />
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        {isRefundable && (
          <div className="flex justify-end">
            <button
              onClick={() => setShowRefund(true)}
              className="rounded-full px-6 py-2.5 text-sm text-white font-medium transition-all"
              style={{ background: '#EF5554', fontFamily: 'var(--font-body)' }}
            >
              Procesar devolución
            </button>
          </div>
        )}
      </div>

      {showRefund && (
        <RefundModal
          isOpen
          onClose={() => setShowRefund(false)}
          onConfirm={handleRefund}
          payment={payment}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm text-white"
          style={{ background: '#161440', boxShadow: '0 12px 32px rgba(22,20,64,0.20)', fontFamily: 'var(--font-body)' }}>
          <Check size={15} style={{ color: '#3DB97A' }} />
          {toast}
        </div>
      )}
    </FinanceGuard>
  )
}

function TimelineItem({ label, date, color, active }: { label: string; date: string; color: string; active: boolean }) {
  return (
    <div className="flex items-start gap-4 relative">
      <div
        className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 relative z-10"
        style={{ background: active ? color : 'rgba(22,20,64,0.10)', border: `2px solid ${active ? color : 'rgba(22,20,64,0.15)'}` }}
      >
        {active && <Check size={12} className="text-white" />}
      </div>
      <div className="pt-0.5">
        <p className="text-sm font-medium" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>{label}</p>
        <p className="text-[12px]" style={{ color: 'rgba(22,20,64,0.50)', fontFamily: 'var(--font-body)' }}>{date}</p>
      </div>
    </div>
  )
}
