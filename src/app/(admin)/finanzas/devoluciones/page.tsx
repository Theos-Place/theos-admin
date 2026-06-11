'use client'

import { useState, useMemo, useEffect } from 'react'
import { ArrowLeftRight, Check } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { FinanceGuard } from '@/components/finance/FinanceGuard'
import { AmountDisplay } from '@/components/finance/AmountDisplay'
import { PaymentMethodBadge } from '@/components/finance/PaymentMethodBadge'
import { type Refund, type RefundStatus } from '@/types/finance'
import { useFinance } from '@/hooks/useFinance'
import { TOAST_MS } from '@/lib/constants'

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function RefundStatusBadge({ status }: { status: RefundStatus }) {
  const cfg: Record<RefundStatus, { label: string; color: string; bg: string }> = {
    pending:    { label: 'Pendiente',   color: '#E9B949', bg: 'rgba(233,185,73,0.15)'  },
    processing: { label: 'En proceso',  color: '#519DA2', bg: 'rgba(81,157,162,0.12)'  },
    completed:  { label: 'Completada',  color: '#3DB97A', bg: 'rgba(61,185,122,0.12)'  },
    rejected:   { label: 'Rechazada',   color: '#EF5554', bg: 'rgba(239,85,84,0.10)'   },
  }
  const c = cfg[status]
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{ color: c.color, background: c.bg }}>
      {c.label}
    </span>
  )
}

