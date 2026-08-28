'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Image as ImageIcon } from 'lucide-react'
import { FinanceGuard } from '@/components/finance/FinanceGuard'
import { AmountDisplay } from '@/components/finance/AmountDisplay'
import { PaymentMethodBadge } from '@/components/finance/PaymentMethodBadge'
import { PaymentStatusBadge } from '@/components/finance/PaymentStatusBadge'
import { RefundModal } from '@/components/finance/RefundModal'
import { type Payment } from '@/types/finance'
import { useFinance } from '@/hooks/useFinance'
import { formatDate, formatDateTime } from '@/lib/format'

export default function PagoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { payments, refunds, refetch, loading } = useFinance('payments', 'refunds')
  const [payment, setPayment] = useState<Payment | null>(null)
  useEffect(() => { setPayment(payments.find(p => p.id === id) ?? null) }, [payments, id])
  const [showRefund, setShowRefund] = useState(false)
  const [toast, setToast] = useState('')

  const [abriendo, setAbriendo] = useState(false)

  /** Abre el comprobante en otra pestaña con una URL firmada de corta duración. */
  async function verComprobante() {
    setAbriendo(true)
    try {
      const res = await fetch(`/api/payments/${id}/receipt`)
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.url) throw new Error(data?.error || 'No se pudo abrir el comprobante.')
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo abrir el comprobante.')
    } finally {
      setAbriendo(false)
    }
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  if (!payment) {
    return (
      <FinanceGuard>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          {loading ? (
            <>
              <div className="h-7 w-7 rounded-full border-2 border-navy-light/20 border-t-coral animate-spin" />
              <p className="text-sm text-navy-light/80 font-body">Cargando pago…</p>
            </>
          ) : (
            <>
              <p className="text-xl font-bold font-display text-navy">Pago no encontrado</p>
              <Link href="/finanzas/pagos" className="text-sm text-teal-deep font-body">
                ← Volver a pagos
              </Link>
            </>
          )}
        </div>
      </FinanceGuard>
    )
  }

  async function handleRefund(data: { type: 'full' | 'partial'; amount: number; reason: string }) {
    if (!payment) return
    setShowRefund(false)
    try {
      const res = await fetch('/api/finance/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_id: payment.id,
          member_id: payment.member_id || null,
          amount: data.amount,
          method: payment.method,
          reason: data.reason || null,
          sinpe_pending: payment.method === 'sinpe',
        }),
      })
      if (!res.ok) throw new Error()
      await refetch()
      showToast('Solicitud de devolución creada')
    } catch {
      showToast('Error al crear la devolución')
    }
  }

  const isRefundable = payment.status === 'paid'
  const isRefunded = payment.status === 'refunded' || payment.status === 'partial_refund'

  return (
    <FinanceGuard>
      <div className="space-y-6">

        {/* Header */}
        <div
          className="rounded-2xl px-6 py-5 bg-navy shadow-[var(--shadow-md)]"
        >
          <div className="flex items-center gap-3 mb-4">
            <Link href="/finanzas/pagos" className="h-9 w-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/10 text-[rgba(255,255,255,0.60)]">
              <ArrowLeft size={18} />
            </Link>
            <span className="text-[13px] text-[rgba(255,255,255,0.70)] font-body">
              Pagos / Detalle
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl text-white mb-1 font-display font-extrabold tracking-[-0.02em]">
                {payment.entity_name}
              </h1>
              <p className="text-[14px] text-white/80 font-body">
                {payment.member_id ? (
                  <Link href={`/miembros/${payment.member_id}`} className="hover:text-coral transition-colors underline decoration-dotted underline-offset-2">
                    {payment.member_name}
                  </Link>
                ) : payment.member_name}
              </p>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-2">
              <p className="text-3xl font-extrabold text-white font-display">
                <AmountDisplay amount={payment.amount} currency={payment.currency} defaultHidden={false} />
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
          <div className="rounded-2xl p-6 space-y-4 bg-surface-card shadow-[var(--shadow-md)]">
            <p className="text-[13px] uppercase tracking-widest font-display text-[rgba(22,20,64,0.60)]">
              Información del pago
            </p>
            {[
              { label: 'Miembro', value: payment.member_name },
              { label: 'Cédula', value: payment.member_cedula },
              { label: 'Entidad', value: payment.entity_name },
              { label: 'Tipo', value: payment.entity_type === 'event' ? 'Evento' : 'Grupo de estudio' },
              { label: 'Creado', value: formatDateTime(payment.created_at) },
              { label: 'Pagado', value: formatDateTime(payment.paid_at) },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm gap-4">
                <span className="font-body text-[rgba(22,20,64,0.60)]">{label}</span>
                <span className="font-medium text-right font-body text-navy">{value}</span>
              </div>
            ))}
          </div>

          {/* Right */}
          <div className="rounded-2xl p-6 space-y-4 bg-surface-card shadow-[var(--shadow-md)]">
            <p className="text-[13px] uppercase tracking-widest font-display text-[rgba(22,20,64,0.60)]">
              Detalles de la transacción
            </p>
            {payment.gateway_ref && (
              <div className="flex justify-between text-sm gap-4">
                <span className="font-body text-[rgba(22,20,64,0.60)]">Ref. pasarela</span>
                <span className="font-medium font-mono text-right text-[13px] text-navy">{payment.gateway_ref}</span>
              </div>
            )}
            {payment.sinpe_confirmation && (
              <div className="flex justify-between text-sm gap-4">
                <span className="font-body text-[rgba(22,20,64,0.60)]">Confirmación SINPE</span>
                <span className="font-medium font-mono text-right text-[13px] text-teal-deep">{payment.sinpe_confirmation}</span>
              </div>
            )}
            {payment.reference_code && (
              <div className="flex justify-between text-sm gap-4">
                <span className="font-body text-[rgba(22,20,64,0.60)]">Referencia</span>
                <span className="font-medium font-mono text-right text-[13px] text-navy">{payment.reference_code}</span>
              </div>
            )}
            {/* EL COMPROBANTE. Faltaba en ESTA pantalla: la cola de revisión sí
                lo tenía, así que se veía como si existiera en el sistema, pero
                quien entraba al detalle de un pago no tenía cómo verlo — y es
                justo donde finanzas decide si aprueba. Reportado 2026-08-27.
                La URL se pide firmada al hacer clic: el bucket es privado y la
                firma dura dos minutos, así que no se guarda ni se precarga. */}
            <div className="pt-1">
              {payment.has_receipt ? (
                <button
                  onClick={verComprobante}
                  disabled={abriendo}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--outline-variant)] px-3 py-1.5 text-[13px] text-navy-light hover:bg-surface-low transition-colors font-body disabled:opacity-50"
                >
                  <ImageIcon size={13} aria-hidden="true" />
                  {abriendo ? 'Abriendo…' : 'Ver comprobante'}
                </button>
              ) : (
                <p className="text-[13px] text-navy-light/80 font-body">
                  Sin comprobante: la persona todavía no lo ha subido.
                </p>
              )}
            </div>
            {payment.scholarship_id && (
              <div className="rounded-xl p-3 bg-[rgba(61,185,122,0.08)] border border-[rgba(61,185,122,0.20)]">
                <p className="text-[13px] font-medium text-[#1E6B42] font-body">
                  Beca aplicada — ID: {payment.scholarship_id}
                </p>
              </div>
            )}
            {payment.notes && (
              <div className="rounded-xl p-3 bg-[rgba(22,20,64,0.04)] border border-[rgba(22,20,64,0.08)]">
                <p className="text-[13px] text-[rgba(22,20,64,0.65)] font-body">
                  {payment.notes}
                </p>
              </div>
            )}

          </div>
        </div>

        {/* Timeline */}
        <div className="rounded-2xl p-6 bg-surface-card shadow-[var(--shadow-md)]">
          <p className="text-[13px] uppercase tracking-widest mb-5 font-display text-[rgba(22,20,64,0.60)]">
            Línea de tiempo
          </p>
          <div className="relative">
            <div className="absolute left-3.5 top-3 bottom-3 w-0.5 bg-[rgba(22,20,64,0.10)]" />
            <div className="space-y-6">
              <TimelineItem
                label="Creado"
                date={formatDate(payment.created_at)}
                color="#161440"
                active
              />
              {payment.paid_at && (
                <TimelineItem
                  label="Pago confirmado"
                  date={formatDate(payment.paid_at)}
                  color="#3DB97A"
                  active
                />
              )}
              {isRefunded && (
                <TimelineItem
                  label={payment.status === 'refunded' ? 'Devuelto completamente' : 'Devolución parcial'}
                  date={formatDate(
                    // Fecha real del reembolso (processed_at de la devolución);
                    // antes se mostraba la fecha del PAGO.
                    refunds.find(r => r.payment_id === payment.id && r.status === 'completed')?.processed_at
                      ?? payment.paid_at,
                  )}
                  color="#3B7579"
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
              className="rounded-full px-6 py-2.5 text-sm text-white font-medium transition-all bg-coral font-body"
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
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm text-white bg-navy shadow-[0_12px_32px_rgba(22,20,64,0.20)] font-body">
          <Check size={15} className="text-[#3DB97A]" />
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
        <p className="text-sm font-medium font-body text-navy">{label}</p>
        <p className="text-[13px] text-[rgba(22,20,64,0.60)] font-body">{date}</p>
      </div>
    </div>
  )
}
