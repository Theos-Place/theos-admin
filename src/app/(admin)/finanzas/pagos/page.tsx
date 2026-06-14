'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useUrlFilter } from '@/hooks/useUrlFilter'
import { CreditCard, Eye, EyeOff, Search, Check } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Modal } from '@/components/shared/Modal'
import { FilterChips } from '@/components/shared/FilterChips'
import { FinanceGuard } from '@/components/finance/FinanceGuard'
import { AmountDisplay } from '@/components/finance/AmountDisplay'
import { PaymentMethodBadge } from '@/components/finance/PaymentMethodBadge'
import { PaymentStatusBadge } from '@/components/finance/PaymentStatusBadge'
import { RefundModal } from '@/components/finance/RefundModal'
import { type Payment, type PaymentMethod, type PaymentStatus } from '@/types/finance'
import { usePaginatedList } from '@/hooks/usePaginatedList'
import { LoadMoreFooter } from '@/components/shared/LoadMoreFooter'
import type { DbPayment } from '@/lib/supabase/queries/finance'
import { toDomainPayment } from '@/lib/finance/adapter'
import { formatDate } from '@/lib/format'

function PagosContent() {
  const [revealAll, setRevealAll] = useState(false)
  // Filtros en la URL: sobreviven recargas y se comparten por link.
  const [entityRaw, setEntityFilter] = useUrlFilter('entidad', 'all')
  const entityFilter = entityRaw as 'all' | 'event' | 'study_group'
  const [methodRaw, setMethodFilter] = useUrlFilter('metodo', 'all')
  const methodFilter = methodRaw as 'all' | PaymentMethod
  const [statusRaw, setStatusFilter] = useUrlFilter('estado', 'all')
  const statusFilter = statusRaw as 'all' | PaymentStatus
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])
  const [refundTarget, setRefundTarget] = useState<Payment | null>(null)
  const [sinpeTarget, setSinpeTarget] = useState<Payment | null>(null)
  const [sinpeConf, setSinpeConf] = useState('')
  const [sinpeDate, setSinpeDate] = useState('')
  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  // Listado paginado server-side (filtros + búsqueda viajan al servidor).
  const buildUrl = (page: number) => {
    const u = new URLSearchParams()
    if (debouncedSearch.trim()) u.set('search', debouncedSearch.trim())
    if (entityFilter !== 'all') u.set('entity_type', entityFilter)
    if (methodFilter !== 'all') u.set('method', methodFilter)
    if (statusFilter !== 'all') u.set('status', statusFilter)
    u.set('page', String(page))
    u.set('pageSize', '25')
    return `/api/finance/payments?${u.toString()}`
  }
  const {
    items: payments, total, loading, error, hasMore, loadMore, reload,
  } = usePaginatedList<DbPayment, Payment>(buildUrl, { pageSize: 25, itemsKey: 'payments', mapItem: toDomainPayment })
  const filtered = payments

  // Totales globales (los 4 montos del header) — SQL, no sobre lo cargado.
  const [stats, setStats] = useState({ total_paid: 0, total_card: 0, total_sinpe: 0, total_pending: 0 })
  const loadStats = useCallback(() => {
    fetch('/api/finance/payments?stats=1')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setStats(d) })
      .catch(() => {})
  }, [])
  useEffect(() => { loadStats() }, [loadStats])
  const totalPaid = stats.total_paid
  const totalCard = stats.total_card
  const totalSinpe = stats.total_sinpe
  const totalPending = stats.total_pending

  const refetch = useCallback(() => { reload(); loadStats() }, [reload, loadStats])

  async function handleRefundConfirm(data: { type: 'full' | 'partial'; amount: number; reason: string; reasonDetail: string }) {
    if (!refundTarget) return
    const target = refundTarget
    setRefundTarget(null)
    try {
      const res = await fetch('/api/finance/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_id: target.id,
          member_id: target.member_id || null,
          amount: data.amount,
          method: target.method,
          reason: [data.reason, data.reasonDetail].filter(Boolean).join(' — ') || null,
          sinpe_pending: target.method === 'sinpe',
        }),
      })
      if (!res.ok) throw new Error()
      await refetch()
      showToast(`Solicitud de devolución creada para ${target.member_name}`)
    } catch {
      showToast('Error al crear la devolución')
    }
  }

  async function handleConfirmSinpe() {
    if (!sinpeTarget || !sinpeConf) return
    const target = sinpeTarget
    setSinpeTarget(null)
    setSinpeConf('')
    setSinpeDate('')
    try {
      const res = await fetch(`/api/finance/payments/${target.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'paid',
          sinpe_confirmation: sinpeConf,
          paid_at: sinpeDate || new Date().toISOString(),
        }),
      })
      if (!res.ok) throw new Error()
      await refetch()
      showToast(`Pago SINPE confirmado para ${target.member_name}`)
    } catch {
      showToast('Error al confirmar el pago')
    }
  }

  return (
    <FinanceGuard>
      <div className="space-y-6">

        {/* Header */}
        <div
          className="rounded-2xl px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-navy shadow-[var(--shadow-md)]"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-[rgba(255,255,255,0.10)]">
              <CreditCard size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl text-white font-display font-extrabold tracking-[-0.02em]">Pagos</h1>
              <p className="text-[12px] text-white/70 mt-0.5 font-body">
                Registro de todos los pagos del sistema
              </p>
            </div>
          </div>
          <button
            onClick={() => setRevealAll(r => !r)}
            className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] self-start sm:self-auto bg-[rgba(255,255,255,0.10)] text-[rgba(255,255,255,0.70)] font-body"
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
            <div key={label} className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)]">
              <p className="text-[10px] uppercase tracking-widest mb-2 font-display text-[rgba(22,20,64,0.60)]">{label}</p>
              <p className="text-xl font-extrabold font-display" style={{ color }}>
                <AmountDisplay amount={value} defaultHidden={false} revealed={revealAll} />
              </p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 flex-1 min-w-48 bg-surface-card border border-[var(--outline-variant)]">
            <Search size={14} className="text-[rgba(22,20,64,0.60)] shrink-0" />
            <input
              type="search"
              placeholder="Buscar por miembro, concepto..."
              aria-label="Buscar por miembro, concepto"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none font-body text-navy"
            />
          </div>

          <FilterChips
            ariaLabel="Filtrar por entidad"
            activeKey={entityFilter}
            onSelect={k => setEntityFilter(k)}
            chips={[
              { key: 'all', label: 'Todos' },
              { key: 'event', label: 'Eventos' },
              { key: 'study_group', label: 'Grupos' },
            ]}
          />

          <FilterChips
            ariaLabel="Filtrar por método de pago"
            activeKey={methodFilter}
            onSelect={k => setMethodFilter(k)}
            chips={[
              { key: 'all', label: 'Todos' },
              { key: 'card', label: 'Tarjeta' },
              { key: 'sinpe', label: 'SINPE' },
              { key: 'scholarship', label: 'Beca' },
              { key: 'cash', label: 'Efectivo' },
            ]}
          />

          <FilterChips
            ariaLabel="Filtrar por estado"
            activeKey={statusFilter}
            onSelect={k => setStatusFilter(k as 'all' | PaymentStatus)}
            chips={[
              { key: 'all', label: 'Todos' },
              { key: 'paid', label: 'Pagado' },
              { key: 'pending', label: 'Pendiente' },
              { key: 'refunded', label: 'Devuelto' },
            ]}
          />
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--outline-variant)]">
                  {['Miembro', 'Concepto', 'Monto', 'Método', 'Estado', 'Fecha', 'Acciones'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-[10px] uppercase tracking-widest font-display text-[rgba(22,20,64,0.60)]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.id} className={`border-b border-[var(--outline-variant)] hover:bg-gray-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-[rgba(22,20,64,0.01)]'}`}>
                    <td className="px-5 py-4">
                      <p className="text-[13px] font-medium font-body text-navy">{p.member_name}</p>
                      <p className="text-[11px] text-[rgba(22,20,64,0.45)] font-body">{p.member_cedula}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[13px] font-body text-navy">{p.entity_name}</p>
                      <p className="text-[11px] text-[rgba(22,20,64,0.60)] font-body">
                        {p.entity_type === 'event' ? 'Evento' : 'Grupo de estudio'}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[13px] font-medium font-body text-navy">
                        <AmountDisplay amount={p.amount} revealed={revealAll} />
                      </p>
                    </td>
                    <td className="px-5 py-4"><PaymentMethodBadge method={p.method} /></td>
                    <td className="px-5 py-4"><PaymentStatusBadge status={p.status} /></td>
                    <td className="px-5 py-4">
                      <p className="text-[12px] whitespace-nowrap font-body text-[rgba(22,20,64,0.55)]">
                        {formatDate(p.created_at)}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/finanzas/pagos/${p.id}`}
                          className="rounded-lg border px-3 py-1.5 text-[12px] transition-colors whitespace-nowrap border-[var(--outline-variant)] text-navy font-body"
                        >
                          Ver →
                        </Link>
                        {p.status === 'paid' && (
                          <button
                            onClick={() => setRefundTarget(p)}
                            className="rounded-lg border px-3 py-1.5 text-[12px] transition-colors whitespace-nowrap border-[rgba(239,85,84,0.30)] text-coral font-body"
                          >
                            Devolver
                          </button>
                        )}
                        {p.status === 'pending' && p.method === 'sinpe' && (
                          <button
                            onClick={() => setSinpeTarget(p)}
                            className="rounded-lg border px-3 py-1.5 text-[12px] transition-colors whitespace-nowrap border-[rgba(81,157,162,0.30)] text-teal-deep font-body"
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
                    <td colSpan={7}>
                      {error
                        ? <ErrorState message={error} onRetry={refetch} />
                        : <EmptyState icon={CreditCard} title="No hay pagos que coincidan con los filtros" />}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile: tarjetas */}
          <ul className="md:hidden">
            {filtered.map((p, i) => (
              <li
                key={p.id}
                className="px-4 py-3 space-y-2.5"
                style={i < filtered.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
              >
                <Link href={`/finanzas/pagos/${p.id}`} className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium font-body text-navy truncate">{p.member_name}</p>
                    <p className="text-[12px] text-[rgba(22,20,64,0.55)] font-body truncate">{p.entity_name}</p>
                    <p className="text-[11px] text-[rgba(22,20,64,0.45)] font-body mt-0.5">{formatDate(p.created_at)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <p className="text-[13px] font-medium font-body text-navy">
                      <AmountDisplay amount={p.amount} revealed={revealAll} />
                    </p>
                    <PaymentStatusBadge status={p.status} />
                  </div>
                </Link>
                <div className="flex items-center gap-2 flex-wrap">
                  <PaymentMethodBadge method={p.method} />
                  <div className="flex-1" />
                  {p.status === 'paid' && (
                    <button
                      onClick={() => setRefundTarget(p)}
                      className="rounded-lg border px-3 py-1.5 text-[12px] transition-colors whitespace-nowrap border-[rgba(239,85,84,0.30)] text-coral font-body"
                    >
                      Devolver
                    </button>
                  )}
                  {p.status === 'pending' && p.method === 'sinpe' && (
                    <button
                      onClick={() => setSinpeTarget(p)}
                      className="rounded-lg border px-3 py-1.5 text-[12px] transition-colors whitespace-nowrap border-[rgba(81,157,162,0.30)] text-teal-deep font-body"
                    >
                      Confirmar SINPE
                    </button>
                  )}
                </div>
              </li>
            ))}
            {filtered.length === 0 && (
              <li>
                {error
                  ? <ErrorState message={error} onRetry={refetch} />
                  : loading
                    ? <p className="px-4 py-8 text-center text-sm text-navy-light/60 font-body">Cargando pagos…</p>
                    : <EmptyState icon={CreditCard} title="No hay pagos que coincidan con los filtros" />}
              </li>
            )}
          </ul>
          {filtered.length > 0 && (
            <LoadMoreFooter
              shown={payments.length}
              total={total}
              hasMore={hasMore}
              loading={loading}
              onLoadMore={loadMore}
              noun="pagos"
              increment={25}
            />
          )}
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
        <Modal onClose={() => setSinpeTarget(null)} titleId="confirmar-pago-sinpe" width={448}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--outline-variant)]">
              <p id="confirmar-pago-sinpe" className="text-sm font-bold font-display text-navy">
                Confirmar pago SINPE
              </p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-[13px] font-body text-[rgba(22,20,64,0.70)]">
                <strong>{sinpeTarget.member_name}</strong> — {sinpeTarget.entity_name}
              </p>
              <div>
                <label className="text-[11px] uppercase tracking-widest mb-1.5 block font-display text-[rgba(22,20,64,0.60)]">
                  Número de confirmación SINPE
                </label>
                <input
                  type="text"
                  value={sinpeConf}
                  onChange={e => setSinpeConf(e.target.value)}
                  placeholder="ej. SINPE-2026-05-12345"
                  className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none border-[var(--outline-variant)] font-body text-navy"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-widest mb-1.5 block font-display text-[rgba(22,20,64,0.60)]">
                  Fecha de transferencia
                </label>
                <input
                  type="date"
                  value={sinpeDate}
                  onChange={e => setSinpeDate(e.target.value)}
                  className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none border-[var(--outline-variant)] font-body text-navy"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 border-[var(--outline-variant)]">
              <button onClick={() => setSinpeTarget(null)}
                className="flex-1 rounded-full border py-2.5 text-sm transition-colors border-[var(--outline-variant)] font-body text-[rgba(22,20,64,0.70)]">
                Cancelar
              </button>
              <button
                onClick={handleConfirmSinpe}
                disabled={!sinpeConf}
                className="flex-1 rounded-full py-2.5 text-sm text-white transition-all disabled:opacity-40 bg-teal-deep font-body">
                Confirmar pago
              </button>
            </div>
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm text-white bg-navy shadow-[0_12px_32px_rgba(22,20,64,0.20)] font-body">
          <Check size={15} className="text-[#3DB97A]" />
          {toast}
        </div>
      )}
    </FinanceGuard>
  )
}

export default function PagosPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-sm text-navy-light/60 font-body">Cargando...</div>
      </div>
    }>
      <PagosContent />
    </Suspense>
  )
}
