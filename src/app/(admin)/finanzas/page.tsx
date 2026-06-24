'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  DollarSign, Heart, CreditCard, ArrowLeftRight, Eye, EyeOff,
  AlertCircle, Upload, GraduationCap, BarChart2, RefreshCw, TrendingUp,
} from 'lucide-react'
import { FinanceGuard } from '@/components/finance/FinanceGuard'
import { AmountDisplay } from '@/components/finance/AmountDisplay'
import { PaymentMethodBadge } from '@/components/finance/PaymentMethodBadge'
import { PaymentStatusBadge } from '@/components/finance/PaymentStatusBadge'
import { FinanceChart } from '@/components/finance/FinanceChart'
import { useFinance } from '@/hooks/useFinance'
import { formatDate } from '@/lib/format'

export default function FinanzasPage() {
  const { payments: MOCK_PAYMENTS, donations: MOCK_DONATIONS, refunds: MOCK_REFUNDS } = useFinance()
  const [period, setPeriod] = useState<'month' | 'prev_month' | 'year'>('month')
  const [revealAll, setRevealAll] = useState(false)

  const now = new Date()
  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()

  const filteredPayments = useMemo(() => {
    return MOCK_PAYMENTS.filter(p => {
      if (!p.paid_at || p.status !== 'paid') return false
      const d = new Date(p.paid_at)
      if (period === 'month') return d.getMonth() === thisMonth && d.getFullYear() === thisYear
      if (period === 'prev_month') {
        const prev = thisMonth === 0 ? 11 : thisMonth - 1
        const prevY = thisMonth === 0 ? thisYear - 1 : thisYear
        return d.getMonth() === prev && d.getFullYear() === prevY
      }
      return d.getFullYear() === thisYear
    })
  }, [period, thisMonth, thisYear])

  const filteredDonations = useMemo(() => {
    return MOCK_DONATIONS.filter(d => {
      const dt = new Date(d.donation_date)
      if (period === 'month') return dt.getMonth() === thisMonth && dt.getFullYear() === thisYear
      if (period === 'prev_month') {
        const prev = thisMonth === 0 ? 11 : thisMonth - 1
        const prevY = thisMonth === 0 ? thisYear - 1 : thisYear
        return dt.getMonth() === prev && dt.getFullYear() === prevY
      }
      return dt.getFullYear() === thisYear
    })
  }, [period, thisMonth, thisYear])

  const totalIngresos = filteredPayments.reduce((s, p) => s + p.amount, 0)
    + filteredDonations.reduce((s, d) => s + d.amount, 0)

  const activeDonors = new Set(filteredDonations.filter(d => d.is_identified).map(d => d.member_id)).size
  const pendingPayments = MOCK_PAYMENTS.filter(p => p.status === 'pending').length
  const pendingRefunds = MOCK_REFUNDS.filter(r => r.status === 'pending' || r.status === 'processing').length
  const sinpePendingRefunds = MOCK_REFUNDS.filter(r => r.sinpe_pending && (r.status === 'pending' || r.status === 'processing'))
  const failedRecent7 = MOCK_PAYMENTS.filter(p => {
    if (p.status !== 'failed') return false
    const d = new Date(p.created_at)
    return (now.getTime() - d.getTime()) < 7 * 24 * 60 * 60 * 1000
  })
  const unusedScholarships: number = 3 // from MOCK_SCHOLARSHIPS where !is_used

  const recentPayments = [...MOCK_PAYMENTS]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8)

  const PERIOD_OPTIONS = [
    { value: 'month', label: 'Este mes' },
    { value: 'prev_month', label: 'Mes anterior' },
    { value: 'year', label: 'Este año' },
  ] as const

  return (
    <FinanceGuard>
      <div className="space-y-6">

        {/* Header strip */}
        <div
          className="rounded-2xl px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-navy shadow-[var(--shadow-md)]"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-[rgba(255,255,255,0.10)]">
              <DollarSign size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl text-white font-display font-extrabold tracking-[-0.02em]">
                Finanzas
              </h1>
              <p className="text-[12px] text-white/70 mt-0.5 font-body">
                Gestión financiera de Theos Place
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Period selector */}
            <div className="flex gap-1 flex-wrap">
              {PERIOD_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setPeriod(opt.value)}
                  className="rounded-full px-3 py-1.5 text-[12px] transition-all font-body"
                  style={{
                    background: period === opt.value ? 'rgba(255,255,255,0.20)' : 'transparent',
                    color: period === opt.value ? 'white' : 'rgba(255,255,255,0.55)',
                    border: period === opt.value ? '1px solid rgba(255,255,255,0.25)' : '1px solid transparent',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {/* Eye toggle */}
            <button
              onClick={() => setRevealAll(r => !r)}
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] transition-all font-body border border-transparent"
              style={{
                background: revealAll ? 'rgba(81,157,162,0.25)' : 'rgba(255,255,255,0.10)',
                color: revealAll ? '#70BDC2' : 'rgba(255,255,255,0.60)',
              }}
            >
              {revealAll ? <EyeOff size={13} /> : <Eye size={13} />}
              {revealAll ? 'Ocultar montos' : 'Mostrar montos'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total ingresos */}
          <div className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)]">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} className="text-[#3DB97A]" />
              <p className="text-[10px] uppercase tracking-widest font-display text-[rgba(22,20,64,0.60)]">Total ingresos</p>
            </div>
            <p className="text-2xl font-extrabold font-display text-navy">
              <AmountDisplay amount={totalIngresos} defaultHidden={false} revealed={revealAll} />
            </p>
          </div>

          {/* Donadores activos */}
          <div className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)]">
            <div className="flex items-center gap-2 mb-3">
              <Heart size={16} className="text-teal-deep" />
              <p className="text-[10px] uppercase tracking-widest font-display text-[rgba(22,20,64,0.60)]">Donadores activos</p>
            </div>
            <p className="text-4xl font-extrabold font-display text-teal-deep">
              {activeDonors}
            </p>
          </div>

          {/* Pagos pendientes */}
          <div className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)]">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard size={16} className={`${pendingPayments > 0 ? 'text-coral' : 'text-navy'}`} />
              <p className="text-[10px] uppercase tracking-widest font-display text-[rgba(22,20,64,0.60)]">Pagos pendientes</p>
            </div>
            <div className="flex items-center gap-2">
              <p className={`text-4xl font-extrabold font-display ${pendingPayments > 0 ? 'text-coral' : 'text-navy'}`}>
                {pendingPayments}
              </p>
              {pendingPayments > 0 && (
                <span className="text-[10px] rounded-full px-2 py-0.5 font-medium bg-[rgba(239,85,84,0.10)] text-coral">
                  Revisar
                </span>
              )}
            </div>
          </div>

          {/* Devoluciones pendientes */}
          <div className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)]">
            <div className="flex items-center gap-2 mb-3">
              <ArrowLeftRight size={16} className={`${pendingRefunds > 0 ? 'text-coral' : 'text-navy'}`} />
              <p className="text-[10px] uppercase tracking-widest font-display text-[rgba(22,20,64,0.60)]">Devoluciones pend.</p>
            </div>
            <div className="flex items-center gap-2">
              <p className={`text-4xl font-extrabold font-display ${pendingRefunds > 0 ? 'text-coral' : 'text-navy'}`}>
                {pendingRefunds}
              </p>
              {pendingRefunds > 0 && (
                <span className="text-[10px] rounded-full px-2 py-0.5 font-medium bg-[rgba(239,85,84,0.10)] text-coral">
                  Revisar
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Chart */}
        <FinanceChart payments={MOCK_PAYMENTS} donations={MOCK_DONATIONS} />

        {/* Bottom two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Recent payments table */}
          <div className="lg:col-span-2 rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--outline-variant)]">
              <p className="text-sm font-bold font-display text-navy">Pagos recientes</p>
              <Link href="/finanzas/pagos" className="text-[12px] font-medium text-teal-deep font-body">
                Ver todos →
              </Link>
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[var(--outline-variant)]">
                    {['Miembro', 'Concepto', 'Monto', 'Método', 'Estado', 'Fecha'].map(h => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[10px] uppercase tracking-widest font-display text-[rgba(22,20,64,0.60)]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.map((p, i) => (
                    <tr
                      key={p.id}
                      className={`border-b border-[var(--outline-variant)] hover:bg-gray-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-[rgba(22,20,64,0.01)]'}`}
                    >
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-medium font-body text-navy">
                          {p.member_name.split(' ')[0]}
                        </p>
                        <p className="text-[11px] text-[rgba(22,20,64,0.45)] font-body">
                          {p.member_cedula}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-body text-navy">{p.entity_name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-medium font-body text-navy">
                          <AmountDisplay amount={p.amount} revealed={revealAll} />
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <PaymentMethodBadge method={p.method} />
                      </td>
                      <td className="px-4 py-3">
                        <PaymentStatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[12px] whitespace-nowrap font-body text-[rgba(22,20,64,0.55)]">
                          {formatDate(p.created_at)}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: tarjetas */}
            <ul className="md:hidden">
              {recentPayments.map((p, i) => (
                <li
                  key={p.id}
                  className="px-4 py-3 flex items-center gap-3"
                  style={i < recentPayments.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium font-body text-navy truncate">
                      {p.member_name.split(' ')[0]} <span className="text-[rgba(22,20,64,0.45)] font-normal">{p.member_cedula}</span>
                    </p>
                    <p className="text-[12px] text-[rgba(22,20,64,0.55)] font-body truncate">{p.entity_name}</p>
                    <p className="text-[11px] text-[rgba(22,20,64,0.45)] font-body mt-0.5">{formatDate(p.created_at)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <p className="text-[13px] font-medium font-body text-navy">
                      <AmountDisplay amount={p.amount} revealed={revealAll} />
                    </p>
                    <PaymentStatusBadge status={p.status} />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick access + alerts */}
          <div className="space-y-4">
            {/* Quick access */}
            <div className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)]">
              <p className="text-[11px] uppercase tracking-widest mb-3 font-display text-[rgba(22,20,64,0.60)]">
                Accesos rápidos
              </p>
              <div className="space-y-2">
                <Link
                  href="/finanzas/donaciones/importar"
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all hover:opacity-80 bg-[rgba(22,20,64,0.05)] text-navy font-body"
                >
                  <Upload size={15} className="text-teal-deep" />
                  Importar donaciones
                </Link>
                <Link
                  href="/finanzas/becas/nueva"
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all hover:opacity-80 bg-[rgba(22,20,64,0.05)] text-navy font-body"
                >
                  <GraduationCap size={15} className="text-[#3DB97A]" />
                  Nueva beca
                </Link>
                <Link
                  href="/finanzas/reportes"
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all hover:opacity-80 bg-[rgba(22,20,64,0.05)] text-navy font-body"
                >
                  <BarChart2 size={15} className="text-[#E9B949]" />
                  Ver reportes
                </Link>
              </div>
            </div>

            {/* SINPE refunds pending */}
            {sinpePendingRefunds.length > 0 && (
              <Link href="/finanzas/devoluciones" className="block rounded-2xl p-4 transition-all hover:opacity-80 bg-[rgba(233,185,73,0.10)] border border-[rgba(233,185,73,0.25)]">
                <div className="flex items-start gap-2.5">
                  <RefreshCw size={15} className="text-[#E9B949] mt-[1px] shrink-0" />
                  <div>
                    <p className="text-[13px] font-semibold font-body text-[#9B7200]">
                      {sinpePendingRefunds.length} devoluci{sinpePendingRefunds.length === 1 ? 'ón' : 'ones'} SINPE pendiente{sinpePendingRefunds.length !== 1 ? 's' : ''}
                    </p>
                    <p className="text-[11px] mt-0.5 text-[rgba(155,114,0,0.70)] font-body">
                      Requieren procesamiento manual →
                    </p>
                  </div>
                </div>
              </Link>
            )}

            {/* Failed payments */}
            {failedRecent7.length > 0 && (
              <Link href="/finanzas/pagos" className="block rounded-2xl p-4 transition-all hover:opacity-80 bg-[rgba(239,85,84,0.08)] border border-[rgba(239,85,84,0.20)]">
                <div className="flex items-start gap-2.5">
                  <AlertCircle size={15} className="text-coral mt-[1px] shrink-0" />
                  <div>
                    <p className="text-[13px] font-semibold font-body text-[#C41A1A]">
                      {failedRecent7.length} pago{failedRecent7.length !== 1 ? 's' : ''} fallido{failedRecent7.length !== 1 ? 's' : ''} (7 días)
                    </p>
                    <p className="text-[11px] mt-0.5 text-[rgba(196,26,26,0.70)] font-body">
                      Revisar en módulo de pagos →
                    </p>
                  </div>
                </div>
              </Link>
            )}

            {/* Unused scholarships */}
            {unusedScholarships > 0 && (
              <Link href="/finanzas/becas" className="block rounded-2xl p-4 transition-all hover:opacity-80 bg-[rgba(61,185,122,0.08)] border border-[rgba(61,185,122,0.20)]">
                <div className="flex items-start gap-2.5">
                  <GraduationCap size={15} className="text-[#3DB97A] mt-[1px] shrink-0" />
                  <div>
                    <p className="text-[13px] font-semibold font-body text-[#1E6B42]">
                      {unusedScholarships} beca{unusedScholarships !== 1 ? 's' : ''} sin usar
                    </p>
                    <p className="text-[11px] mt-0.5 text-[rgba(30,107,66,0.70)] font-body">
                      Ver módulo de becas →
                    </p>
                  </div>
                </div>
              </Link>
            )}
          </div>
        </div>
      </div>
    </FinanceGuard>
  )
}
