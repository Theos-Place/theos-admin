'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { CreditCard, Eye, EyeOff, Search, Check, X } from 'lucide-react'
import { FinanceGuard } from '@/components/finance/FinanceGuard'
import { AmountDisplay } from '@/components/finance/AmountDisplay'
import { PaymentMethodBadge } from '@/components/finance/PaymentMethodBadge'
import { PaymentStatusBadge } from '@/components/finance/PaymentStatusBadge'
import { RefundModal } from '@/components/finance/RefundModal'
import { type Payment, type PaymentMethod, type PaymentStatus } from '@/data/mock-finance'
import { useFinance } from '@/hooks/useFinance'

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PagosPage() {
  const { payments: MOCK_PAYMENTS } = useFinance()
  const [revealAll, setRevealAll] = useState(false)
  const [entityFilter, setEntityFilter] = useState<'all' | 'event' | 'study_group'>('all')
  const [methodFilter, setMethodFilter] = useState<'all' | PaymentMethod>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all')
  const [search, setSearch] = useState('')
  const [payments, setPayments] = useState(MOCK_PAYMENTS)
  const [refundTarget, setRefundTarget] = useState<Payment | null>(null)
  const [sinpeTarget, setSinpeTarget] = useState<Payment | null>(null)
  const [sinpeConf, setSinpeConf] = useState('')
  const [sinpeDate, setSinpeDate] = useState('')
  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  const totalPaid = payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0)
  const totalCard = payments.filter(p => p.status === 'paid' && p.method === 'card').reduce((s, p) => s + p.amount, 0)
  const totalSinpe = payments.filter(p => p.status === 'paid' && p.method === 'sinpe').reduce((s, p) => s + p.amount, 0)
  const totalPending = payments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0)

  const filtered = useMemo(() => {
    return payments.filter(p => {
      const q = search.toLowerCase()
      const matchSearch = !q || p.member_name.toLowerCase().includes(q) || p.entity_name.toLowerCase().includes(q) || p.member_cedula.includes(q)
      const matchEntity = entityFilter === 'all' || p.entity_type === entityFilter
      const matchMethod = methodFilter === 'all' || p.method === methodFilter
      const matchStatus = statusFilter === 'all' || p.status === statusFilter
      return matchSearch && matchEntity && matchMethod && matchStatus
    })
  }, [payments, search, entityFilter, methodFilter, statusFilter])

  function handleRefundConfirm(data: { type: 'full' | 'partial'; amount: number; reason: string; reasonDetail: string }) {
    if (!refundTarget) return
    setPayments(prev => prev.map(p =>
      p.id === refundTarget.id
        ? { ...p, status: data.type === 'full' ? 'refunded' : 'partial_refund' }
        : p
    ))
    setRefundTarget(null)
    showToast(`Solicitud de devolución creada para ${refundTarget.member_name}`)
  }

  function handleConfirmSinpe() {
    if (!sinpeTarget || !sinpeConf) return
    setPayments(prev => prev.map(p =>
      p.id === sinpeTarget.id
        ? { ...p, status: 'paid', sinpe_confirmation: sinpeConf, paid_at: sinpeDate || new Date().toISOString() }
        : p
    ))
    setSinpeTarget(null)
    setSinpeConf('')
    setSinpeDate('')
    showToast(`Pago SINPE confirmado para ${sinpeTarget.member_name}`)
  }

  return (
    <FinanceGuard>
      <div className="space-y-6">

        {/* Header */}
        <div
          className="rounded-2xl px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          style={{ background: '#161440', boxShadow: 'var(--shadow-md)' }}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.10)' }}>
              <CreditCard size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl text-white" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}>Pagos</h1>
              <p className="text-[12px] text-white/50 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
                Registro de todos los pagos del sistema
              </p>
            </div>
          </div>
          <button
            onClick={() => setRevealAll(r => !r)}
            className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] self-start sm:self-auto"
            style={{ background: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.70)', fontFamily: 'var(--font-body)' }}
          >
            {revealAll ? <EyeOff size={13} /> : <Eye size={13} />}
            {revealAll ? 'Ocultar montos' : 'Mostrar montos'}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total cobrado', value: totalPaid, color: '#161440' },
            { label: 'Por tarjeta', value: totalCard, color: '#519DA2' },
            { label: 'Por SINPE', value: totalSinpe, color: '#3DB97A' },
            { label: 'Pendientes', value: totalPending, color: '#E9B949' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
              <p className="text-[10px] uppercase tracking-widest mb-2" style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>{label}</p>
              <p className="text-xl font-extrabold" style={{ fontFamily: 'var(--font-display)', color }}>
                <AmountDisplay amount={value} defaultHidden={false} revealed={revealAll} />
              </p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 flex-1 min-w-48" style={{ background: 'var(--surface-card)', border: '1px solid var(--outline-variant)' }}>
            <Search size={14} style={{ color: 'rgba(22,20,64,0.40)', flexShrink: 0 }} />
            <input
              type="search"
              placeholder="Buscar por miembro, concepto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ fontFamily: 'var(--font-body)', color: '#161440' }}
            />
          </div>

          <div className="flex gap-1">
            {([['all', 'Todos'], ['event', 'Eventos'], ['study_group', 'Grupos']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setEntityFilter(v)}
                className="rounded-full px-3 py-2 text-[12px] font-medium border transition-all"
                style={{ background: entityFilter === v ? '#161440' : 'transparent', color: entityFilter === v ? 'white' : 'rgba(22,20,64,0.60)', borderColor: entityFilter === v ? '#161440' : 'transparent', fontFamily: 'var(--font-display)' }}>
                {l}
              </button>
            ))}
          </div>

          <div className="flex gap-1">
            {([['all', 'Todos'], ['card', 'Tarjeta'], ['sinpe', 'SINPE'], ['scholarship', 'Beca'], ['cash', 'Efectivo']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setMethodFilter(v)}
                className="rounded-full px-3 py-2 text-[12px] font-medium border transition-all"
                style={{ background: methodFilter === v ? '#161440' : 'transparent', color: methodFilter === v ? 'white' : 'rgba(22,20,64,0.60)', borderColor: methodFilter === v ? '#161440' : 'transparent', fontFamily: 'var(--font-display)' }}>
                {l}
              </button>
            ))}
          </div>

          <div className="flex gap-1">
            {([['all', 'Todos'], ['paid', 'Pagado'], ['pending', 'Pendiente'], ['refunded', 'Devuelto']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setStatusFilter(v as 'all' | PaymentStatus)}
                className="rounded-full px-3 py-2 text-[12px] font-medium border transition-all"
                style={{ background: statusFilter === v ? '#161440' : 'transparent', color: statusFilter === v ? 'white' : 'rgba(22,20,64,0.60)', borderColor: statusFilter === v ? '#161440' : 'transparent', fontFamily: 'var(--font-display)' }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--outline-variant)' }}>
                  {['Miembro', 'Concepto', 'Monto', 'Método', 'Estado', 'Fecha', 'Acciones'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-[10px] uppercase tracking-widest"
                      style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.id} className="border-b hover:bg-gray-50 transition-colors"
                    style={{ borderColor: 'var(--outline-variant)', background: i % 2 === 0 ? 'white' : 'rgba(22,20,64,0.01)' }}>
                    <td className="px-5 py-4">
                      <p className="text-[13px] font-medium" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>{p.member_name}</p>
                      <p className="text-[11px]" style={{ color: 'rgba(22,20,64,0.45)', fontFamily: 'var(--font-body)' }}>{p.member_cedula}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[13px]" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>{p.entity_name}</p>
                      <p className="text-[11px]" style={{ color: 'rgba(22,20,64,0.40)', fontFamily: 'var(--font-body)' }}>
                        {p.entity_type === 'event' ? 'Evento' : 'Grupo de estudio'}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[13px] font-medium" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>
                        <AmountDisplay amount={p.amount} revealed={revealAll} />
                      </p>
                    </td>
                    <td className="px-5 py-4"><PaymentMethodBadge method={p.method} /></td>
                    <td className="px-5 py-4"><PaymentStatusBadge status={p.status} /></td>
                    <td className="px-5 py-4">
                      <p className="text-[12px] whitespace-nowrap" style={{ fontFamily: 'var(--font-body)', color: 'rgba(22,20,64,0.55)' }}>
                        {formatDate(p.created_at)}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/finanzas/pagos/${p.id}`}
                          className="rounded-lg border px-3 py-1.5 text-[12px] transition-colors whitespace-nowrap"
                          style={{ borderColor: 'var(--outline-variant)', color: '#161440', fontFamily: 'var(--font-body)' }}
                        >
                          Ver →
                        </Link>
                        {p.status === 'paid' && (
                          <button
                            onClick={() => setRefundTarget(p)}
                            className="rounded-lg border px-3 py-1.5 text-[12px] transition-colors whitespace-nowrap"
                            style={{ borderColor: 'rgba(239,85,84,0.30)', color: '#EF5554', fontFamily: 'var(--font-body)' }}
                          >
                            Devolver
                          </button>
                        )}
                        {p.status === 'pending' && p.method === 'sinpe' && (
                          <button
                            onClick={() => setSinpeTarget(p)}
                            className="rounded-lg border px-3 py-1.5 text-[12px] transition-colors whitespace-nowrap"
                            style={{ borderColor: 'rgba(81,157,162,0.30)', color: '#519DA2', fontFamily: 'var(--font-body)' }}
                          >
                            Confirmar SINPE
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm" style={{ fontFamily: 'var(--font-body)', color: 'rgba(22,20,64,0.40)' }}>
                      No hay pagos que coincidan con los filtros
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Refund modal */}
      {refundTarget && (
        <RefundModal
          isOpen
          onClose={() => setRefundTarget(null)}
          onConfirm={handleRefundConfirm}
          payment={refundTarget}
        />
      )}

      {/* SINPE confirm modal */}
      {sinpeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(22,20,64,0.40)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--outline-variant)' }}>
              <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: '#161440' }}>
                Confirmar pago SINPE
              </p>
              <button onClick={() => setSinpeTarget(null)}><X size={18} style={{ color: 'rgba(22,20,64,0.40)' }} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-[13px]" style={{ fontFamily: 'var(--font-body)', color: 'rgba(22,20,64,0.70)' }}>
                <strong>{sinpeTarget.member_name}</strong> — {sinpeTarget.entity_name}
              </p>
              <div>
                <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>
                  Número de confirmación SINPE
                </label>
                <input
                  type="text"
                  value={sinpeConf}
                  onChange={e => setSinpeConf(e.target.value)}
                  placeholder="ej. SINPE-2026-05-12345"
                  className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none"
                  style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)', color: '#161440' }}
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>
                  Fecha de transferencia
                </label>
                <input
                  type="date"
                  value={sinpeDate}
                  onChange={e => setSinpeDate(e.target.value)}
                  className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none"
                  style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)', color: '#161440' }}
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3" style={{ borderColor: 'var(--outline-variant)' }}>
              <button onClick={() => setSinpeTarget(null)}
                className="flex-1 rounded-full border py-2.5 text-sm transition-colors"
                style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)', color: 'rgba(22,20,64,0.70)' }}>
                Cancelar
              </button>
              <button
                onClick={handleConfirmSinpe}
                disabled={!sinpeConf}
                className="flex-1 rounded-full py-2.5 text-sm text-white transition-all disabled:opacity-40"
                style={{ background: '#519DA2', fontFamily: 'var(--font-body)' }}>
                Confirmar pago
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
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
