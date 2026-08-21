'use client'

import { useState, useMemo } from 'react'
import { BarChart2, Download, Package } from 'lucide-react'
import { FinanceGuard } from '@/components/finance/FinanceGuard'
import { sumByCurrency, toCurrency, addTotals, mainCurrency, totalIn, formatTotalsInline, type MoneyTotals } from '@/lib/money'
import { AmountDisplay, TotalsDisplay } from '@/components/finance/AmountDisplay'
import { Tabs } from '@/components/shared/Tabs'
import { useFinance } from '@/hooks/useFinance'
import { generateCSV, exportQuickBooksCSV } from '@/lib/export'

// Etiquetas en español para la tabla (los values crudos venían de la BD).
const METHOD_LABEL: Record<string, string> = {
  card: 'Tarjeta', sinpe: 'SINPE', cash: 'Efectivo', scholarship: 'Beca', comprobante: 'Comprobante',
}
const STATUS_LABEL: Record<string, string> = {
  paid: 'Pagado', pending: 'Pendiente', failed: 'Fallido', refunded: 'Devuelto', partial_refund: 'Devolución parcial',
}

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre']

// Las entidades del filtro se derivan de los pagos reales (antes era una
// lista mock cuyos ids no matcheaban nada: filtrar vaciaba la tabla).

