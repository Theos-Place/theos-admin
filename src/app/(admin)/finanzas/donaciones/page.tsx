'use client'

import { useState, useMemo } from 'react'
import { Heart, Upload, Search, AlertTriangle, X, Check, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { FinanceGuard } from '@/components/finance/FinanceGuard'
import { AmountDisplay } from '@/components/finance/AmountDisplay'
import { MOCK_DONATIONS } from '@/data/mock-finance'
import { mockMembers } from '@/data/mock-members'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function DonacionesPage() {
  const [revealAll, setRevealAll] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'identified' | 'unidentified'>('all')
  const [search, setSearch] = useState('')
  const [showUnidentifiedModal, setShowUnidentifiedModal] = useState(false)
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const [linkSearch, setLinkSearch] = useState('')
  const [donations, setDonations] = useState(MOCK_DONATIONS)
  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
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

  const linkResults = useMemo(() => {
    if (!linkSearch.trim()) return []
    const q = linkSearch.toLowerCase()
    return mockMembers.filter(m =>
      `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
      (m.cedula ?? '').includes(q)
    ).slice(0, 6)
  }, [linkSearch])

  function handleLink(donationId: string, memberId: string, memberName: string, memberCedula: string) {
    setDonations(prev => prev.map(d =>
      d.id === donationId
        ? { ...d, member_id: memberId, member_name: memberName, member_cedula: memberCedula ?? d.member_cedula, is_identified: true }
        : d
    ))
    setLinkingId(null)
    setLinkSearch('')
    showToast(`Donación vinculada a ${memberName}`)
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
              <Heart size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl text-white" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}>
                Donaciones
              </h1>
              <p className="text-[12px] text-white/50 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
                Historial y gestión de donaciones importadas
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setRevealAll(r => !r)}
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] transition-all"
              style={{ background: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.70)', fontFamily: 'var(--font-body)' }}
            >
              {revealAll ? <EyeOff size={13} /> : <Eye size={13} />}
              {revealAll ? 'Ocultar montos' : 'Mostrar montos'}
            </button>
            <Link
              href="/finanzas/donaciones/importar"
              className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm text-white transition-all shrink-0"
              style={{ background: '#EF5554', fontFamily: 'var(--font-body)', boxShadow: '0 8px 24px rgba(239,85,84,0.30)' }}
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
            <div key={label} className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
              <p className="text-[10px] uppercase tracking-widest mb-2" style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>{label}</p>
              {isAmount
                ? <p className="text-2xl font-extrabold" style={{ fontFamily: 'var(--font-display)', color: '#519DA2' }}>
                    <AmountDisplay amount={value as number} defaultHidden={false} revealed={revealAll} />
                  </p>
                : <p className="text-4xl font-extrabold" style={{ fontFamily: 'var(--font-display)', color: alert ? '#EF5554' : '#161440' }}>
                    {value}
                  </p>
              }
            </div>
          ))}
        </div>

        {/* Unidentified warning */}
        {unidentified.length > 0 && (
          <div className="rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            style={{ background: 'rgba(233,185,73,0.10)', border: '1px solid rgba(233,185,73,0.25)' }}>
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} style={{ color: '#E9B949', flexShrink: 0, marginTop: 1 }} />
              <div>
                <p className="text-[13px] font-semibold" style={{ fontFamily: 'var(--font-body)', color: '#9B7200' }}>
                  {unidentified.length} donación{unidentified.length !== 1 ? 'es' : ''} sin identificar — <AmountDisplay amount={unidentifiedTotal} defaultHidden={false} revealed={revealAll} /> en total
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(155,114,0,0.70)', fontFamily: 'var(--font-body)' }}>
                  Vinculalas manualmente a un miembro para que queden registradas correctamente.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowUnidentifiedModal(true)}
              className="shrink-0 rounded-full px-4 py-2 text-[12px] font-medium transition-all"
              style={{ background: 'rgba(233,185,73,0.20)', color: '#9B7200', fontFamily: 'var(--font-body)', border: '1px solid rgba(233,185,73,0.30)' }}
            >
              Resolver manualmente →
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 flex-1 min-w-48" style={{ background: 'var(--surface-card)', border: '1px solid var(--outline-variant)' }}>
            <Search size={14} style={{ color: 'rgba(22,20,64,0.40)', flexShrink: 0 }} />
            <input
              type="search"
              placeholder="Buscar por nombre o cédula..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ fontFamily: 'var(--font-body)', color: '#161440' }}
            />
          </div>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="rounded-xl border px-3 py-2.5 text-sm outline-none"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)', color: '#161440' }}
          />
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="rounded-xl border px-3 py-2.5 text-sm outline-none"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)', color: '#161440' }}
          />
          <div className="flex gap-1.5">
            {(['all', 'identified', 'unidentified'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className="rounded-full px-3.5 py-2 text-[12px] font-medium border transition-all"
                style={{
                  background: statusFilter === s ? '#161440' : 'transparent',
                  color: statusFilter === s ? 'white' : 'rgba(22,20,64,0.60)',
                  borderColor: statusFilter === s ? '#161440' : 'transparent',
                  fontFamily: 'var(--font-display)',
                }}
              >
                {s === 'all' ? 'Todos' : s === 'identified' ? 'Identificado' : 'No identificado'}
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
                  {['Miembro', 'Cédula', 'Fecha', 'Monto', 'Lote importación', 'Estado'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-[10px] uppercase tracking-widest"
                      style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((d, i) => (
                  <tr key={d.id} className="border-b hover:bg-gray-50 transition-colors"
                    style={{ borderColor: 'var(--outline-variant)', background: i % 2 === 0 ? 'white' : 'rgba(22,20,64,0.01)' }}>
                    <td className="px-5 py-4">
                      <p className="text-[13px] font-medium" style={{ fontFamily: 'var(--font-body)', color: d.is_identified ? '#161440' : '#EF5554' }}>
                        {d.member_name}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[13px]" style={{ fontFamily: 'var(--font-body)', color: 'rgba(22,20,64,0.60)' }}>
                        {d.member_cedula}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[13px] whitespace-nowrap" style={{ fontFamily: 'var(--font-body)', color: 'rgba(22,20,64,0.60)' }}>
                        {formatDate(d.donation_date)}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[13px] font-medium" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>
                        <AmountDisplay amount={d.amount} revealed={revealAll} />
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[12px]" style={{ fontFamily: 'var(--font-body)', color: 'rgba(22,20,64,0.55)' }}>
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
                    <td colSpan={6} className="px-5 py-12 text-center text-sm" style={{ fontFamily: 'var(--font-body)', color: 'rgba(22,20,64,0.40)' }}>
                      No hay donaciones que coincidan con los filtros
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Unidentified Modal */}
      {showUnidentifiedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(22,20,64,0.40)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-xl rounded-2xl overflow-hidden max-h-[80vh] flex flex-col" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--outline-variant)' }}>
              <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: '#161440' }}>
                Donaciones sin identificar ({unidentified.length})
              </p>
              <button onClick={() => { setShowUnidentifiedModal(false); setLinkingId(null); setLinkSearch('') }}>
                <X size={18} style={{ color: 'rgba(22,20,64,0.40)' }} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {unidentified.map(d => (
                <div key={d.id} className="border-b px-6 py-4 space-y-3" style={{ borderColor: 'var(--outline-variant)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[13px] font-medium" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>
                        {formatDate(d.donation_date)} — <AmountDisplay amount={d.amount} defaultHidden={false} />
                      </p>
                      <p className="text-[11px]" style={{ color: 'rgba(22,20,64,0.50)', fontFamily: 'var(--font-body)' }}>
                        {d.source_file}
                      </p>
                    </div>
                    <button
                      onClick={() => setLinkingId(linkingId === d.id ? null : d.id)}
                      className="rounded-full px-3 py-1.5 text-[12px] font-medium transition-all"
                      style={{ background: 'rgba(81,157,162,0.10)', color: '#519DA2', fontFamily: 'var(--font-body)', border: '1px solid rgba(81,157,162,0.20)' }}
                    >
                      {linkingId === d.id ? 'Cancelar' : 'Vincular a miembro'}
                    </button>
                  </div>
                  {linkingId === d.id && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 rounded-xl border px-3 py-2"
                        style={{ borderColor: 'var(--outline-variant)' }}>
                        <Search size={13} style={{ color: 'rgba(22,20,64,0.40)' }} />
                        <input
                          autoFocus
                          type="text"
                          placeholder="Buscar miembro por nombre o cédula..."
                          value={linkSearch}
                          onChange={e => setLinkSearch(e.target.value)}
                          className="flex-1 bg-transparent text-sm outline-none"
                          style={{ fontFamily: 'var(--font-body)', color: '#161440' }}
                        />
                      </div>
                      {linkResults.length > 0 && (
                        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--outline-variant)' }}>
                          {linkResults.map(m => (
                            <button
                              key={m.id}
                              onClick={() => handleLink(d.id, m.id, `${m.first_name} ${m.last_name}`, m.cedula ?? '')}
                              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-low transition-colors border-b last:border-0 text-left"
                              style={{ borderColor: 'var(--outline-variant)' }}
                            >
                              <Check size={13} style={{ color: '#3DB97A', flexShrink: 0 }} />
                              <div>
                                <p className="text-[13px] font-medium" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>
                                  {m.first_name} {m.last_name}
                                </p>
                                <p className="text-[11px]" style={{ color: 'rgba(22,20,64,0.50)', fontFamily: 'var(--font-body)' }}>
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
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm text-white"
          style={{ background: '#161440', boxShadow: '0 12px 32px rgba(22,20,64,0.20)', fontFamily: 'var(--font-body)' }}
        >
          <Check size={15} style={{ color: '#3DB97A' }} />
          {toast}
        </div>
      )}
    </FinanceGuard>
  )
}
