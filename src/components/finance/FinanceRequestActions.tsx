'use client'

import { useState } from 'react'
import { GraduationCap, RotateCcw, Loader2 } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { useToast } from '@/components/shared/Toast'
import { cn } from '@/lib/utils'
import type { FinanceRequestType } from '@/types/finance'

/**
 * Botones "Solicitar beca" / "Solicitar devolución" en el perfil del miembro.
 * Visibles para cualquier rol; los datos (grupos del miembro, pagos pagados)
 * se calculan para el miembro del perfil.
 */

type GroupOption = { group_id: string; group_name: string; plan_code: string | null }
type PaymentOption = { id: string; label: string }

const MIN_REASON = 20
const SELECT_CLS = 'w-full rounded-xl border border-outline bg-surface-low px-3 py-2.5 text-sm text-navy font-body outline-none focus:ring-1 focus:ring-coral/30 disabled:opacity-60'
const LABEL_CLS = 'block text-[12px] font-medium text-navy-light/70 font-body mb-1.5'

export function FinanceRequestActions({ memberId }: { memberId: string }) {
  const toast = useToast()
  const [openModal, setOpenModal] = useState<FinanceRequestType | null>(null)
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [payments, setPayments] = useState<PaymentOption[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  const [groupId, setGroupId] = useState('')
  const [paymentId, setPaymentId] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function loadData() {
    if (loadedFor === memberId || dataLoading) return
    setDataLoading(true)
    Promise.all([
      // Grupos del miembro (inscripciones activas) + grupos abiertos a matrícula.
      fetch(`/api/studies/eligibility?member_id=${memberId}`),
      fetch('/api/studies/groups'),
      fetch(`/api/finance/requests/payment-options?member_id=${memberId}`),
    ])
      .then(async ([e, g, p]) => {
        const enrolled: GroupOption[] = e.ok ? ((await e.json()).active_enrollments ?? []) : []
        const allGroups = g.ok ? ((await g.json()) as Array<{ id: string; name: string; status: string; plan: { code: string | null } | null }>) : []
        const open = allGroups
          .filter(gr => gr.status === 'open')
          .map(gr => ({ group_id: gr.id, group_name: gr.name, plan_code: gr.plan?.code ?? null }))
        // inscrito o por inscribirse, sin duplicados
        const seen = new Set(enrolled.map(x => x.group_id))
        setGroups([...enrolled, ...open.filter(o => !seen.has(o.group_id))])
        if (p.ok) setPayments(await p.json())
        setLoadedFor(memberId)
      })
      .catch(() => {})
      .finally(() => setDataLoading(false))
  }

  function open(type: FinanceRequestType) {
    setGroupId('')
    setPaymentId('')
    setAmount('')
    setReason('')
    setError('')
    setOpenModal(type)
    loadData()
  }

  const refundBlocked = openModal === 'refund' && !dataLoading && loadedFor === memberId && payments.length === 0

  async function submit() {
    if (reason.trim().length < MIN_REASON) {
      setError(`Contanos un poco más: la razón debe tener al menos ${MIN_REASON} caracteres.`)
      return
    }
    if (openModal === 'refund' && !paymentId) {
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
          request_type: openModal,
          study_group_id: openModal === 'scholarship' ? (groupId || null) : null,
          payment_id: openModal === 'refund' ? paymentId : null,
          amount: openModal === 'scholarship' && amount ? Number(amount) : null,
          reason: reason.trim(),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'No se pudo enviar la solicitud')
      }
      setOpenModal(null)
      toast('Solicitud enviada. El equipo de finanzas la revisará pronto.', 'success')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar la solicitud')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Beca y devolución deshabilitadas por ahora (próximamente). */}
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          disabled
          onClick={() => open('scholarship')}
          title="Próximamente"
          aria-label="Solicitar beca (próximamente)"
          className="inline-flex items-center gap-1.5 rounded-full bg-surface-low px-3.5 py-2 text-[13px] text-navy-light/50 font-body opacity-50 cursor-not-allowed"
        >
          <GraduationCap size={13} />
          Solicitar beca
          <span className="text-[10px]">· Próximamente</span>
        </button>
        <button
          type="button"
          disabled
          onClick={() => open('refund')}
          title="Próximamente"
          aria-label="Solicitar devolución (próximamente)"
          className="inline-flex items-center gap-1.5 rounded-full bg-surface-low px-3.5 py-2 text-[13px] text-navy-light/50 font-body opacity-50 cursor-not-allowed"
        >
          <RotateCcw size={13} />
          Solicitar devolución
          <span className="text-[10px]">· Próximamente</span>
        </button>
      </div>

      {openModal && (
        <Modal onClose={() => setOpenModal(null)} titleId="finance-request-title">
          <div className="p-6 space-y-4">
            <h2 id="finance-request-title" className="text-lg font-semibold text-navy font-display">
              {openModal === 'scholarship' ? 'Solicitar beca' : 'Solicitar devolución'}
            </h2>

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

                {openModal === 'scholarship' && (
                  <>
                    <div>
                      <label htmlFor="schol-group" className={LABEL_CLS}>Grupo de estudio</label>
                      <select id="schol-group" value={groupId} onChange={e => setGroupId(e.target.value)} className={SELECT_CLS}>
                        <option value="">Por definir</option>
                        {groups.map(g => (
                          <option key={g.group_id} value={g.group_id}>
                            {g.group_name}{g.plan_code ? ` (${g.plan_code})` : ''}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] text-navy-light/60 font-body">
                        Grupos donde está inscrito o con matrícula abierta.
                      </p>
                    </div>
                    <div>
                      <label htmlFor="schol-amount" className={LABEL_CLS}>Monto solicitado (opcional, ₡)</label>
                      <input
                        id="schol-amount"
                        type="number"
                        min={0}
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        placeholder="Ej: 15000"
                        className={cn(SELECT_CLS, 'placeholder:text-navy-light/50')}
                      />
                    </div>
                  </>
                )}

                {openModal === 'refund' && !refundBlocked && (
                  <div>
                    <label htmlFor="refund-payment" className={LABEL_CLS}>Pago a devolver <span className="text-coral">*</span></label>
                    <select id="refund-payment" value={paymentId} onChange={e => setPaymentId(e.target.value)} className={SELECT_CLS}>
                      <option value="">Seleccionar pago…</option>
                      {payments.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </div>
                )}

                {!refundBlocked && (
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
                )}

                {error && <p className="text-[13px] text-coral font-body">{error}</p>}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setOpenModal(null)}
                    className="rounded-full px-4 py-2 text-sm text-navy-light/70 font-body hover:text-navy transition-colors"
                  >
                    {refundBlocked ? 'Cerrar' : 'Cancelar'}
                  </button>
                  {!refundBlocked && (
                    <button
                      onClick={submit}
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
