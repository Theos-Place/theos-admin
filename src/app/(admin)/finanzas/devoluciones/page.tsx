'use client'

import { useState, useMemo, useEffect } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { FinanceGuard } from '@/components/finance/FinanceGuard'
import { sumByCurrency } from '@/lib/money'
import { AmountDisplay, TotalsDisplay } from '@/components/finance/AmountDisplay'
import { type Refund, type RefundStatus } from '@/types/finance'
import { useFinance } from '@/hooks/useFinance'
import { useToast } from '@/components/shared/Toast'
import { formatDate, formatMoney } from '@/lib/format'

function RefundStatusBadge({ status }: { status: RefundStatus }) {
  const cfg: Record<RefundStatus, { label: string; color: string; bg: string }> = {
    pending:    { label: 'Pendiente',   color: '#E9B949', bg: 'rgba(233,185,73,0.15)'  },
    processing: { label: 'En proceso',  color: '#519DA2', bg: 'rgba(81,157,162,0.12)'  },
    completed:  { label: 'Completada',  color: '#3DB97A', bg: 'rgba(61,185,122,0.12)'  },
    rejected:   { label: 'Rechazada',   color: '#EF5554', bg: 'rgba(239,85,84,0.10)'   },
  }
  const c = cfg[status]
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-medium"
      style={{ color: c.color, background: c.bg }}>
      {c.label}
    </span>
  )
}

