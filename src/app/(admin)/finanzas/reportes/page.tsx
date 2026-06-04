'use client'

import { useState, useMemo } from 'react'
import { BarChart2, Download, Package } from 'lucide-react'
import { FinanceGuard } from '@/components/finance/FinanceGuard'
import { AmountDisplay } from '@/components/finance/AmountDisplay'
import { useFinance } from '@/hooks/useFinance'
import { generateCSV, exportQuickBooksCSV } from '@/lib/export'

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre']

const ENTITIES = [
  { id: 'all', name: 'Todas las entidades' },
  { id: 'evt-camp-jun25', name: 'Campamento Junio 2025' },
  { id: 'evt-retiro-lid', name: 'Retiro de Liderazgo' },
  { id: 'evt-taller-fin', name: 'Taller de Finanzas' },
  { id: 'evt-adoracion',  name: 'Noche de Adoración' },
  { id: 'evt-camp-ver26', name: 'Campamento Verano 2026' },
  { id: 'grp-alpha',      name: 'Grupo Alpha' },
  { id: 'grp-omega',      name: 'Grupo Omega' },
  { id: 'grp-genesis',    name: 'Grupo Génesis' },
  { id: 'grp-esperanza',  name: 'Grupo Esperanza' },
]

export default function ReportesPage() {
  const { payments: MOCK_PAYMENTS, donations: MOCK_DONATIONS } = useFinance()
  const [activeTab, setActiveTab] = useState<'donations' | 'payments' | 'transparency'>('donations')
  const [donDateFrom, setDonDateFrom] = useState('')
  const [donDateTo, setDonDateTo] = useState('')
  const [entityFilter, setEntityFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString())

  // Donations tab
  const filteredDonations = useMemo(() => {
    return MOCK_DONATIONS.filter(d => {
      const dt = new Date(d.donation_date)
      const matchFrom = !donDateFrom || dt >= new Date(donDateFrom)
      const matchTo = !donDateTo || dt <= new Date(donDateTo)
      return matchFrom && matchTo
    })
  }, [donDateFrom, donDateTo])

  // Payments tab
  const filteredPayments = useMemo(() => {
    if (entityFilter === 'all') return MOCK_PAYMENTS
    return MOCK_PAYMENTS.filter(p => p.entity_id === entityFilter)
  }, [entityFilter])

  const paidPayments = filteredPayments.filter(p => p.status === 'paid')
  const pendingPayments = filteredPayments.filter(p => p.status === 'pending')
  const refundedPayments = filteredPayments.filter(p => p.status === 'refunded' || p.status === 'partial_refund')

  // Transparency tab — month-by-month
  const yearDonations = useMemo(() => {
    const year = Number(yearFilter)
    return MOCK_DONATIONS.filter(d => new Date(d.donation_date).getFullYear() === year)
  }, [yearFilter])

  const monthlyData = useMemo(() => {
    return MONTH_NAMES.map((name, i) => {
      const month = i + 1
      const year = Number(yearFilter)
      const total = yearDonations
        .filter(d => new Date(d.donation_date).getMonth() + 1 === month)
        .reduce((s, d) => s + d.amount, 0)
      const uniqueDonors = new Set(
        yearDonations
          .filter(d => d.is_identified && new Date(d.donation_date).getMonth() + 1 === month)
          .map(d => d.member_id)
      ).size
      return { name, total, uniqueDonors }
    })
  }, [yearDonations, yearFilter])

  const maxMonthTotal = Math.max(...monthlyData.map(m => m.total), 1)
  const topMonths = [...monthlyData].filter(m => m.total > 0).sort((a, b) => b.total - a.total).slice(0, 3)

  function exportDonationsCSV() {
    generateCSV(
      ['ID', 'Miembro', 'Cédula', 'Fecha', 'Monto', 'Lote', 'Estado'],
      filteredDonations.map(d => [d.id, d.member_name, d.member_cedula, d.donation_date, d.amount, d.source_file, d.is_identified ? 'Identificado' : 'Sin identificar'])
      , 'reporte-donaciones'
    )
  }

  function exportPaymentsCSV() {
    generateCSV(
      ['ID', 'Miembro', 'Cédula', 'Entidad', 'Tipo', 'Monto', 'Método', 'Estado', 'Fecha'],
      filteredPayments.map(p => [p.id, p.member_name, p.member_cedula, p.entity_name, p.entity_type === 'event' ? 'Evento' : 'Grupo', p.amount, p.method, p.status, p.created_at.split('T')[0]])
      , 'reporte-pagos'
    )
  }

  function exportTransparencyCSV() {
    generateCSV(
      ['Mes', 'Total Donaciones', 'Donadores únicos'],
      monthlyData.map(m => [m.name, m.total, m.uniqueDonors])
      , `informe-transparencia-${yearFilter}`
    )
  }

  function exportQuickBooksDonations() {
    exportQuickBooksCSV('donations', MOCK_DONATIONS.map(d => [d.donation_date, d.member_name, 'Donaciones', d.amount, 'Donación Theos Place']))
  }

  function exportQuickBooksPayments() {
    exportQuickBooksCSV('payments', MOCK_PAYMENTS.filter(p => p.status === 'paid').map(p => [p.paid_at?.split('T')[0] ?? '', p.member_name, 'Pagos', p.amount, p.entity_name, p.method]))
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
            <BarChart2 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl text-white" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Reportes financieros
            </h1>
            <p className="text-[12px] text-white/50 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
              Análisis y exportación de datos financieros
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-2xl" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
          {([
            ['donations', 'Donaciones'],
            ['payments', 'Pagos por entidad'],
            ['transparency', 'Informe de transparencia'],
          ] as const).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setActiveTab(v)}
              className="flex-1 rounded-xl py-2.5 px-4 text-sm font-medium transition-all"
              style={{
                background: activeTab === v ? '#161440' : 'transparent',
                color: activeTab === v ? 'white' : 'rgba(22,20,64,0.55)',
                fontFamily: 'var(--font-body)',
              }}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Tab 1 — Donations */}
        {activeTab === 'donations' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[12px]" style={{ color: 'rgba(22,20,64,0.55)', fontFamily: 'var(--font-body)' }}>Desde</span>
                <input type="date" value={donDateFrom} onChange={e => setDonDateFrom(e.target.value)}
                  className="rounded-xl border px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)', color: '#161440' }} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px]" style={{ color: 'rgba(22,20,64,0.55)', fontFamily: 'var(--font-body)' }}>Hasta</span>
                <input type="date" value={donDateTo} onChange={e => setDonDateTo(e.target.value)}
                  className="rounded-xl border px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)', color: '#161440' }} />
              </div>
              <button onClick={exportDonationsCSV}
                className="ml-auto inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium"
                style={{ background: '#161440', color: 'white', fontFamily: 'var(--font-body)' }}>
                <Download size={14} />
                Exportar a Excel
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--outline-variant)' }}>
                      {['Miembro', 'Cédula', 'Fecha', 'Monto', 'Estado'].map(h => (
                        <th key={h} className="px-5 py-3.5 text-left text-[10px] uppercase tracking-widests"
                          style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDonations.slice(0, 15).map((d, i) => (
                      <tr key={d.id} className="border-b hover:bg-gray-50 transition-colors"
                        style={{ borderColor: 'var(--outline-variant)', background: i % 2 === 0 ? 'white' : 'rgba(22,20,64,0.01)' }}>
                        <td className="px-5 py-3.5"><p className="text-[13px] font-medium" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>{d.member_name}</p></td>
                        <td className="px-5 py-3.5"><p className="text-[13px]" style={{ color: 'rgba(22,20,64,0.60)', fontFamily: 'var(--font-body)' }}>{d.member_cedula}</p></td>
                        <td className="px-5 py-3.5"><p className="text-[13px]" style={{ color: 'rgba(22,20,64,0.60)', fontFamily: 'var(--font-body)' }}>{new Date(d.donation_date).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}</p></td>
                        <td className="px-5 py-3.5"><AmountDisplay amount={d.amount} defaultHidden={false} /></td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium"
                            style={{ color: d.is_identified ? '#3DB97A' : '#EF5554', background: d.is_identified ? 'rgba(61,185,122,0.10)' : 'rgba(239,85,84,0.10)' }}>
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
                className="rounded-xl border px-4 py-2.5 text-sm outline-none"
                style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)', color: '#161440' }}>
                {ENTITIES.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <button onClick={exportPaymentsCSV}
                className="ml-auto inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium"
                style={{ background: '#161440', color: 'white', fontFamily: 'var(--font-body)' }}>
                <Download size={14} />
                Exportar a Excel
              </button>
            </div>

            {/* Stats for filtered */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total cobrado', value: paidPayments.reduce((s, p) => s + p.amount, 0), color: '#3DB97A' },
                { label: 'Pendiente', value: pendingPayments.reduce((s, p) => s + p.amount, 0), color: '#E9B949' },
                { label: 'Devuelto', value: refundedPayments.reduce((s, p) => s + p.amount, 0), color: '#519DA2' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-2xl p-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
                  <p className="text-[10px] uppercase tracking-widests mb-1.5" style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>{label}</p>
                  <p className="text-lg font-extrabold" style={{ fontFamily: 'var(--font-display)', color }}>
                    <AmountDisplay amount={value} defaultHidden={false} />
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--outline-variant)' }}>
                      {['Miembro', 'Entidad', 'Monto', 'Método', 'Estado', 'Fecha'].map(h => (
                        <th key={h} className="px-5 py-3.5 text-left text-[10px] uppercase tracking-widests"
                          style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.slice(0, 15).map((p, i) => (
                      <tr key={p.id} className="border-b hover:bg-gray-50 transition-colors"
                        style={{ borderColor: 'var(--outline-variant)', background: i % 2 === 0 ? 'white' : 'rgba(22,20,64,0.01)' }}>
                        <td className="px-5 py-3.5"><p className="text-[13px] font-medium" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>{p.member_name}</p></td>
                        <td className="px-5 py-3.5"><p className="text-[13px]" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>{p.entity_name}</p></td>
                        <td className="px-5 py-3.5"><AmountDisplay amount={p.amount} defaultHidden={false} /></td>
                        <td className="px-5 py-3.5"><p className="text-[12px]" style={{ color: 'rgba(22,20,64,0.60)', fontFamily: 'var(--font-body)' }}>{p.method}</p></td>
                        <td className="px-5 py-3.5"><p className="text-[12px]" style={{ color: 'rgba(22,20,64,0.60)', fontFamily: 'var(--font-body)' }}>{p.status}</p></td>
                        <td className="px-5 py-3.5"><p className="text-[12px]" style={{ color: 'rgba(22,20,64,0.55)', fontFamily: 'var(--font-body)' }}>{p.created_at.split('T')[0]}</p></td>
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
                <span className="text-[12px]" style={{ color: 'rgba(22,20,64,0.55)', fontFamily: 'var(--font-body)' }}>Año</span>
                <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
                  className="rounded-xl border px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)', color: '#161440' }}>
                  {['2024', '2025', '2026'].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <button onClick={exportTransparencyCSV}
                className="ml-auto inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium"
                style={{ background: '#161440', color: 'white', fontFamily: 'var(--font-body)' }}>
                <Download size={14} />
                Exportar informe completo
              </button>
            </div>

            {/* Top months */}
            {topMonths.length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
                <p className="text-[11px] uppercase tracking-widests mb-4" style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>
                  Top meses {yearFilter}
                </p>
                <div className="flex gap-4">
                  {topMonths.map((m, i) => (
                    <div key={m.name} className="flex-1 rounded-xl p-3.5" style={{ background: i === 0 ? 'rgba(22,20,64,0.06)' : 'rgba(22,20,64,0.03)' }}>
                      <p className="text-[12px] font-medium" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>{m.name}</p>
                      <p className="text-[11px] mt-1" style={{ color: 'rgba(22,20,64,0.55)', fontFamily: 'var(--font-body)' }}>
                        ₡{m.total.toLocaleString('es-CR')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Monthly chart table */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--outline-variant)' }}>
                      {['Mes', 'Total donaciones', 'Donadores únicos', ''].map(h => (
                        <th key={h} className="px-5 py-3.5 text-left text-[10px] uppercase tracking-widests"
                          style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map((m, i) => (
                      <tr key={m.name} className="border-b hover:bg-gray-50 transition-colors"
                        style={{ borderColor: 'var(--outline-variant)', background: i % 2 === 0 ? 'white' : 'rgba(22,20,64,0.01)' }}>
                        <td className="px-5 py-3.5">
                          <p className="text-[13px] font-medium" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>{m.name}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-[13px]" style={{ fontFamily: 'var(--font-body)', color: m.total > 0 ? '#161440' : 'rgba(22,20,64,0.30)' }}>
                            {m.total > 0 ? `₡${m.total.toLocaleString('es-CR')}` : '—'}
                          </p>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-[13px]" style={{ fontFamily: 'var(--font-body)', color: 'rgba(22,20,64,0.60)' }}>
                            {m.uniqueDonors > 0 ? m.uniqueDonors : '—'}
                          </p>
                        </td>
                        <td className="px-5 py-3.5" style={{ width: '30%' }}>
                          {m.total > 0 && (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 rounded-full" style={{ background: 'rgba(22,20,64,0.06)' }}>
                                <div
                                  className="h-2 rounded-full transition-all"
                                  style={{ width: `${(m.total / maxMonthTotal) * 100}%`, background: '#519DA2' }}
                                />
                              </div>
                              <span className="text-[10px] w-6 text-right" style={{ color: 'rgba(22,20,64,0.40)', fontFamily: 'var(--font-body)' }}>
                                {Math.round((m.total / maxMonthTotal) * 100)}%
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
        <div className="rounded-2xl p-6" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(22,20,64,0.06)' }}>
              <Package size={18} style={{ color: '#161440' }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: '#161440' }}>Exportar para QuickBooks</p>
              <p className="text-[12px]" style={{ color: 'rgba(22,20,64,0.50)', fontFamily: 'var(--font-body)' }}>
                Formatos compatibles para importar en QuickBooks
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={exportQuickBooksDonations}
              className="flex items-center gap-3 rounded-xl p-4 transition-all hover:opacity-80 border"
              style={{ border: '1px solid var(--outline-variant)', background: 'var(--surface-low)' }}
            >
              <Download size={16} style={{ color: '#519DA2', flexShrink: 0 }} />
              <div className="text-left">
                <p className="text-sm font-medium" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>Exportar donaciones</p>
                <p className="text-[11px]" style={{ color: 'rgba(22,20,64,0.50)', fontFamily: 'var(--font-body)' }}>Formato CSV compatible QuickBooks</p>
              </div>
            </button>
            <button
              onClick={exportQuickBooksPayments}
              className="flex items-center gap-3 rounded-xl p-4 transition-all hover:opacity-80 border"
              style={{ border: '1px solid var(--outline-variant)', background: 'var(--surface-low)' }}
            >
              <Download size={16} style={{ color: '#3DB97A', flexShrink: 0 }} />
              <div className="text-left">
                <p className="text-sm font-medium" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>Exportar pagos</p>
                <p className="text-[11px]" style={{ color: 'rgba(22,20,64,0.50)', fontFamily: 'var(--font-body)' }}>Formato CSV compatible QuickBooks</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </FinanceGuard>
  )
}
