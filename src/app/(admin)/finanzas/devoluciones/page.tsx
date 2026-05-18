'use client'

import { useState, useMemo } from 'react'
import { ArrowLeftRight, Check, X } from 'lucide-react'
import { FinanceGuard } from '@/components/finance/FinanceGuard'
import { AmountDisplay } from '@/components/finance/AmountDisplay'
import { PaymentMethodBadge } from '@/components/finance/PaymentMethodBadge'
import { MOCK_REFUNDS, type Refund, type RefundStatus } from '@/data/mock-finance'

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
  const [refunds, setRefunds] = useState(MOCK_REFUNDS)
  const [completeTarget, setCompleteTarget] = useState<Refund | null>(null)
  const [rejectTarget, setRejectTarget] = useState<Refund | null>(null)
  const [completionDate, setCompletionDate] = useState('')
  const [completionConf, setCompletionConf] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  const cardRefunds = refunds.filter(r => r.method === 'card')
  const sinpeRefunds = refunds.filter(r => r.method === 'sinpe')

  const stats = useMemo(() => ({
    pending:    refunds.filter(r => r.status === 'pending').length,
    processing: refunds.filter(r => r.status === 'processing').length,
    completed:  refunds.filter(r => r.status === 'completed').length,
    totalAmount: refunds.filter(r => r.status === 'completed').reduce((s, r) => s + r.amount, 0),
  }), [refunds])

  function handleComplete() {
    if (!completeTarget) return
    setRefunds(prev => prev.map(r =>
      r.id === completeTarget.id
        ? { ...r, status: 'completed', processed_at: completionDate || new Date().toISOString(), processed_by: 'Daniel Torres Blanco', sinpe_pending: false, notes: completionConf ? `Confirmación SINPE: ${completionConf}` : r.notes }
        : r
    ))
    setCompleteTarget(null)
    setCompletionDate('')
    setCompletionConf('')
    showToast(`Devolución completada para ${completeTarget.member_name}`)
  }

  function handleReject() {
    if (!rejectTarget) return
    setRefunds(prev => prev.map(r =>
      r.id === rejectTarget.id
        ? { ...r, status: 'rejected', processed_at: new Date().toISOString(), processed_by: 'Daniel Torres Blanco', notes: rejectReason }
        : r
    ))
    setRejectTarget(null)
    setRejectReason('')
    showToast(`Devolución rechazada para ${rejectTarget.member_name}`)
  }

  return (
    <FinanceGuard>
      <div className="space-y-6">

        {/* Header */}
        <div
          className="rounded-2xl px-6 py-5 flex items-center gap-3"
          style={{ background: '#161440', boxShadow: 'var(--shadow-md)' }}
        >
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.10)' }}>
            <ArrowLeftRight size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl text-white" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}>Devoluciones</h1>
            <p className="text-[12px] text-white/50 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
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
            <div key={label} className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
              <p className="text-[10px] uppercase tracking-widests mb-2" style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>{label}</p>
              <p className="text-4xl font-extrabold" style={{ fontFamily: 'var(--font-display)', color }}>{value}</p>
            </div>
          ))}
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <p className="text-[10px] uppercase tracking-widests mb-2" style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>Total devuelto</p>
            <p className="text-xl font-extrabold" style={{ fontFamily: 'var(--font-display)', color: '#161440' }}>
              <AmountDisplay amount={stats.totalAmount} defaultHidden={false} />
            </p>
          </div>
        </div>

        {/* Section A — Card (automatic) */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
          <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'var(--outline-variant)' }}>
            <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: '#161440' }}>
              Automáticas — Tarjeta
            </p>
            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{ background: 'rgba(112,189,194,0.15)', color: '#519DA2' }}>
              Procesadas por pasarela
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--outline-variant)' }}>
                  {['Miembro', 'Concepto', 'Monto', 'Estado', 'Solicitada', 'Procesada'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] uppercase tracking-widests"
                      style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cardRefunds.map((r, i) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50 transition-colors"
                    style={{ borderColor: 'var(--outline-variant)', background: i % 2 === 0 ? 'white' : 'rgba(22,20,64,0.01)' }}>
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-medium" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>{r.member_name}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[13px]" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>{r.entity_name}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-medium" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>
                        <AmountDisplay amount={r.amount} defaultHidden={false} />
                      </p>
                    </td>
                    <td className="px-5 py-3.5"><RefundStatusBadge status={r.status} /></td>
                    <td className="px-5 py-3.5">
                      <p className="text-[12px] whitespace-nowrap" style={{ color: 'rgba(22,20,64,0.55)', fontFamily: 'var(--font-body)' }}>{formatDate(r.requested_at)}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[12px] whitespace-nowrap" style={{ color: 'rgba(22,20,64,0.55)', fontFamily: 'var(--font-body)' }}>{formatDate(r.processed_at)}</p>
                    </td>
                  </tr>
                ))}
                {cardRefunds.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-sm" style={{ color: 'rgba(22,20,64,0.35)', fontFamily: 'var(--font-body)' }}>Sin devoluciones por tarjeta</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section B — SINPE (manual) */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
          <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'var(--outline-variant)' }}>
            <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: '#161440' }}>
              Manuales — SINPE
            </p>
            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{ background: 'rgba(239,85,84,0.10)', color: '#EF5554' }}>
              Requieren proceso manual
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--outline-variant)' }}>
                  {['Miembro', 'Concepto', 'Monto', 'Motivo', 'Estado', 'Solicitada', 'Acciones'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] uppercase tracking-widests"
                      style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sinpeRefunds.map((r, i) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50 transition-colors"
                    style={{ borderColor: 'var(--outline-variant)', background: i % 2 === 0 ? 'white' : 'rgba(22,20,64,0.01)' }}>
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-medium" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>{r.member_name}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[13px]" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>{r.entity_name}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-medium" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>
                        <AmountDisplay amount={r.amount} defaultHidden={false} />
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[12px]" style={{ color: 'rgba(22,20,64,0.60)', fontFamily: 'var(--font-body)' }}>{r.reason}</p>
                    </td>
                    <td className="px-5 py-3.5"><RefundStatusBadge status={r.status} /></td>
                    <td className="px-5 py-3.5">
                      <p className="text-[12px] whitespace-nowrap" style={{ color: 'rgba(22,20,64,0.55)', fontFamily: 'var(--font-body)' }}>{formatDate(r.requested_at)}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      {(r.status === 'pending' || r.status === 'processing') && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setCompleteTarget(r)}
                            className="rounded-lg border px-3 py-1.5 text-[12px] transition-colors whitespace-nowrap"
                            style={{ borderColor: 'rgba(61,185,122,0.30)', color: '#3DB97A', fontFamily: 'var(--font-body)' }}
                          >
                            Completar
                          </button>
                          <button
                            onClick={() => setRejectTarget(r)}
                            className="rounded-lg border px-3 py-1.5 text-[12px] transition-colors whitespace-nowrap"
                            style={{ borderColor: 'rgba(239,85,84,0.30)', color: '#EF5554', fontFamily: 'var(--font-body)' }}
                          >
                            Rechazar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {sinpeRefunds.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-8 text-center text-sm" style={{ color: 'rgba(22,20,64,0.35)', fontFamily: 'var(--font-body)' }}>Sin devoluciones SINPE</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Complete modal */}
      {completeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(22,20,64,0.40)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--outline-variant)' }}>
              <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: '#161440' }}>Marcar devolución completada</p>
              <button onClick={() => setCompleteTarget(null)}><X size={18} style={{ color: 'rgba(22,20,64,0.40)' }} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-[13px]" style={{ fontFamily: 'var(--font-body)', color: 'rgba(22,20,64,0.70)' }}>
                Devolución de <strong>₡{completeTarget.amount.toLocaleString('es-CR')}</strong> a <strong>{completeTarget.member_name}</strong>
              </p>
              <div>
                <label className="text-[11px] uppercase tracking-widests mb-1.5 block" style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>Fecha de transferencia</label>
                <input type="date" value={completionDate} onChange={e => setCompletionDate(e.target.value)}
                  className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none"
                  style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)', color: '#161440' }} />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-widests mb-1.5 block" style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>Número de confirmación</label>
                <input type="text" value={completionConf} onChange={e => setCompletionConf(e.target.value)}
                  placeholder="ej. SINPE-2026-05-DV-99123"
                  className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none"
                  style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)', color: '#161440' }} />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3" style={{ borderColor: 'var(--outline-variant)' }}>
              <button onClick={() => setCompleteTarget(null)}
                className="flex-1 rounded-full border py-2.5 text-sm"
                style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)', color: 'rgba(22,20,64,0.70)' }}>
                Cancelar
              </button>
              <button onClick={handleComplete}
                className="flex-1 rounded-full py-2.5 text-sm text-white"
                style={{ background: '#3DB97A', fontFamily: 'var(--font-body)' }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(22,20,64,0.40)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--outline-variant)' }}>
              <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: '#161440' }}>Rechazar devolución</p>
              <button onClick={() => setRejectTarget(null)}><X size={18} style={{ color: 'rgba(22,20,64,0.40)' }} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-[13px]" style={{ fontFamily: 'var(--font-body)', color: 'rgba(22,20,64,0.70)' }}>
                Rechazando devolución de <strong>{rejectTarget.member_name}</strong>
              </p>
              <div>
                <label className="text-[11px] uppercase tracking-widests mb-1.5 block" style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>Motivo del rechazo</label>
                <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                  rows={3} placeholder="Explicá el motivo..."
                  className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none resize-none"
                  style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)', color: '#161440' }} />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3" style={{ borderColor: 'var(--outline-variant)' }}>
              <button onClick={() => setRejectTarget(null)}
                className="flex-1 rounded-full border py-2.5 text-sm"
                style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)', color: 'rgba(22,20,64,0.70)' }}>
                Cancelar
              </button>
              <button onClick={handleReject}
                className="flex-1 rounded-full py-2.5 text-sm text-white"
                style={{ background: '#EF5554', fontFamily: 'var(--font-body)' }}>
                Rechazar
              </button>
            </div>
          </div>
        </div>
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
