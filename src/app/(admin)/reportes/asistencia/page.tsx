'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, Legend, Cell,
} from 'recharts'
import { ReportShell } from '@/components/reportes/ReportShell'
import { KpiCard } from '@/components/reportes/KpiCard'
import { ChartCard } from '@/components/reportes/ChartCard'
import { ALL_SEDES, type CharlaReport } from '@/lib/reports/charla-attendance'

const NAVY = '#161440'
const CORAL = '#EF5554'
const TEAL = '#519DA2'
const YEAR_COLORS = [TEAL, NAVY, CORAL] // últimos 3 años (más viejo → más nuevo)
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid var(--outline-variant)',
  fontSize: 12,
  fontFamily: 'var(--font-body)',
}

export default function ReporteAsistenciaPage() {
  const [report, setReport] = useState<CharlaReport | null>(null)
  const [year, setYear] = useState<number | null>(null)
  const [sede, setSede] = useState<string>(ALL_SEDES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback((y: number | null, s: string) => {
    setLoading(true); setError(null)
    const qs = new URLSearchParams()
    if (y) qs.set('year', String(y))
    if (s) qs.set('sede', s)
    fetch(`/api/reports/charla-attendance?${qs.toString()}`)
      .then(r => { if (!r.ok) throw new Error('Error cargando el reporte'); return r.json() })
      .then((d: CharlaReport) => {
        setReport(d)
        setYear(d.year)
        setSede(d.sede)
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(null, ALL_SEDES) }, [load])

  function onYear(y: number) { setYear(y); load(y, sede) }
  function onSede(s: string) { setSede(s); load(year, s) }

  // Carga inicial: skeleton.
  if (!report) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-64 rounded-lg bg-surface-card animate-pulse" />
        {error ? (
          <p className="text-sm text-coral font-body">{error}</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-5">
            <div className="hidden lg:block h-64 rounded-2xl bg-surface-card animate-pulse" />
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[0, 1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-surface-card animate-pulse" />)}
              </div>
              <div className="h-72 rounded-2xl bg-surface-card animate-pulse" />
              <div className="h-72 rounded-2xl bg-surface-card animate-pulse" />
            </div>
          </div>
        )}
      </div>
    )
  }

  const sedeLabel = report.sede === ALL_SEDES ? 'todas las sedes' : report.sede

  // Datos de gráficos
  const monthlyData = report.monthly.map(m => {
    const row: Record<string, number | string | null> = { month: MONTHS[m.month - 1] }
    for (const y of report.monthlyYears) row[String(y)] = m.values[y]
    return row
  })

  return (
    <div className={loading ? 'opacity-60 transition-opacity pointer-events-none' : 'transition-opacity'}>
      <ReportShell
        title="Control de Asistencia por Grupo"
        description="Check-ins a charlas por sede. Fuente: eventos de tipo charla; la sede se deriva del nombre canónico de la charla."
        years={report.years}
        year={report.year}
        onYear={onYear}
        sedes={report.sedes}
        sede={report.sede}
        onSede={onSede}
      >
        {/* Cards de promedio anual */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {report.annualCards.map(c => (
            <KpiCard
              key={c.year}
              label={`Promedio semanal ${c.year}`}
              value={c.weeklyAvg}
              sublabel={`${c.total.toLocaleString('es-CR')} check-ins`}
              changePct={c.changePct}
            />
          ))}
        </div>

        {/* Asistencia semanal */}
        <ChartCard
          title={`Asistencia semanal — ${report.year}`}
          subtitle={`Total de check-ins de charla por semana (${sedeLabel}). Línea punteada = promedio del año.`}
          empty={report.weekly.length === 0}
        >
          <ResponsiveContainer>
            <BarChart data={report.weekly} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} label={{ value: 'Semana', position: 'insideBottom', offset: -2, fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v), 'Check-ins']} labelFormatter={(l) => `Semana ${l}`} />
              <ReferenceLine y={report.weeklyAvg} stroke={CORAL} strokeDasharray="5 4" strokeWidth={1.5} />
              <Bar dataKey="total" fill={NAVY} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Comparación por sede */}
        <ChartCard
          title={`Comparación por sede — ${report.year}`}
          subtitle="Total de check-ins del año por sede. La sede seleccionada se resalta."
          empty={report.sedeRanking.length === 0}
          height={Math.max(220, report.sedeRanking.length * 32)}
        >
          <ResponsiveContainer>
            <BarChart layout="vertical" data={report.sedeRanking} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="sede" width={110} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v).toLocaleString('es-CR'), 'Check-ins']} cursor={{ fill: 'rgba(22,20,64,0.04)' }} />
              <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={26}>
                {report.sedeRanking.map(s => (
                  <Cell key={s.sede} fill={report.sede !== ALL_SEDES && s.sede === report.sede ? CORAL : NAVY} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Comparativo por año y mes */}
        <ChartCard
          title="Comparativo por año y mes"
          subtitle={`Promedio semanal por mes — últimos ${report.monthlyYears.length} año(s) (${sedeLabel}).`}
          empty={report.monthlyYears.length === 0}
        >
          <ResponsiveContainer>
            <BarChart data={monthlyData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'var(--font-body)' }} />
              {report.monthlyYears.map((y, i) => (
                <Bar key={y} dataKey={String(y)} name={String(y)} fill={YEAR_COLORS[i % YEAR_COLORS.length]} radius={[3, 3, 0, 0]} maxBarSize={22} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </ReportShell>
    </div>
  )
}
