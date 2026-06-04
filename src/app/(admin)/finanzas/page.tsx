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

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })
}

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
          className="rounded-2xl px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          style={{ background: '#161440', boxShadow: 'var(--shadow-md)' }}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.10)' }}>
              <DollarSign size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl text-white" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}>
                Finanzas
              </h1>
              <p className="text-[12px] text-white/50 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
                Gestión financiera de Theos Place
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Period selector */}
            <div className="flex gap-1">
              {PERIOD_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setPeriod(opt.value)}
                  className="rounded-full px-3 py-1.5 text-[12px] transition-all"
                  style={{
                    background: period === opt.value ? 'rgba(255,255,255,0.20)' : 'transparent',
                    color: period === opt.value ? 'white' : 'rgba(255,255,255,0.55)',
                    fontFamily: 'var(--font-body)',
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
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] transition-all"
              style={{
                background: revealAll ? 'rgba(81,157,162,0.25)' : 'rgba(255,255,255,0.10)',
                color: revealAll ? '#70BDC2' : 'rgba(255,255,255,0.60)',
                fontFamily: 'var(--font-body)',
                border: '1px solid transparent',
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
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} style={{ color: '#3DB97A' }} />
              <p className="text-[10px] uppercase tracking-widest" style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>Total ingresos</p>
            </div>
            <p className="text-2xl font-extrabold" style={{ fontFamily: 'var(--font-display)', color: '#161440' }}>
              <AmountDisplay amount={totalIngresos} defaultHidden={false} revealed={revealAll} />
            </p>
          </div>

          {/* Donadores activos */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Heart size={16} style={{ color: '#519DA2' }} />
              <p className="text-[10px] uppercase tracking-widest" style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>Donadores activos</p>
            </div>
            <p className="text-4xl font-extrabold" style={{ fontFamily: 'var(--font-display)', color: '#519DA2' }}>
              {activeDonors}
            </p>
          </div>

          {/* Pagos pendientes */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center gap-2 mb-3">
              <CreditCard size={16} style={{ color: pendingPayments > 0 ? '#EF5554' : '#161440' }} />
              <p className="text-[10px] uppercase tracking-widest" style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>Pagos pendientes</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-4xl font-extrabold" style={{ fontFamily: 'var(--font-display)', color: pendingPayments > 0 ? '#EF5554' : '#161440' }}>
                {pendingPayments}
              </p>
              {pendingPayments > 0 && (
                <span className="text-[10px] rounded-full px-2 py-0.5 font-medium" style={{ background: 'rgba(239,85,84,0.10)', color: '#EF5554' }}>
                  Revisar
                </span>
              )}
            </div>
          </div>

          {/* Devoluciones pendientes */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center gap-2 mb-3">
              <ArrowLeftRight size={16} style={{ color: pendingRefunds > 0 ? '#EF5554' : '#161440' }} />
              <p className="text-[10px] uppercase tracking-widests" style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>Devoluciones pend.</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-4xl font-extrabold" style={{ fontFamily: 'var(--font-display)', color: pendingRefunds > 0 ? '#EF5554' : '#161440' }}>
                {pendingRefunds}
              </p>
              {pendingRefunds > 0 && (
                <span className="text-[10px] rounded-full px-2 py-0.5 font-medium" style={{ background: 'rgba(239,85,84,0.10)', color: '#EF5554' }}>
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
          <div className="lg:col-span-2 rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--outline-variant)' }}>
              <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: '#161440' }}>Pagos recientes</p>
              <Link href="/finanzas/pagos" className="text-[12px] font-medium" style={{ color: '#519DA2', fontFamily: 'var(--font-body)' }}>
                Ver todos →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--outline-variant)' }}>
                    {['Miembro', 'Concepto', 'Monto', 'Método', 'Estado', 'Fecha'].map(h => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[10px] uppercase tracking-widest"
                        style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}
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
                      className="border-b hover:bg-gray-50 transition-colors"
                      style={{ borderColor: 'var(--outline-variant)', background: i % 2 === 0 ? 'white' : 'rgba(22,20,64,0.01)' }}
                    >
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-medium" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>
                          {p.member_name.split(' ')[0]}
                        </p>
                        <p className="text-[11px]" style={{ color: 'rgba(22,20,64,0.45)', fontFamily: 'var(--font-body)' }}>
                          {p.member_cedula}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[13px]" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>{p.entity_name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-medium" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>
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
                        <p className="text-[12px] whitespace-nowrap" style={{ fontFamily: 'var(--font-body)', color: 'rgba(22,20,64,0.55)' }}>
                          {formatDate(p.created_at)}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick access + alerts */}
          <div className="space-y-4">
            {/* Quick access */}
            <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
              <p className="text-[11px] uppercase tracking-widest mb-3" style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>
                Accesos rápidos
              </p>
              <div className="space-y-2">
                <Link
                  href="/finanzas/donaciones/importar"
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all hover:opacity-80"
                  style={{ background: 'rgba(22,20,64,0.05)', color: '#161440', fontFamily: 'var(--font-body)' }}
                >
                  <Upload size={15} style={{ color: '#519DA2' }} />
                  Importar donaciones
                </Link>
                <Link
                  href="/finanzas/becas/nueva"
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all hover:opacity-80"
                  style={{ background: 'rgba(22,20,64,0.05)', color: '#161440', fontFamily: 'var(--font-body)' }}
                >
                  <GraduationCap size={15} style={{ color: '#3DB97A' }} />
                  Nueva beca
                </Link>
                <Link
                  href="/finanzas/reportes"
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all hover:opacity-80"
                  style={{ background: 'rgba(22,20,64,0.05)', color: '#161440', fontFamily: 'var(--font-body)' }}
                >
                  <BarChart2 size={15} style={{ color: '#E9B949' }} />
                  Ver reportes
                </Link>
              </div>
            </div>

            {/* SINPE refunds pending */}
            {sinpePendingRefunds.length > 0 && (
              <Link href="/finanzas/devoluciones" className="block rounded-2xl p-4 transition-all hover:opacity-80" style={{ background: 'rgba(233,185,73,0.10)', border: '1px solid rgba(233,185,73,0.25)' }}>
                <div className="flex items-start gap-2.5">
                  <RefreshCw size={15} style={{ color: '#E9B949', marginTop: 1, flexShrink: 0 }} />
                  <div>
                    <p className="text-[13px] font-semibold" style={{ fontFamily: 'var(--font-body)', color: '#9B7200' }}>
                      {sinpePendingRefunds.length} devoluci{sinpePendingRefunds.length === 1 ? 'ón' : 'ones'} SINPE pendiente{sinpePendingRefunds.length !== 1 ? 's' : ''}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'rgba(155,114,0,0.70)', fontFamily: 'var(--font-body)' }}>
                      Requieren procesamiento manual →
                    </p>
                  </div>
                </div>
              </Link>
            )}

            {/* Failed payments */}
            {failedRecent7.length > 0 && (
              <Link href="/finanzas/pagos" className="block rounded-2xl p-4 transition-all hover:opacity-80" style={{ background: 'rgba(239,85,84,0.08)', border: '1px solid rgba(239,85,84,0.20)' }}>
                <div className="flex items-start gap-2.5">
                  <AlertCircle size={15} style={{ color: '#EF5554', marginTop: 1, flexShrink: 0 }} />
                  <div>
                    <p className="text-[13px] font-semibold" style={{ fontFamily: 'var(--font-body)', color: '#C41A1A' }}>
                      {failedRecent7.length} pago{failedRecent7.length !== 1 ? 's' : ''} fallido{failedRecent7.length !== 1 ? 's' : ''} (7 días)
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'rgba(196,26,26,0.70)', fontFamily: 'var(--font-body)' }}>
                      Revisar en módulo de pagos →
                    </p>
                  </div>
                </div>
              </Link>
            )}

            {/* Unused scholarships */}
            {unusedScholarships > 0 && (
              <Link href="/finanzas/becas" className="block rounded-2xl p-4 transition-all hover:opacity-80" style={{ background: 'rgba(61,185,122,0.08)', border: '1px solid rgba(61,185,122,0.20)' }}>
                <div className="flex items-start gap-2.5">
                  <GraduationCap size={15} style={{ color: '#3DB97A', marginTop: 1, flexShrink: 0 }} />
                  <div>
                    <p className="text-[13px] font-semibold" style={{ fontFamily: 'var(--font-body)', color: '#1E6B42' }}>
                      {unusedScholarships} beca{unusedScholarships !== 1 ? 's' : ''} sin usar
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'rgba(30,107,66,0.70)', fontFamily: 'var(--font-body)' }}>
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
