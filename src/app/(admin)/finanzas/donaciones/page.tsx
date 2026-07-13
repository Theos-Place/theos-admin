'use client'

import { useState, useEffect } from 'react'
import { Heart, Upload, Search, AlertTriangle, Check, Eye, EyeOff } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Modal } from '@/components/shared/Modal'
import { MemberCombobox } from '@/components/shared/MemberCombobox'
import { FilterChips } from '@/components/shared/FilterChips'
import Link from 'next/link'
import { FinanceGuard } from '@/components/finance/FinanceGuard'
import { AmountDisplay } from '@/components/finance/AmountDisplay'
import { useDonations } from '@/hooks/useDonations'
import { toDomainDonation } from '@/lib/finance/adapter'
import type { Donation } from '@/types/finance'
import type { DbDonation } from '@/lib/supabase/queries/finance'
import { TOAST_MS } from '@/lib/constants'
import { formatDate } from '@/lib/format'

type StatusFilter = 'all' | 'identified' | 'unidentified'

export default function DonacionesPage() {
  const [revealAll, setRevealAll] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  // Debounce de la búsqueda (server-side): no refetch por cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const { donations, total, stats, loading, error, hasMore, loadMore, refetch } =
    useDonations({ search, status: statusFilter, from: dateFrom, to: dateTo })

  const [showUnidentifiedModal, setShowUnidentifiedModal] = useState(false)
  const [unidentified, setUnidentified] = useState<Donation[]>([])
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const [linkConfirm, setLinkConfirm] = useState<{ donationId: string; memberId: string; memberName: string } | null>(null)
  const [toast, setToast] = useState('')

  // El modal carga las donaciones sin identificar aparte (no están en la lista
  // paginada salvo que el filtro sea 'unidentified').
  useEffect(() => {
    if (!showUnidentifiedModal) return
    let alive = true
    fetch('/api/finance/donations?status=unidentified&pageSize=200')
      .then(r => (r.ok ? r.json() : null))
      .then((d: { donations: DbDonation[] } | null) => {
        if (alive && d) setUnidentified((d.donations ?? []).map(toDomainDonation))
      })
      .catch(() => {})
    return () => { alive = false }
  }, [showUnidentifiedModal])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), TOAST_MS)
  }

  const uniqueDonors = stats?.unique_donors ?? 0
  const totalThisMonth = stats?.total_this_month ?? null
  const unidentifiedCount = stats?.unidentified_count ?? 0
  const unidentifiedTotal = stats?.unidentified_total ?? null

  async function handleLink(donationId: string, memberId: string, memberName: string) {
    setUnidentified(prev => prev.filter(d => d.id !== donationId))
    setLinkingId(null)
    try {
      const res = await fetch(`/api/finance/donations/${donationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      showToast(`Donación vinculada a ${memberName}`)
      refetch()
    } catch (err) {
      console.error('No se pudo vincular la donación:', err)
      showToast('No se pudo vincular la donación. Intentá de nuevo.')
      refetch()
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
              <Heart size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl text-white font-display font-extrabold tracking-[-0.02em]">
                Donaciones
              </h1>
              <p className="text-[12px] text-white/70 mt-0.5 font-body">
                Historial y gestión de donaciones importadas
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setRevealAll(r => !r)}
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] transition-all bg-[rgba(255,255,255,0.10)] text-[rgba(255,255,255,0.70)] font-body"
            >
              {revealAll ? <EyeOff size={13} /> : <Eye size={13} />}
              {revealAll ? 'Ocultar montos' : 'Mostrar montos'}
            </button>
            <Link
              href="/finanzas/donaciones/importar"
              className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm text-white transition-all shrink-0 bg-coral font-body shadow-[0_8px_24px_rgba(239,85,84,0.30)]"
            >
              <Upload size={15} />
              Importar donaciones
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Donadores identificados', value: uniqueDonors, isAmount: false },
            { label: 'Total donado este mes', value: totalThisMonth, isAmount: true },
            { label: 'Sin identificar', value: unidentifiedCount, isAmount: false, alert: unidentifiedCount > 0 },
          ].map(({ label, value, isAmount, alert }) => (
            <div key={label} className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)]">
              <p className="text-[10px] uppercase tracking-widest mb-2 font-display text-[rgba(22,20,64,0.60)]">{label}</p>
              {isAmount
                ? <p className="text-2xl font-extrabold font-display text-teal-deep">
                    <AmountDisplay amount={value as number | null} defaultHidden={false} revealed={revealAll} />
                  </p>
                : <p className={`text-4xl font-extrabold font-display ${alert ? 'text-coral' : 'text-navy'}`}>
                    {value}
                  </p>
              }
            </div>
          ))}
        </div>

        {/* Unidentified warning */}
        {unidentifiedCount > 0 && (
          <div className="rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[rgba(233,185,73,0.10)] border border-[rgba(233,185,73,0.25)]">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-[#E9B949] shrink-0 mt-[1px]" />
              <div>
                <p className="text-[13px] font-semibold font-body text-[#9B7200]">
                  {unidentifiedCount} donación{unidentifiedCount !== 1 ? 'es' : ''} sin identificar — <AmountDisplay amount={unidentifiedTotal} defaultHidden={false} revealed={revealAll} /> en total
                </p>
                <p className="text-[11px] mt-0.5 text-[rgba(155,114,0,0.70)] font-body">
                  Vinculalas manualmente a un miembro para que queden registradas correctamente.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowUnidentifiedModal(true)}
              className="shrink-0 rounded-full px-4 py-2 text-[12px] font-medium transition-all bg-[rgba(233,185,73,0.20)] text-[#9B7200] font-body border border-[rgba(233,185,73,0.30)]"
            >
              Resolver manualmente →
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 flex-1 min-w-48 bg-surface-card border border-[var(--outline-variant)]">
            <Search size={14} className="text-[rgba(22,20,64,0.60)] shrink-0" />
            <input
              type="search"
              placeholder="Buscar por nombre o cédula..."
              aria-label="Buscar por nombre o cédula"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none font-body text-navy"
            />
          </div>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="rounded-xl border px-3 py-2.5 text-sm outline-none border-[var(--outline-variant)] font-body text-navy max-w-full"
          />
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="rounded-xl border px-3 py-2.5 text-sm outline-none border-[var(--outline-variant)] font-body text-navy max-w-full"
          />
          <FilterChips
            ariaLabel="Filtrar por estado de identificación"
            activeKey={statusFilter}
            onSelect={k => setStatusFilter(k as StatusFilter)}
            chips={[
              { key: 'all', label: 'Todos' },
              { key: 'identified', label: 'Identificado' },
              { key: 'unidentified', label: 'No identificado' },
            ]}
          />
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--outline-variant)]">
                  {['Miembro', 'Cédula', 'Fecha', 'Monto', 'Lote importación', 'Estado'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-[10px] uppercase tracking-widest font-display text-[rgba(22,20,64,0.60)]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {donations.map((d, i) => (
                  <tr key={d.id} className={`border-b border-[var(--outline-variant)] hover:bg-gray-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-[rgba(22,20,64,0.01)]'}`}>
                    <td className="px-5 py-4">
                      <p className={`text-[13px] font-medium font-body ${d.is_identified ? 'text-navy' : 'text-coral'}`}>
                        {d.member_name || 'Sin identificar'}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[13px] font-body text-[rgba(22,20,64,0.60)]">
                        {d.member_cedula}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[13px] whitespace-nowrap font-body text-[rgba(22,20,64,0.60)]">
                        {formatDate(d.donation_date)}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[13px] font-medium font-body text-navy">
                        <AmountDisplay amount={d.amount} revealed={revealAll} />
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[12px] font-body text-[rgba(22,20,64,0.55)]">
                        {d.source_file}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium"
                        style={{
                          color: d.is_identified ? '#3DB97A' : '#EF5554',
                          background: d.is_identified ? 'rgba(61,185,122,0.10)' : 'rgba(239,85,84,0.10)',
                        }}
                      >
                        {d.is_identified ? 'Identificado' : 'Sin identificar'}
                      </span>
                    </td>
                  </tr>
                ))}
                {donations.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6}>
                      {error
                        ? <ErrorState message={error} onRetry={refetch} />
                        : <EmptyState icon={Heart} title="No hay donaciones que coincidan con los filtros" />}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile: tarjetas */}
          <ul className="md:hidden">
            {donations.map((d, i) => (
              <li
                key={d.id}
                className="px-4 py-3 flex items-center gap-3"
                style={i < donations.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
              >
                <div className="min-w-0 flex-1">
                  <p className={`text-[13px] font-medium font-body truncate ${d.is_identified ? 'text-navy' : 'text-coral'}`}>
                    {d.member_name || 'Sin identificar'}
                  </p>
                  <p className="text-[12px] text-[rgba(22,20,64,0.55)] font-body truncate">
                    {d.member_cedula} · {formatDate(d.donation_date)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <p className="text-[13px] font-medium font-body text-navy">
                    <AmountDisplay amount={d.amount} revealed={revealAll} />
                  </p>
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      color: d.is_identified ? '#3DB97A' : '#EF5554',
                      background: d.is_identified ? 'rgba(61,185,122,0.10)' : 'rgba(239,85,84,0.10)',
                    }}
                  >
                    {d.is_identified ? 'Identificado' : 'Sin identificar'}
                  </span>
                </div>
              </li>
            ))}
            {donations.length === 0 && !loading && (
              <li>
                {error
                  ? <ErrorState message={error} onRetry={refetch} />
                  : <EmptyState icon={Heart} title="No hay donaciones que coincidan con los filtros" />}
              </li>
            )}
          </ul>
        </div>

        {/* Paginación / contador */}
        {donations.length > 0 && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-navy-light/60 font-body">
              Mostrando {donations.length.toLocaleString('es-CR')} de {total.toLocaleString('es-CR')} donaciones
            </p>
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loading}
                className="rounded-full border px-5 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body disabled:opacity-50"
              >
                {loading ? 'Cargando…' : 'Cargar 50 más'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Unidentified Modal */}
      {showUnidentifiedModal && (
        <Modal
          onClose={() => { setShowUnidentifiedModal(false); setLinkingId(null) }}
          titleId="donaciones-sin-identificar"
          width={576}
        >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--outline-variant)]">
              <p id="donaciones-sin-identificar" className="text-sm font-bold font-display text-navy">
                Donaciones sin identificar ({unidentifiedCount})
              </p>
            </div>
            <div className="overflow-y-auto flex-1">
              {unidentified.map(d => (
                <div key={d.id} className="border-b px-6 py-4 space-y-3 border-[var(--outline-variant)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[13px] font-medium font-body text-navy">
                        {formatDate(d.donation_date)} — <AmountDisplay amount={d.amount} defaultHidden={false} />
                      </p>
                      <p className="text-[11px] text-[rgba(22,20,64,0.60)] font-body">
                        {d.source_file}
                      </p>
                    </div>
                    <button
                      onClick={() => setLinkingId(linkingId === d.id ? null : d.id)}
                      className="rounded-full px-3 py-1.5 text-[12px] font-medium transition-all bg-[rgba(81,157,162,0.10)] text-teal-deep font-body border border-[rgba(81,157,162,0.20)]"
                    >
                      {linkingId === d.id ? 'Cancelar' : 'Vincular a miembro'}
                    </button>
                  </div>
                  {linkingId === d.id && (
                    <MemberCombobox
                      autoFocus
                      pageSize={6}
                      placeholder="Buscar miembro por nombre o cédula..."
                      onSelect={m => setLinkConfirm({ donationId: d.id, memberId: m.id, memberName: `${m.first_name} ${m.last_name}`.trim() })}
                    />
                  )}
                </div>
              ))}
              {unidentified.length === 0 && (
                <p className="px-6 py-8 text-center text-sm text-navy-light/60 font-body">
                  No hay donaciones sin identificar.
                </p>
              )}
            </div>
        </Modal>
      )}

      {/* Confirmación de vínculo: reasigna la donación al miembro (sin deshacer en la UI). */}
      {linkConfirm && (
        <Modal onClose={() => setLinkConfirm(null)} titleId="vincular-donacion-titulo" width={400}>
          <div className="p-5 space-y-4">
            <h3 id="vincular-donacion-titulo" className="font-semibold text-navy font-display">Vincular donación</h3>
            <p className="text-sm text-navy-light/70 font-body">
              ¿Vincular esta donación a <strong>{linkConfirm.memberName}</strong>?
              La donación quedará identificada a su nombre.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { handleLink(linkConfirm.donationId, linkConfirm.memberId, linkConfirm.memberName); setLinkConfirm(null) }}
                className="flex-1 rounded-full bg-teal-deep px-4 py-2 text-sm text-white hover:opacity-90 transition-opacity font-body"
              >
                Vincular
              </button>
              <button
                onClick={() => setLinkConfirm(null)}
                className="rounded-full border border-[var(--outline-variant)] px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
              >
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm text-white bg-navy shadow-[0_12px_32px_rgba(22,20,64,0.20)] font-body"
        >
          <Check size={15} className="text-[#3DB97A]" />
          {toast}
        </div>
      )}
    </FinanceGuard>
  )
}