export default function ReportesPage() {
  const { payments, donations } = useFinance('payments', 'donations')
  const [activeTab, setActiveTab] = useState<'donations' | 'payments' | 'transparency'>('donations')
  const [donDateFrom, setDonDateFrom] = useState('')
  const [donDateTo, setDonDateTo] = useState('')
  const [entityFilter, setEntityFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString())

  // Donations tab
  const filteredDonations = useMemo(() => {
    return donations.filter(d => {
      const dt = new Date(d.donation_date)
      const matchFrom = !donDateFrom || dt >= new Date(donDateFrom)
      const matchTo = !donDateTo || dt <= new Date(donDateTo)
      return matchFrom && matchTo
    })
  }, [donations, donDateFrom, donDateTo])

  // Payments tab
  const entities = useMemo(() => {
    const byId = new Map<string, string>()
    for (const p of payments) {
      if (p.entity_id && !byId.has(p.entity_id)) byId.set(p.entity_id, p.entity_name || p.entity_id)
    }
    return [{ id: 'all', name: 'Todas las entidades' },
      ...[...byId].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'es'))]
  }, [payments])

  const filteredPayments = useMemo(() => {
    if (entityFilter === 'all') return payments
    return payments.filter(p => p.entity_id === entityFilter)
  }, [entityFilter, payments])

  const paidPayments = filteredPayments.filter(p => p.status === 'paid')
  const pendingPayments = filteredPayments.filter(p => p.status === 'pending')
  const refundedPayments = filteredPayments.filter(p => p.status === 'refunded' || p.status === 'partial_refund')

  // Transparency tab — month-by-month
  const yearDonations = useMemo(() => {
    const year = Number(yearFilter)
    return donations.filter(d => new Date(d.donation_date).getFullYear() === year)
  }, [donations, yearFilter])

  const monthlyData = useMemo(() => {
    return MONTH_NAMES.map((name, i) => {
      const month = i + 1
      // INT-3: por moneda. Antes sumaba euros con colones en el mismo número.
      const total = sumByCurrency(
        yearDonations.filter(d => new Date(d.donation_date).getMonth() + 1 === month))
      const uniqueDonors = new Set(
        yearDonations
          .filter(d => d.is_identified && new Date(d.donation_date).getMonth() + 1 === month)
          .map(d => d.member_id)
      ).size
      return { name, total, uniqueDonors }
    })
  }, [yearDonations])

  // Las barras del informe se dibujan en UNA moneda (la principal de los datos);
  // el texto muestra todas. Ver la nota de FinanceChart: una barra no puede
  // representar dos monedas a la vez.
  const monedaInforme = mainCurrency(addTotals(...monthlyData.map(m => m.total)))
  const barra = (m: { total: MoneyTotals }) => totalIn(m.total, monedaInforme)
  const maxMonthTotal = Math.max(...monthlyData.map(barra), 1)
  const topMonths = [...monthlyData].filter(m => barra(m) > 0).sort((a, b) => barra(b) - barra(a)).slice(0, 3)

  function exportDonationsCSV() {
    generateCSV(
      // INT-3: el monto NUNCA sale sin su moneda.
      ['ID', 'Miembro', 'Cédula', 'Fecha', 'Monto', 'Moneda', 'Lote', 'Estado'],
      filteredDonations.map(d => [d.id, d.member_name, d.member_cedula, d.donation_date, d.amount, toCurrency(d.currency), d.source_file, d.is_identified ? 'Identificado' : 'Sin identificar'])
      , 'reporte-donaciones'
    )
  }

  function exportPaymentsCSV() {
    generateCSV(
      ['ID', 'Miembro', 'Cédula', 'Entidad', 'Tipo', 'Monto', 'Moneda', 'Método', 'Estado', 'Fecha'],
      filteredPayments.map(p => [p.id, p.member_name, p.member_cedula, p.entity_name, p.entity_type === 'event' ? 'Evento' : 'Grupo', p.amount, toCurrency(p.currency), p.method, p.status, p.created_at.split('T')[0]])
      , 'reporte-pagos'
    )
  }

  function exportTransparencyCSV() {
    generateCSV(
      ['Mes', 'Total Donaciones', 'Donadores únicos'],
      monthlyData.map(m => [m.name, formatTotalsInline(m.total), m.uniqueDonors])
      , `informe-transparencia-${yearFilter}`
    )
  }

  function exportQuickBooksDonations() {
    exportQuickBooksCSV('donations', donations.map(d => [d.donation_date, d.member_name, 'Donaciones', d.amount, toCurrency(d.currency), 'Donación Theos Place']))
  }

  function exportQuickBooksPayments() {
    exportQuickBooksCSV('payments', payments.filter(p => p.status === 'paid').map(p => [p.paid_at?.split('T')[0] ?? '', p.member_name, 'Pagos', p.amount, toCurrency(p.currency), p.entity_name, p.method]))
  }

  return (
    <FinanceGuard>
      <div className="space-y-6">

        {/* Header */}
        <div
          className="rounded-2xl px-6 py-5 flex items-center gap-3 bg-navy shadow-[var(--shadow-md)]"
        >
          <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-[rgba(255,255,255,0.10)]">
            <BarChart2 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl text-white font-display font-extrabold tracking-[-0.02em]">
              Reportes financieros
            </h1>
            <p className="text-[13px] text-white/80 mt-0.5 font-body">
              Análisis y exportación de datos financieros
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs
          tabs={[
            { key: 'donations', label: 'Donaciones' },
            { key: 'payments', label: 'Pagos por entidad' },
            { key: 'transparency', label: 'Informe de transparencia' },
          ]}
          active={activeTab}
          onChange={v => setActiveTab(v as typeof activeTab)}
        />

        {/* Tab 1 — Donations */}
        {activeTab === 'donations' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-[rgba(22,20,64,0.55)] font-body">Desde</span>
                <input type="date" value={donDateFrom} onChange={e => setDonDateFrom(e.target.value)}
                  className="rounded-xl border px-3 py-2 text-sm outline-none border-[var(--outline-variant)] font-body text-navy" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-[rgba(22,20,64,0.55)] font-body">Hasta</span>
                <input type="date" value={donDateTo} onChange={e => setDonDateTo(e.target.value)}
                  className="rounded-xl border px-3 py-2 text-sm outline-none border-[var(--outline-variant)] font-body text-navy" />
              </div>
              <button onClick={exportDonationsCSV}
                className="ml-auto inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium bg-navy text-white font-body">
                <Download size={14} />
                Exportar CSV
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--outline-variant)]">
                      {['Miembro', 'Cédula', 'Fecha', 'Monto', 'Estado'].map(h => (
                        <th key={h} className="px-5 py-3.5 text-left text-[11px] uppercase tracking-widest font-display text-[rgba(22,20,64,0.60)]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDonations.slice(0, 15).map((d, i) => (
                      <tr key={d.id} className={`border-b border-[var(--outline-variant)] hover:bg-gray-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-[rgba(22,20,64,0.01)]'}`}>
                        <td className="px-5 py-3.5"><p className="text-[13px] font-medium font-body text-navy">{d.member_name}</p></td>
                        <td className="px-5 py-3.5"><p className="text-[13px] text-[rgba(22,20,64,0.60)] font-body">{d.member_cedula}</p></td>
                        <td className="px-5 py-3.5"><p className="text-[13px] text-[rgba(22,20,64,0.60)] font-body">{new Date(d.donation_date).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}</p></td>
                        <td className="px-5 py-3.5"><AmountDisplay amount={d.amount} currency={d.currency} defaultHidden={false} /></td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[13px] font-medium ${d.is_identified ? 'text-success bg-success/10' : 'text-coral bg-coral/10'}`}>
                            {d.is_identified ? 'Identificado' : 'Sin identificar'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2 — Payments by entity */}
        {activeTab === 'payments' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <select value={entityFilter} onChange={e => setEntityFilter(e.target.value)}
                className="rounded-xl border px-4 py-2.5 text-sm outline-none border-[var(--outline-variant)] font-body text-navy">
                {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <button onClick={exportPaymentsCSV}
                className="ml-auto inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium bg-navy text-white font-body">
                <Download size={14} />
                Exportar CSV
              </button>
            </div>

            {/* Stats for filtered */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                // INT-3: totales por moneda, nunca sumados entre sí.
                { label: 'Total cobrado', value: sumByCurrency(paidPayments), color: '#3DB97A' },
                { label: 'Pendiente', value: sumByCurrency(pendingPayments), color: '#E9B949' },
                { label: 'Devuelto', value: sumByCurrency(refundedPayments), color: '#519DA2' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-2xl p-4 bg-surface-card shadow-[var(--shadow-md)]">
                  <p className="text-[11px] uppercase tracking-widest mb-1.5 font-display text-[rgba(22,20,64,0.60)]">{label}</p>
                  <p className="text-lg font-extrabold font-display" style={{ color }}>
                    <TotalsDisplay totals={value} defaultHidden={false} />
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--outline-variant)]">
                      {['Miembro', 'Entidad', 'Monto', 'Método', 'Estado', 'Fecha'].map(h => (
                        <th key={h} className="px-5 py-3.5 text-left text-[11px] uppercase tracking-widest font-display text-[rgba(22,20,64,0.60)]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.slice(0, 15).map((p, i) => (
                      <tr key={p.id} className={`border-b border-[var(--outline-variant)] hover:bg-gray-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-[rgba(22,20,64,0.01)]'}`}>
                        <td className="px-5 py-3.5"><p className="text-[13px] font-medium font-body text-navy">{p.member_name}</p></td>
                        <td className="px-5 py-3.5"><p className="text-[13px] font-body text-navy">{p.entity_name}</p></td>
                        <td className="px-5 py-3.5"><AmountDisplay amount={p.amount} currency={p.currency} defaultHidden={false} /></td>
                        <td className="px-5 py-3.5"><p className="text-[13px] text-[rgba(22,20,64,0.60)] font-body">{METHOD_LABEL[p.method] ?? p.method}</p></td>
                        <td className="px-5 py-3.5"><p className="text-[13px] text-[rgba(22,20,64,0.60)] font-body">{STATUS_LABEL[p.status] ?? p.status}</p></td>
                        <td className="px-5 py-3.5"><p className="text-[13px] text-[rgba(22,20,64,0.55)] font-body">{p.created_at.split('T')[0]}</p></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3 — Transparency */}
        {activeTab === 'transparency' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-[rgba(22,20,64,0.55)] font-body">Año</span>
                <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
                  className="rounded-xl border px-3 py-2 text-sm outline-none border-[var(--outline-variant)] font-body text-navy">
                  {Array.from({ length: new Date().getFullYear() - 2024 + 1 }, (_, i) => String(2024 + i)).map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <button onClick={exportTransparencyCSV}
                className="ml-auto inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium bg-navy text-white font-body">
                <Download size={14} />
                Exportar informe completo
              </button>
            </div>

            {/* Top months */}
            {topMonths.length > 0 && (
              <div className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)]">
                <p className="text-[13px] uppercase tracking-widest mb-4 font-display text-[rgba(22,20,64,0.60)]">
                  Top meses {yearFilter}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {topMonths.map((m, i) => (
                    <div key={m.name} className={`rounded-xl p-3.5 ${i === 0 ? 'bg-navy/6' : 'bg-[rgba(22,20,64,0.03)]'}`}>
                      <p className="text-[13px] font-medium font-body text-navy">{m.name}</p>
                      <p className="text-[13px] mt-1 text-[rgba(22,20,64,0.55)] font-body">
                        {formatTotalsInline(m.total)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Monthly chart table */}
            <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--outline-variant)]">
                      {['Mes', 'Total donaciones', 'Donadores únicos', ''].map(h => (
                        <th key={h} className="px-5 py-3.5 text-left text-[11px] uppercase tracking-widest font-display text-[rgba(22,20,64,0.60)]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map((m, i) => (
                      <tr key={m.name} className={`border-b border-[var(--outline-variant)] hover:bg-gray-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-[rgba(22,20,64,0.01)]'}`}>
                        <td className="px-5 py-3.5">
                          <p className="text-[13px] font-medium font-body text-navy">{m.name}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className={`text-[13px] font-body ${barra(m) > 0 ? 'text-navy' : 'text-navy/80'}`}>
                            {barra(m) > 0 ? formatTotalsInline(m.total) : '—'}
                          </p>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-[13px] font-body text-[rgba(22,20,64,0.60)]">
                            {m.uniqueDonors > 0 ? m.uniqueDonors : '—'}
                          </p>
                        </td>
                        <td className="px-5 py-3.5 w-[30%]">
                          {barra(m) > 0 && (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 rounded-full bg-[rgba(22,20,64,0.06)]">
                                <div
                                  className="h-2 rounded-full transition-all bg-teal-deep"
                                  style={{ width: `${(barra(m) / maxMonthTotal) * 100}%` }}
                                />
                              </div>
                              <span className="text-[11px] w-6 text-right text-[rgba(22,20,64,0.60)] font-body">
                                {Math.round((barra(m) / maxMonthTotal) * 100)}%
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* QuickBooks section */}
        <div className="rounded-2xl p-6 bg-surface-card shadow-[var(--shadow-md)]">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-[rgba(22,20,64,0.06)]">
              <Package size={18} className="text-navy" />
            </div>
            <div>
              <p className="text-sm font-bold font-display text-navy">Exportar para QuickBooks</p>
              <p className="text-[13px] text-[rgba(22,20,64,0.60)] font-body">
                Formatos compatibles para importar en QuickBooks
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={exportQuickBooksDonations}
              className="flex items-center gap-3 rounded-xl p-4 transition-all hover:opacity-80 border border-[var(--outline-variant)] bg-surface-low"
            >
              <Download size={16} className="text-teal-deep shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium font-body text-navy">Exportar donaciones</p>
                <p className="text-[13px] text-[rgba(22,20,64,0.60)] font-body">Formato CSV compatible QuickBooks</p>
              </div>
            </button>
            <button
              onClick={exportQuickBooksPayments}
              className="flex items-center gap-3 rounded-xl p-4 transition-all hover:opacity-80 border border-[var(--outline-variant)] bg-surface-low"
            >
              <Download size={16} className="text-[#3DB97A] shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium font-body text-navy">Exportar pagos</p>
                <p className="text-[13px] text-[rgba(22,20,64,0.60)] font-body">Formato CSV compatible QuickBooks</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </FinanceGuard>
  )
}
