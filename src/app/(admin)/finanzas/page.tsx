'use client'

import { useState, useMemo, useEffect } from 'react'
import { usoDeLaBeca } from '@/lib/finance/uso-de-beca'
import Link from 'next/link'
import {
  DollarSign, Heart, CreditCard, ArrowLeftRight, Eye, EyeOff,
  AlertCircle, Upload, GraduationCap, BarChart2, RefreshCw, TrendingUp,
} from 'lucide-react'
import { FinanceGuard } from '@/components/finance/FinanceGuard'
import { TotalsDisplay } from '@/components/finance/AmountDisplay'
import { sumByCurrency, addTotals } from '@/lib/money'
import { requiereAtencion } from '@/lib/finance/payment-outcome'
import { FinanceChart } from '@/components/finance/FinanceChart'
import { useFinance } from '@/hooks/useFinance'
import { anioDe, caeEn } from '@/lib/fecha/partes-de-fecha'
import { criterioDeDonantes } from '@/lib/finance/ventana-de-donante'

export default function FinanzasPage() {
  const { payments, donations, refunds, scholarships } = useFinance('payments', 'donations', 'refunds', 'scholarships')
  const [period, setPeriod] = useState<'month' | 'prev_month' | 'year'>('month')
  const [revealAll, setRevealAll] = useState(false)

  // "Ahora" se fija al montar. Llamar new Date() en el cuerpo del render es
  // impuro: el compilador de React no puede memoizar nada que dependa de eso
  // (react-hooks/purity + preserve-manual-memoization).
  const [now] = useState(() => new Date())
  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
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
  }, [payments, period, thisMonth, thisYear])

  const filteredDonations = useMemo(() => {
    // QA-1/C1: `donation_date` es columna `date`, no timestamp. Con
    // `new Date(...).getMonth()` toda donación caía un mes antes —las 15.147,
    // porque todas están registradas el día 1 del trimestre— así que el panel
    // del mes en curso salía vacío hasta bien entrado el mes siguiente.
    // Los pagos de arriba sí usan `new Date`: `paid_at` es timestamp con hora.
    const anio = period === 'prev_month' && thisMonth === 0 ? thisYear - 1 : thisYear
    const mes = (period === 'prev_month' ? (thisMonth === 0 ? 11 : thisMonth - 1) : thisMonth) + 1
    return donations.filter(d =>
      period === 'year' ? anioDe(d.donation_date) === thisYear : caeEn(d.donation_date, anio, mes))
  }, [donations, period, thisMonth, thisYear])

  // INT-3: pagos y donaciones se juntan SIN mezclar monedas.
  const totalIngresos = addTotals(sumByCurrency(filteredPayments), sumByCurrency(filteredDonations))

  // "Donantes activos" = members.is_donor vía el RPC donation_stats — la MISMA
  // fuente que la página de donaciones (FIN-1). Antes se recalculaba acá
  // client-side sobre `donations`, que viaja con ?all=1 y PostgREST corta en
  // ~1000 filas (de 14k+): el número salía distinto al de /finanzas/donaciones.
  // No depende del selector de período (es estado actual, no del mes elegido).
  const [activeDonors, setActiveDonors] = useState<number | null>(null)
  useEffect(() => {
    let alive = true
    fetch('/api/finance/donations?stats=1')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d) setActiveDonors(Number(d.active_donors ?? 0)) })
      .catch(() => {})
    return () => { alive = false }
  }, [])
  const pendingPayments = payments.filter(p => p.status === 'pending').length
  const pendingRefunds = refunds.filter(r => r.status === 'pending' || r.status === 'processing').length
  const sinpePendingRefunds = refunds.filter(r => r.sinpe_pending && (r.status === 'pending' || r.status === 'processing'))
  // Solo los fallos DE VERDAD: desde 2026-09-02 una cancelación tiene su
  // propio estado ('cancelado') y no debe encender la alerta roja — no hay
  // nada que atender. Antes los 6 "fallidos" del sistema eran cancelaciones.
  const failedRecent7 = payments.filter(p => {
    if (!requiereAtencion(p.status)) return false
    const d = new Date(p.created_at)
    return (now.getTime() - d.getTime()) < 7 * 24 * 60 * 60 * 1000
  })
  // Solo BECAS ASIGNADAS sin aplicar (Floriana, 2026-10-14: «decía 9 y solo
  // hay dos»). El 9 contaba todo lo que tiene status 'active' en la tabla
  // scholarships, y ahí viven también los créditos por congelar (FIN-9) y los
  // cupones genéricos: no son becas sin usar. Misma regla que la pestaña
  // «Becas asignadas» → «Sin aplicar» (usoDeLaBeca).
  const unusedScholarships = scholarships.filter(s => s.kind === 'asignada' && usoDeLaBeca(s) === 'sin_usar').length

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
              <p className="text-[13px] text-white/80 mt-0.5 font-body">
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
                  className="rounded-full px-3 py-1.5 text-[13px] transition-all font-body"
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
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] transition-all font-body border border-transparent"
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
              <TrendingUp size={16} className="text-success-deep" />
              <p className="text-[11px] uppercase tracking-widest font-display text-navy-light/80">Total ingresos</p>
            </div>
            <p className="text-2xl font-extrabold font-display text-navy">
              <TotalsDisplay totals={totalIngresos} defaultHidden={false} revealed={revealAll} />
            </p>
          </div>

          {/* Donantes activos */}
          <div className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)]">
            <div className="flex items-center gap-2 mb-3">
              <Heart size={16} className="text-teal-deep" />
              <p className="text-[11px] uppercase tracking-widest font-display text-navy-light/80">Donantes activos</p>
            </div>
            <p className="text-4xl font-extrabold font-display text-teal-deep">
              {activeDonors ?? '—'}
            </p>
            <p className="mt-1.5 text-[13px] text-navy-light/80 font-body">{criterioDeDonantes()}</p>
          </div>

          {/* Pagos pendientes */}
          <div className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)]">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard size={16} className={`${pendingPayments > 0 ? 'text-coral-deep' : 'text-navy'}`} />
              <p className="text-[11px] uppercase tracking-widest font-display text-navy-light/80">Pagos pendientes</p>
            </div>
            <div className="flex items-center gap-2">
              <p className={`text-4xl font-extrabold font-display ${pendingPayments > 0 ? 'text-coral-deep' : 'text-navy'}`}>
                {pendingPayments}
              </p>
              {pendingPayments > 0 && (
                <span className="text-[11px] rounded-full px-2 py-0.5 font-medium bg-[rgba(214,62,61,0.10)] text-coral-deep">
                  Revisar
                </span>
              )}
            </div>
          </div>

          {/* Devoluciones pendientes */}
          <div className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)]">
            <div className="flex items-center gap-2 mb-3">
              <ArrowLeftRight size={16} className={`${pendingRefunds > 0 ? 'text-coral-deep' : 'text-navy'}`} />
              <p className="text-[11px] uppercase tracking-widest font-display text-navy-light/80">Devoluciones pend.</p>
            </div>
            <div className="flex items-center gap-2">
              <p className={`text-4xl font-extrabold font-display ${pendingRefunds > 0 ? 'text-coral-deep' : 'text-navy'}`}>
                {pendingRefunds}
              </p>
              {pendingRefunds > 0 && (
                <span className="text-[11px] rounded-full px-2 py-0.5 font-medium bg-[rgba(214,62,61,0.10)] text-coral-deep">
                  Revisar
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Chart */}
        <FinanceChart payments={payments} donations={donations} />

        {/* Accesos rápidos: en una fila, a todo lo ancho. Antes vivían en una
            columna angosta al lado de «Pagos recientes» y, al quitar esa tabla
            (Floriana, 2026-10-14: la lista completa está en Pagos), quedaban
            sueltos a un costado. */}
        <div>
          <p className="text-[13px] uppercase tracking-widest mb-3 font-display text-navy-light/80">
            Accesos rápidos
          </p>
          {/* Una sola grilla de 4 (Floriana, 2026-10-14): los avisos van como
              una tarjeta más al lado de los accesos, no en una fila suelta abajo. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Link
              href="/finanzas/donaciones/importar"
              className="flex items-center gap-3 rounded-2xl px-5 py-4 text-sm font-medium transition-all hover:opacity-80 bg-surface-card shadow-[var(--shadow-md)] text-navy font-body"
            >
              <Upload size={16} className="text-teal-deep" />
              Importar donaciones
            </Link>
            <Link
              href="/finanzas/becas/nueva"
              className="flex items-center gap-3 rounded-2xl px-5 py-4 text-sm font-medium transition-all hover:opacity-80 bg-surface-card shadow-[var(--shadow-md)] text-navy font-body"
            >
              <GraduationCap size={16} className="text-success-deep" />
              Nueva beca
            </Link>
            <Link
              href="/finanzas/reportes"
              className="flex items-center gap-3 rounded-2xl px-5 py-4 text-sm font-medium transition-all hover:opacity-80 bg-surface-card shadow-[var(--shadow-md)] text-navy font-body"
            >
              <BarChart2 size={16} className="text-[#E9B949]" />
              Ver reportes
            </Link>
            {/* Avisos: solo los que tienen algo, en la misma grilla. */}
            {sinpePendingRefunds.length > 0 && (
              <Link href="/finanzas/devoluciones" className="flex items-center rounded-2xl px-5 py-4 transition-all hover:opacity-80 bg-[rgba(233,185,73,0.10)] border border-[rgba(233,185,73,0.25)]">
                <div className="flex items-start gap-2.5">
                  <RefreshCw size={15} className="text-[#E9B949] mt-[1px] shrink-0" />
                  <div>
                    <p className="text-[13px] font-semibold font-body text-[#9B7200]">
                      {sinpePendingRefunds.length} devoluci{sinpePendingRefunds.length === 1 ? 'ón' : 'ones'} SINPE pendiente{sinpePendingRefunds.length !== 1 ? 's' : ''}
                    </p>
                    <p className="text-[13px] mt-0.5 text-[#9B7200] font-body">Requieren procesamiento manual →</p>
                  </div>
                </div>
              </Link>
            )}
            {failedRecent7.length > 0 && (
              <Link href="/finanzas/pagos?estado=failed" className="flex items-center rounded-2xl px-5 py-4 transition-all hover:opacity-80 bg-[rgba(214,62,61,0.08)] border border-[rgba(214,62,61,0.20)]">
                <div className="flex items-start gap-2.5">
                  <AlertCircle size={15} className="text-coral-deep mt-[1px] shrink-0" />
                  <div>
                    <p className="text-[13px] font-semibold font-body text-[#C41A1A]">
                      {failedRecent7.length} pago{failedRecent7.length !== 1 ? 's' : ''} fallido{failedRecent7.length !== 1 ? 's' : ''} (7 días)
                    </p>
                    <p className="text-[13px] mt-0.5 text-[#C41A1A] font-body">Revisar en módulo de pagos →</p>
                  </div>
                </div>
              </Link>
            )}
            {unusedScholarships > 0 && (
              <Link href="/finanzas/becas" className="flex items-center rounded-2xl px-5 py-4 transition-all hover:opacity-80 bg-[rgba(61,185,122,0.08)] border border-[rgba(61,185,122,0.20)]">
                <div className="flex items-start gap-2.5">
                  <GraduationCap size={15} className="text-success-deep mt-[1px] shrink-0" />
                  <div>
                    <p className="text-[13px] font-semibold font-body text-[#1E6B42]">
                      {unusedScholarships} beca{unusedScholarships !== 1 ? 's' : ''} sin usar
                    </p>
                    <p className="text-[13px] mt-0.5 text-[#1E6B42] font-body">Ver módulo de becas →</p>
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
