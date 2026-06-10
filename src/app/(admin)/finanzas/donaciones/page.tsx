'use client'

import { useState, useMemo, useEffect } from 'react'
import { Heart, Upload, Search, AlertTriangle, X, Check, Eye, EyeOff } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import Link from 'next/link'
import { FinanceGuard } from '@/components/finance/FinanceGuard'
import { AmountDisplay } from '@/components/finance/AmountDisplay'
import { useFinance } from '@/hooks/useFinance'
import { TOAST_MS } from '@/lib/constants'

type MemberLite = { id: string; first_name: string; last_name: string; cedula: string | null }

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function DonacionesPage() {
  const { donations: MOCK_DONATIONS, refetch } = useFinance()
  const [revealAll, setRevealAll] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'identified' | 'unidentified'>('all')
  const [search, setSearch] = useState('')
  const [showUnidentifiedModal, setShowUnidentifiedModal] = useState(false)
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const [linkSearch, setLinkSearch] = useState('')
  const [donations, setDonations] = useState(MOCK_DONATIONS)
  const [linkResults, setLinkResults] = useState<MemberLite[]>([])
  const [toast, setToast] = useState('')

  // Sincroniza con los datos reales cuando cargan/refrescan.
  useEffect(() => { setDonations(MOCK_DONATIONS) }, [MOCK_DONATIONS])

  // Búsqueda real de miembros para vincular (debounced).
  useEffect(() => {
    const q = linkSearch.trim()
    if (q.length < 2) { setLinkResults([]); return }
    let alive = true
    const t = setTimeout(() => {
      fetch(`/api/members?search=${encodeURIComponent(q)}&pageSize=6`)
        .then(r => (r.ok ? r.json() : { members: [] }))
        .then(d => { if (alive) setLinkResults((d.members ?? []) as MemberLite[]) })
        .catch(() => { if (alive) setLinkResults([]) })
    }, 300)
    return () => { alive = false; clearTimeout(t) }
  }, [linkSearch])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), TOAST_MS)
  }

  const unidentified = donations.filter(d => !d.is_identified)
  const unidentifiedTotal = unidentified.reduce((s, d) => s + d.amount, 0)

  const uniqueDonors = new Set(donations.filter(d => d.is_identified).map(d => d.member_id)).size
  const now = new Date()
  const thisMonth = donations.filter(d => {
    const dt = new Date(d.donation_date)
    return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear()
  })
  const totalThisMonth = thisMonth.reduce((s, d) => s + d.amount, 0)

  const filtered = useMemo(() => {
    return donations.filter(d => {
      const q = search.toLowerCase()
      const matchSearch = !q
        || d.member_name.toLowerCase().includes(q)
        || d.member_cedula.includes(q)
      const matchStatus = statusFilter === 'all'
        || (statusFilter === 'identified' ? d.is_identified : !d.is_identified)
      const dt = new Date(d.donation_date)
      const matchFrom = !dateFrom || dt >= new Date(dateFrom)
      const matchTo = !dateTo || dt <= new Date(dateTo)
      return matchSearch && matchStatus && matchFrom && matchTo
    })
  }, [donations, search, statusFilter, dateFrom, dateTo])

  async function handleLink(donationId: string, memberId: string, memberName: string, memberCedula: string) {
    // Optimista
    setDonations(prev => prev.map(d =>
      d.id === donationId
        ? { ...d, member_id: memberId, member_name: memberName, member_cedula: memberCedula ?? d.member_cedula, is_identified: true }
        : d
    ))
    setLinkingId(null)
    setLinkSearch('')
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
              <p className="text-[12px] text-white/50 mt-0.5 font-body">
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
            { label: 'Sin identificar', value: unidentified.length, isAmount: false, alert: unidentified.length > 0 },
          ].map(({ label, value, isAmount, alert }) => (
            <div key={label} className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)]">
              <p className="text-[10px] uppercase tracking-widest mb-2 font-display text-[rgba(22,20,64,0.40)]">{label}</p>
              {isAmount
                ? <p className="text-2xl font-extrabold font-display text-teal-deep">
                    <AmountDisplay amount={value as number} defaultHidden={false} revealed={revealAll} />
                  </p>
                : <p className={`text-4xl font-extrabold font-display ${alert ? 'text-coral' : 'text-navy'}`}>
                    {value}
                  </p>
              }
            </div>
          ))}
        </div>

        {/* Unidentified warning */}
        {unidentified.length > 0 && (
          <div className="rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[rgba(233,185,73,0.10)] border border-[rgba(233,185,73,0.25)]">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-[#E9B949] shrink-0 mt-[1px]" />
              <div>
                <p className="text-[13px] font-semibold font-body text-[#9B7200]">
                  {unidentified.length} donación{unidentified.length !== 1 ? 'es' : ''} sin identificar — <AmountDisplay amount={unidentifiedTotal} defaultHidden={false} revealed={revealAll} /> en total
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
            <Search size={14} className="text-[rgba(22,20,64,0.40)] shrink-0" />
            <input
              type="search"
              placeholder="Buscar por nombre o cédula..."
              aria-label="Buscar por nombre o cédula"
              value={search}
              onChange={e => setSearch(e.target.value)}
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
          <div className="flex gap-1.5">
            {(['all', 'identified', 'unidentified'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className="rounded-full px-3.5 py-2 text-[12px] font-medium border transition-all font-display"
                style={{
                  background: statusFilter === s ? '#161440' : 'transparent',
                  color: statusFilter === s ? 'white' : 'rgba(22,20,64,0.60)',
                  borderColor: statusFilter === s ? '#161440' : 'transparent',
                }}
              >
                {s === 'all' ? 'Todos' : s === 'identified' ? 'Identificado' : 'No identificado'}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--outline-variant)]">
                  {['Miembro', 'Cédula', 'Fecha', 'Monto', 'Lote importación', 'Estado'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-[10px] uppercase tracking-widest font-display text-[rgba(22,20,64,0.40)]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((d, i) => (
                  <tr key={d.id} className={`border-b border-[var(--outline-variant)] hover:bg-gray-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-[rgba(22,20,64,0.01)]'}`}>
                    <td className="px-5 py-4">
                      <p className={`text-[13px] font-medium font-body ${d.is_identified ? 'text-navy' : 'text-coral'}`}>
                        {d.member_name}
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
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState icon={Heart} title="No hay donaciones que coincidan con los filtros" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile: tarjetas */}
          <ul className="md:hidden">
            {filtered.map((d, i) => (
              <li
                key={d.id}
                className="px-4 py-3 flex items-center gap-3"
                style={i < filtered.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
              >
                <div className="min-w-0 flex-1">
                  <p className={`text-[13px] font-medium font-body truncate ${d.is_identified ? 'text-navy' : 'text-coral'}`}>
                    {d.member_name}
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
            {filtered.length === 0 && (
              <li>
                <EmptyState icon={Heart} title="No hay donaciones que coincidan con los filtros" />
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Unidentified Modal */}
      {showUnidentifiedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(22,20,64,0.40)] backdrop-blur-[4px]">
          <div className="w-full max-w-xl rounded-2xl overflow-hidden max-h-[80vh] flex flex-col bg-surface-card shadow-[var(--shadow-lg)]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--outline-variant)]">
              <p className="text-sm font-bold font-display text-navy">
                Donaciones sin identificar ({unidentified.length})
              </p>
              <button onClick={() => { setShowUnidentifiedModal(false); setLinkingId(null); setLinkSearch('') }}>
                <X size={18} className="text-[rgba(22,20,64,0.40)]" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {unidentified.map(d => (
                <div key={d.id} className="border-b px-6 py-4 space-y-3 border-[var(--outline-variant)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[13px] font-medium font-body text-navy">
                        {formatDate(d.donation_date)} — <AmountDisplay amount={d.amount} defaultHidden={false} />
                      </p>
                      <p className="text-[11px] text-[rgba(22,20,64,0.50)] font-body">
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
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 rounded-xl border px-3 py-2 border-[var(--outline-variant)]">
                        <Search size={13} className="text-[rgba(22,20,64,0.40)]" />
                        <input
                          autoFocus
                          type="text"
                          placeholder="Buscar miembro por nombre o cédula..."
                          aria-label="Buscar miembro por nombre o cédula"
                          value={linkSearch}
                          onChange={e => setLinkSearch(e.target.value)}
                          className="flex-1 bg-transparent text-sm outline-none font-body text-navy"
                        />
                      </div>
                      {linkResults.length > 0 && (
                        <div className="rounded-xl border overflow-hidden border-[var(--outline-variant)]">
                          {linkResults.map(m => (
                            <button
                              key={m.id}
                              onClick={() => handleLink(d.id, m.id, `${m.first_name} ${m.last_name}`, m.cedula ?? '')}
                              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-low transition-colors border-b last:border-0 text-left border-[var(--outline-variant)]"
                            >
                              <Check size={13} className="text-[#3DB97A] shrink-0" />
                              <div>
                                <p className="text-[13px] font-medium font-body text-navy">
                                  {m.first_name} {m.last_name}
                                </p>
                                <p className="text-[11px] text-[rgba(22,20,64,0.50)] font-body">
                                  {m.cedula ?? 'Sin cédula'}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
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
