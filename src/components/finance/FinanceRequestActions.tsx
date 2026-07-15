'use client'

import { useState } from 'react'
import { GraduationCap, RotateCcw, Loader2 } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { useToast } from '@/components/shared/Toast'
import { ScholarshipRequestModal } from '@/components/finance/ScholarshipRequestModal'
import { cn } from '@/lib/utils'

/**
 * Botones "Solicitar beca" / "Solicitar devolución" en el perfil del miembro.
 * Visibles para cualquier rol; los datos (pagos pagados) se calculan para el
 * miembro del perfil. La devolución sigue deshabilitada (próximamente); la
 * beca abre ScholarshipRequestModal (destino a elegir: estudio o evento).
 */

type PaymentOption = { id: string; label: string }

const MIN_REASON = 20
const SELECT_CLS = 'w-full rounded-xl border border-outline bg-surface-low px-3 py-2.5 text-sm text-navy font-body outline-none focus:ring-1 focus:ring-coral/30 disabled:opacity-60'
const LABEL_CLS = 'block text-[12px] font-medium text-navy-light/70 font-body mb-1.5'

export function FinanceRequestActions({ memberId }: { memberId: string }) {
  const toast = useToast()
  const [showScholarshipModal, setShowScholarshipModal] = useState(false)
  const [openRefund, setOpenRefund] = useState(false)
  const [payments, setPayments] = useState<PaymentOption[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  const [paymentId, setPaymentId] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function loadData() {
    if (loadedFor === memberId || dataLoading) return
    setDataLoading(true)
    fetch(`/api/finance/requests/payment-options?member_id=${memberId}`)
      .then(async p => { if (p.ok) setPayments(await p.json()); setLoadedFor(memberId) })
      .catch(() => {})
      .finally(() => setDataLoading(false))
  }

  function openRefundModal() {
    setPaymentId('')
    setReason('')
    setError('')
    setOpenRefund(true)
    loadData()
  }

  const refundBlocked = !dataLoading && loadedFor === memberId && payments.length === 0

  async function submitRefund() {
    if (reason.trim().length < MIN_REASON) {
      setError(`Contanos un poco más: la razón debe tener al menos ${MIN_REASON} caracteres.`)
      return
    }
    if (!paymentId) {
      setError('Seleccioná el pago a devolver.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/finance/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: memberId,
          request_type: 'refund',
          payment_id: paymentId,
          reason: reason.trim(),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'No se pudo enviar la solicitud')
      }
      setOpenRefund(false)
      toast('Solicitud enviada. El equipo de finanzas la revisará pronto.', 'success')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar la solicitud')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setShowScholarshipModal(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-coral/10 px-3.5 py-2 text-[13px] text-coral font-body hover:bg-coral/20 transition-colors"
        >
          <GraduationCap size={13} />
          Solicitar beca
        </button>
        {/* Devolución deshabilitada por ahora (próximamente). */}
        <button
          type="button"
          disabled
          onClick={openRefundModal}
          title="Próximamente"
          aria-label="Solicitar devolución (próximamente)"
          className="inline-flex items-center gap-1.5 rounded-full bg-surface-low px-3.5 py-2 text-[13px] text-navy-light/50 font-body opacity-50 cursor-not-allowed"
        >
          <RotateCcw size={13} />
          Solicitar devolución
          <span className="text-[10px]">· Próximamente</span>
        </button>
      </div>

      {showScholarshipModal && (
        <ScholarshipRequestModal memberId={memberId} onClose={() => setShowScholarshipModal(false)} />
      )}

      {openRefund && (
        <Modal onClose={() => setOpenRefund(false)} titleId="finance-request-title">
          <div className="p-6 space-y-4">
            <h2 id="finance-request-title" className="text-lg font-semibold text-navy font-display">Solicitar devolución</h2>

            {dataLoading || loadedFor !== memberId ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={18} className="animate-spin text-navy-light/60" />
              </div>
            ) : (
              <>
                {refundBlocked && (
                  <div className="rounded-xl bg-coral/7 border border-coral/20 px-4 py-3">
                    <p className="text-[13px] text-coral font-body">
                      No hay pagos registrados a tu nombre para solicitar una devolución.
                    </p>
                  </div>
                )}

                {!refundBlocked && (
                  <>
                    <div>
                      <label htmlFor="refund-payment" className={LABEL_CLS}>Pago a devolver <span className="text-coral">*</span></label>
                      <select id="refund-payment" value={paymentId} onChange={e => setPaymentId(e.target.value)} className={SELECT_CLS}>
                        <option value="">Seleccionar pago…</option>
                        {payments.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="finance-reason" className={LABEL_CLS}>
                        Razón <span className="text-coral">*</span>
                      </label>
                      <textarea
                        id="finance-reason"
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        rows={3}
                        placeholder="Contanos por qué (mínimo 20 caracteres)…"
                        className={cn(SELECT_CLS, 'resize-none placeholder:text-navy-light/50')}
                      />
                      <p className={cn('mt-1 text-[11px] font-body', reason.trim().length < MIN_REASON ? 'text-navy-light/60' : 'text-success')}>
                        {reason.trim().length}/{MIN_REASON} caracteres mínimos
                      </p>
                    </div>
                  </>
                )}

                {error && <p className="text-[13px] text-coral font-body">{error}</p>}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setOpenRefund(false)}
                    className="rounded-full px-4 py-2 text-sm text-navy-light/70 font-body hover:text-navy transition-colors"
                  >
                    {refundBlocked ? 'Cerrar' : 'Cancelar'}
                  </button>
                  {!refundBlocked && (
                    <button
                      onClick={submitRefund}
                      disabled={submitting}
                      className="rounded-full bg-coral px-5 py-2 text-sm text-white font-body font-medium hover:bg-coral-deep transition-colors disabled:opacity-60"
                    >
                      {submitting ? 'Enviando…' : 'Enviar solicitud'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