export default function DevolucionesPage() {
  const { refunds: allRefunds, refetch, loading } = useFinance('refunds')
  const [refunds, setRefunds] = useState<Refund[]>([])
  useEffect(() => { setRefunds(allRefunds) }, [allRefunds])
  const [completeTarget, setCompleteTarget] = useState<Refund | null>(null)
  const [rejectTarget, setRejectTarget] = useState<Refund | null>(null)
  const [completionDate, setCompletionDate] = useState('')
  const [completionConf, setCompletionConf] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const toast = useToast()

  // FASE FUTURA: devoluciones automáticas por pasarela (tarjeta) y SINPE
  // directo no existen aún — hoy TODO se procesa manualmente (tiquetes de
  // miembros por comprobante o registrados a mano), en una sola cola.
  const REFUND_METHOD_LABEL: Record<string, string> = {
    comprobante: 'Comprobante', cash: 'Efectivo', scholarship: 'Beca', sinpe: 'SINPE', card: 'Tarjeta',
  }

  const stats = useMemo(() => ({
    pending:    refunds.filter(r => r.status === 'pending').length,
    processing: refunds.filter(r => r.status === 'processing').length,
    completed:  refunds.filter(r => r.status === 'completed').length,
    // INT-3: por moneda; una devolución en euros no se suma con una en colones.
    totalAmount: sumByCurrency(refunds.filter(r => r.status === 'completed')),
  }), [refunds])

  async function handleComplete() {
    if (!completeTarget || !completionDate || !completionConf.trim()) return
    const target = completeTarget
    const body = {
      status: 'completed',
      processed_date: completionDate,
      confirmation: completionConf.trim(),
    }
    setCompleteTarget(null)
    setCompletionDate('')
    setCompletionConf('')
    try {
      const res = await fetch(`/api/finance/refunds/${target.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      await refetch()
      toast(`Devolución completada para ${target.member_name}`, 'success')
    } catch {
      toast('No se pudo completar la devolución. Intentá de nuevo.', 'error')
    }
  }

  async function handleReject() {
    if (!rejectTarget || !rejectReason.trim()) return
    const target = rejectTarget
    const body = { status: 'rejected', reject_reason: rejectReason.trim() }
    setRejectTarget(null)
    setRejectReason('')
    try {
      const res = await fetch(`/api/finance/refunds/${target.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      await refetch()
      toast(`Devolución rechazada para ${target.member_name}`, 'success')
    } catch {
      toast('No se pudo rechazar la devolución. Intentá de nuevo.', 'error')
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
            <p className="text-[12px] text-white/70 mt-0.5 font-body">
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
              <p className="text-[11px] uppercase tracking-widest mb-2 font-display text-[rgba(22,20,64,0.60)]">{label}</p>
              <p className="text-4xl font-extrabold font-display" style={{ color }}>{value}</p>
            </div>
          ))}
          <div className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)]">
            <p className="text-[11px] uppercase tracking-widest mb-2 font-display text-[rgba(22,20,64,0.60)]">Total devuelto</p>
            <p className="text-xl font-extrabold font-display text-navy">
              <TotalsDisplay totals={stats.totalAmount} defaultHidden={false} />
            </p>
          </div>
        </div>

        {/* Cola única de devoluciones (todas se procesan manualmente hoy). */}
        <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--outline-variant)]">
            <p className="text-sm font-bold font-display text-navy">
              Devoluciones
            </p>
            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-medium bg-[rgba(239,85,84,0.10)] text-coral">
              Proceso manual
            </span>
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--outline-variant)]">
                  {['Miembro', 'Concepto', 'Monto', 'Método', 'Motivo', 'Estado', 'Solicitada', 'Acciones'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] uppercase tracking-widest font-display text-[rgba(22,20,64,0.60)]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {refunds.map((r, i) => (
                  <tr key={r.id} className={`border-b border-[var(--outline-variant)] hover:bg-gray-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-[rgba(22,20,64,0.01)]'}`}>
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-medium font-body text-navy">{r.member_name}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-body text-navy">{r.entity_name}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-medium font-body text-navy">
                        <AmountDisplay amount={r.amount} currency={r.currency} defaultHidden={false} />
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[12px] text-[rgba(22,20,64,0.60)] font-body">{REFUND_METHOD_LABEL[r.method] ?? r.method}</p>
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
                {refunds.length === 0 && (
                  <tr><td colSpan={8} className="px-5 py-8 text-center text-sm text-[rgba(22,20,64,0.35)] font-body">{loading ? 'Cargando…' : 'Sin devoluciones'}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile: tarjetas */}
          <ul className="md:hidden">
            {refunds.map((r, i) => (
              <li
                key={r.id}
                className="px-4 py-3 space-y-2.5"
                style={i < refunds.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium font-body text-navy truncate">{r.member_name}</p>
                    <p className="text-[12px] text-[rgba(22,20,64,0.55)] font-body truncate">{r.entity_name}</p>
                    {r.reason && <p className="text-[12px] text-[rgba(22,20,64,0.60)] font-body mt-0.5">{r.reason}</p>}
                    <p className="text-[12px] text-[rgba(22,20,64,0.45)] font-body mt-0.5">Solicitada {formatDate(r.requested_at)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <p className="text-[13px] font-medium font-body text-navy">
                      <AmountDisplay amount={r.amount} currency={r.currency} defaultHidden={false} />
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
            {refunds.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-[rgba(22,20,64,0.35)] font-body">{loading ? 'Cargando…' : 'Sin devoluciones'}</li>
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
                Devolución de <strong>{formatMoney(completeTarget.amount, completeTarget.currency)}</strong> a <strong>{completeTarget.member_name}</strong>
              </p>
              <div>
                <label className="text-[12px] uppercase tracking-widest mb-1.5 block font-display text-[rgba(22,20,64,0.60)]">Fecha de transferencia</label>
                <input type="date" value={completionDate} onChange={e => setCompletionDate(e.target.value)}
                  className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none border-[var(--outline-variant)] font-body text-navy" />
              </div>
              <div>
                <label className="text-[12px] uppercase tracking-widest mb-1.5 block font-display text-[rgba(22,20,64,0.60)]">Número de confirmación</label>
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
                disabled={!completionDate || !completionConf.trim()}
                className="flex-1 rounded-full py-2.5 text-sm text-white bg-[#3DB97A] font-body disabled:opacity-40 disabled:cursor-not-allowed">
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
                <label className="text-[12px] uppercase tracking-widest mb-1.5 block font-display text-[rgba(22,20,64,0.60)]">Motivo del rechazo</label>
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
                disabled={!rejectReason.trim()}
                className="flex-1 rounded-full py-2.5 text-sm text-white bg-coral font-body disabled:opacity-40 disabled:cursor-not-allowed">
                Rechazar
              </button>
            </div>
        </Modal>
      )}

    </FinanceGuard>
  )
}