export default function DevolucionesPage() {
  const { refunds: allRefunds, refetch } = useFinance()
  const [refunds, setRefunds] = useState<Refund[]>([])
  useEffect(() => { setRefunds(allRefunds) }, [allRefunds])
  const [completeTarget, setCompleteTarget] = useState<Refund | null>(null)
  const [rejectTarget, setRejectTarget] = useState<Refund | null>(null)
  const [completionDate, setCompletionDate] = useState('')
  const [completionConf, setCompletionConf] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), TOAST_MS)
  }

  const cardRefunds = refunds.filter(r => r.method === 'card')
  const sinpeRefunds = refunds.filter(r => r.method === 'sinpe')

  const stats = useMemo(() => ({
    pending:    refunds.filter(r => r.status === 'pending').length,
    processing: refunds.filter(r => r.status === 'processing').length,
    completed:  refunds.filter(r => r.status === 'completed').length,
    totalAmount: refunds.filter(r => r.status === 'completed').reduce((s, r) => s + r.amount, 0),
  }), [refunds])

  async function handleComplete() {
    if (!completeTarget) return
    const target = completeTarget
    setCompleteTarget(null)
    setCompletionDate('')
    setCompletionConf('')
    try {
      const res = await fetch(`/api/finance/refunds/${target.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })
      if (!res.ok) throw new Error()
      await refetch()
      showToast(`Devolución completada para ${target.member_name}`)
    } catch {
      showToast('Error al completar la devolución')
    }
  }

  async function handleReject() {
    if (!rejectTarget) return
    const target = rejectTarget
    setRejectTarget(null)
    setRejectReason('')
    try {
      const res = await fetch(`/api/finance/refunds/${target.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      })
      if (!res.ok) throw new Error()
      await refetch()
      showToast(`Devolución rechazada para ${target.member_name}`)
    } catch {
      showToast('Error al rechazar la devolución')
    }
  }

  return (
    <FinanceGuard>
      <div className="space-y-6">

        {/* Header */}
        <div
          className="rounded-2xl px-6 py-5 flex items-center gap-3 bg-navy shadow-[var(--shadow-md)]"
        >
          <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-[rgba(255,255,255,0.10)]">
            <ArrowLeftRight size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl text-white font-display font-extrabold tracking-[-0.02em]">Devoluciones</h1>
            <p className="text-[12px] text-white/50 mt-0.5 font-body">
              Gestión de reembolsos y devoluciones
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Pendientes',    value: stats.pending,    color: '#E9B949' },
            { label: 'En proceso',    value: stats.processing, color: '#519DA2' },
            { label: 'Completadas',   value: stats.completed,  color: '#3DB97A' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)]">
              <p className="text-[10px] uppercase tracking-widests mb-2 font-display text-[rgba(22,20,64,0.40)]">{label}</p>
              <p className="text-4xl font-extrabold font-display" style={{ color }}>{value}</p>
            </div>
          ))}
          <div className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)]">
            <p className="text-[10px] uppercase tracking-widests mb-2 font-display text-[rgba(22,20,64,0.40)]">Total devuelto</p>
            <p className="text-xl font-extrabold font-display text-navy">
              <AmountDisplay amount={stats.totalAmount} defaultHidden={false} />
            </p>
          </div>
        </div>

        {/* Section A — Card (automatic) */}
        <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--outline-variant)]">
            <p className="text-sm font-bold font-display text-navy">
              Automáticas — Tarjeta
            </p>
            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium bg-[rgba(112,189,194,0.15)] text-teal-deep">
              Procesadas por pasarela
            </span>
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--outline-variant)]">
                  {['Miembro', 'Concepto', 'Monto', 'Estado', 'Solicitada', 'Procesada'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] uppercase tracking-widests font-display text-[rgba(22,20,64,0.40)]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cardRefunds.map((r, i) => (
                  <tr key={r.id} className={`border-b border-[var(--outline-variant)] hover:bg-gray-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-[rgba(22,20,64,0.01)]'}`}>
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-medium font-body text-navy">{r.member_name}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-body text-navy">{r.entity_name}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-medium font-body text-navy">
                        <AmountDisplay amount={r.amount} defaultHidden={false} />
                      </p>
                    </td>
                    <td className="px-5 py-3.5"><RefundStatusBadge status={r.status} /></td>
                    <td className="px-5 py-3.5">
                      <p className="text-[12px] whitespace-nowrap text-[rgba(22,20,64,0.55)] font-body">{formatDate(r.requested_at)}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[12px] whitespace-nowrap text-[rgba(22,20,64,0.55)] font-body">{formatDate(r.processed_at)}</p>
                    </td>
                  </tr>
                ))}
                {cardRefunds.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-[rgba(22,20,64,0.35)] font-body">Sin devoluciones por tarjeta</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile: tarjetas */}
          <ul className="md:hidden">
            {cardRefunds.map((r, i) => (
              <li
                key={r.id}
                className="px-4 py-3 flex items-center gap-3"
                style={i < cardRefunds.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium font-body text-navy truncate">{r.member_name}</p>
                  <p className="text-[12px] text-[rgba(22,20,64,0.55)] font-body truncate">{r.entity_name}</p>
                  <p className="text-[11px] text-[rgba(22,20,64,0.45)] font-body mt-0.5">Solicitada {formatDate(r.requested_at)}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <p className="text-[13px] font-medium font-body text-navy">
                    <AmountDisplay amount={r.amount} defaultHidden={false} />
                  </p>
                  <RefundStatusBadge status={r.status} />
                </div>
              </li>
            ))}
            {cardRefunds.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-[rgba(22,20,64,0.35)] font-body">Sin devoluciones por tarjeta</li>
            )}
          </ul>
        </div>

        {/* Section B — SINPE (manual) */}
        <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--outline-variant)]">
            <p className="text-sm font-bold font-display text-navy">
              Manuales — SINPE
            </p>
            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium bg-[rgba(239,85,84,0.10)] text-coral">
              Requieren proceso manual
            </span>
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--outline-variant)]">
                  {['Miembro', 'Concepto', 'Monto', 'Motivo', 'Estado', 'Solicitada', 'Acciones'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] uppercase tracking-widests font-display text-[rgba(22,20,64,0.40)]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sinpeRefunds.map((r, i) => (
                  <tr key={r.id} className={`border-b border-[var(--outline-variant)] hover:bg-gray-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-[rgba(22,20,64,0.01)]'}`}>
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-medium font-body text-navy">{r.member_name}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-body text-navy">{r.entity_name}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-medium font-body text-navy">
                        <AmountDisplay amount={r.amount} defaultHidden={false} />
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[12px] text-[rgba(22,20,64,0.60)] font-body">{r.reason}</p>
                    </td>
                    <td className="px-5 py-3.5"><RefundStatusBadge status={r.status} /></td>
                    <td className="px-5 py-3.5">
                      <p className="text-[12px] whitespace-nowrap text-[rgba(22,20,64,0.55)] font-body">{formatDate(r.requested_at)}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      {(r.status === 'pending' || r.status === 'processing') && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setCompleteTarget(r)}
                            className="rounded-lg border px-3 py-1.5 text-[12px] transition-colors whitespace-nowrap border-[rgba(61,185,122,0.30)] text-[#3DB97A] font-body"
                          >
                            Completar
                          </button>
                          <button
                            onClick={() => setRejectTarget(r)}
                            className="rounded-lg border px-3 py-1.5 text-[12px] transition-colors whitespace-nowrap border-[rgba(239,85,84,0.30)] text-coral font-body"
                          >
                            Rechazar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {sinpeRefunds.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-[rgba(22,20,64,0.35)] font-body">Sin devoluciones SINPE</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile: tarjetas */}
          <ul className="md:hidden">
            {sinpeRefunds.map((r, i) => (
              <li
                key={r.id}
                className="px-4 py-3 space-y-2.5"
                style={i < sinpeRefunds.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium font-body text-navy truncate">{r.member_name}</p>
                    <p className="text-[12px] text-[rgba(22,20,64,0.55)] font-body truncate">{r.entity_name}</p>
                    {r.reason && <p className="text-[11px] text-[rgba(22,20,64,0.50)] font-body mt-0.5">{r.reason}</p>}
                    <p className="text-[11px] text-[rgba(22,20,64,0.45)] font-body mt-0.5">Solicitada {formatDate(r.requested_at)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <p className="text-[13px] font-medium font-body text-navy">
                      <AmountDisplay amount={r.amount} defaultHidden={false} />
                    </p>
                    <RefundStatusBadge status={r.status} />
                  </div>
                </div>
                {(r.status === 'pending' || r.status === 'processing') && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setCompleteTarget(r)}
                      className="rounded-lg border px-3 py-1.5 text-[12px] transition-colors whitespace-nowrap border-[rgba(61,185,122,0.30)] text-[#3DB97A] font-body"
                    >
                      Completar
                    </button>
                    <button
                      onClick={() => setRejectTarget(r)}
                      className="rounded-lg border px-3 py-1.5 text-[12px] transition-colors whitespace-nowrap border-[rgba(239,85,84,0.30)] text-coral font-body"
                    >
                      Rechazar
                    </button>
                  </div>
                )}
              </li>
            ))}
            {sinpeRefunds.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-[rgba(22,20,64,0.35)] font-body">Sin devoluciones SINPE</li>
            )}
          </ul>
        </div>
      </div>

      {/* Complete modal */}
      {completeTarget && (
        <Modal onClose={() => setCompleteTarget(null)} titleId="completar-devolucion" width={448}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--outline-variant)]">
              <p id="completar-devolucion" className="text-sm font-bold font-display text-navy">Marcar devolución completada</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-[13px] font-body text-[rgba(22,20,64,0.70)]">
                Devolución de <strong>₡{completeTarget.amount.toLocaleString('es-CR')}</strong> a <strong>{completeTarget.member_name}</strong>
              </p>
              <div>
                <label className="text-[11px] uppercase tracking-widests mb-1.5 block font-display text-[rgba(22,20,64,0.40)]">Fecha de transferencia</label>
                <input type="date" value={completionDate} onChange={e => setCompletionDate(e.target.value)}
                  className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none border-[var(--outline-variant)] font-body text-navy" />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-widests mb-1.5 block font-display text-[rgba(22,20,64,0.40)]">Número de confirmación</label>
                <input type="text" value={completionConf} onChange={e => setCompletionConf(e.target.value)}
                  placeholder="ej. SINPE-2026-05-DV-99123"
                  className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none border-[var(--outline-variant)] font-body text-navy" />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 border-[var(--outline-variant)]">
              <button onClick={() => setCompleteTarget(null)}
                className="flex-1 rounded-full border py-2.5 text-sm border-[var(--outline-variant)] font-body text-[rgba(22,20,64,0.70)]">
                Cancelar
              </button>
              <button onClick={handleComplete}
                className="flex-1 rounded-full py-2.5 text-sm text-white bg-[#3DB97A] font-body">
                Confirmar
              </button>
            </div>
        </Modal>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <Modal onClose={() => setRejectTarget(null)} titleId="rechazar-devolucion" width={448}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--outline-variant)]">
              <p id="rechazar-devolucion" className="text-sm font-bold font-display text-navy">Rechazar devolución</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-[13px] font-body text-[rgba(22,20,64,0.70)]">
                Rechazando devolución de <strong>{rejectTarget.member_name}</strong>
              </p>
              <div>
                <label className="text-[11px] uppercase tracking-widests mb-1.5 block font-display text-[rgba(22,20,64,0.40)]">Motivo del rechazo</label>
                <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                  rows={3} placeholder="Explicá el motivo..."
                  className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none resize-none border-[var(--outline-variant)] font-body text-navy" />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 border-[var(--outline-variant)]">
              <button onClick={() => setRejectTarget(null)}
                className="flex-1 rounded-full border py-2.5 text-sm border-[var(--outline-variant)] font-body text-[rgba(22,20,64,0.70)]">
                Cancelar
              </button>
              <button onClick={handleReject}
                className="flex-1 rounded-full py-2.5 text-sm text-white bg-coral font-body">
                Rechazar
              </button>
            </div>
        </Modal>
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
