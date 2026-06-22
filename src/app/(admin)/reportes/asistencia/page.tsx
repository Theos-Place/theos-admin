'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, Legend, Cell,
} from 'recharts'
import { ReportShell } from '@/components/reportes/ReportShell'
import { KpiCard } from '@/components/reportes/KpiCard'
import { ChartCard } from '@/components/reportes/ChartCard'
import { Tabs } from '@/components/shared/Tabs'
import { ALL_SEDES, type CharlaReport } from '@/lib/reports/charla-attendance'
import { NO_SEDE, type GrowthReport } from '@/lib/reports/member-growth'

const NAVY = '#161440'
const CORAL = '#EF5554'
const CORAL_SOFT = '#F4B6B5' // coral claro: semanas parciales
const TEAL = '#519DA2'
// Color por posición de año en el comparativo (más viejo → más nuevo). El AÑO
// SELECCIONADO es siempre el último ⇒ CORAL, y se usa el mismo coral en todos
// los gráficos del año seleccionado (semanal, crecimiento) para consistencia.
const YEAR_COLORS = [TEAL, NAVY, CORAL]
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid var(--outline-variant)',
  fontSize: 12,
  fontFamily: 'var(--font-body)',
}

export default function ReporteAsistenciaPage() {
  const [report, setReport] = useState<CharlaReport | null>(null)
  const [growth, setGrowth] = useState<GrowthReport | null>(null)
  const [year, setYear] = useState<number | null>(null)
  const [sede, setSede] = useState<string>(ALL_SEDES)
  const [tab, setTab] = useState<'asistencia' | 'crecimiento'>('asistencia')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback((y: number | null, s: string) => {
    setLoading(true); setError(null)
    const qs = new URLSearchParams()
    if (y) qs.set('year', String(y))
    if (s) qs.set('sede', s)
    const q = qs.toString()
    Promise.all([
      fetch(`/api/reports/charla-attendance?${q}`).then(r => { if (!r.ok) throw new Error('Error cargando el reporte'); return r.json() as Promise<CharlaReport> }),
      fetch(`/api/reports/member-growth?${q}`).then(r => { if (!r.ok) throw new Error('Error cargando crecimiento'); return r.json() as Promise<GrowthReport> }),
    ])
      .then(([d, g]) => {
        setReport(d)
        setGrowth(g)
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
  if (!report || !growth) {
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
  const hasPartialWeek = report.weekly.some(w => w.partial)
  // Card de promedio semanal del año seleccionado (cambia con el pill).
  const selectedCard = report.annualCards.find(c => c.year === report.year)

  // Datos de gráficos
  const monthlyData = report.monthly.map(m => {
    const row: Record<string, number | string | null> = { month: MONTHS[m.month - 1] }
    for (const y of report.monthlyYears) row[String(y)] = m.values[y]
    return row
  })
  const growthMonthlyData = growth.monthly.map(m => ({ month: MONTHS[m.month - 1], total: m.total }))
  const topSede = growth.bySede.find(s => s.sede !== NO_SEDE)
  const sinSede = growth.bySede.find(s => s.sede === NO_SEDE)?.total ?? 0

  return (
    <div className={loading ? 'opacity-60 transition-opacity pointer-events-none' : 'transition-opacity'}>
      <ReportShell
        title="Crecimiento y Asistencia"
        description="Personas nuevas y check-ins a charlas por sede. Fuente: perfiles (fecha de registro) y eventos de tipo charla; la sede se deriva de la asistencia."
        years={report.years}
        year={report.year}
        onYear={onYear}
        sedes={report.sedes}
        sede={report.sede}
        onSede={onSede}
      >
        {/* Pestañas: separan las dos secciones del reporte para acortar la página. */}
        <Tabs
          tabs={[
            { key: 'asistencia', label: 'Asistencia' },
            { key: 'crecimiento', label: 'Crecimiento' },
          ]}
          active={tab}
          onChange={k => setTab(k as 'asistencia' | 'crecimiento')}
        />

        {/* ───────────────────────── Asistencia ───────────────────────── */}
        {tab === 'asistencia' && (
          <div role="tabpanel" aria-label="Asistencia" className="space-y-5">
            {/* Una sola card de promedio semanal (la del año del pill) a la par del
                gráfico: 1/5 la card, 4/5 el gráfico semanal. */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
              <div className="lg:col-span-1">
                {selectedCard && (
                  <KpiCard
                    label={`Promedio semanal ${selectedCard.year}`}
                    value={selectedCard.weeklyAvg}
                    sublabel={`${selectedCard.total.toLocaleString('es-CR')} check-ins`}
                    changePct={selectedCard.changePct}
                    highlight
                  />
                )}
              </div>
              <div className="lg:col-span-4">
                <ChartCard
                  title={`Asistencia semanal — ${report.year}`}
                  subtitle={`Total de check-ins de charla por semana (${sedeLabel}). Línea punteada = promedio del año.`}
                  empty={report.weekly.length === 0}
                  footnote={hasPartialWeek ? 'Las barras en tono claro son semanas parciales (feriado o pocos días con charlas), no caídas reales de asistencia.' : undefined}
                >
                  <ResponsiveContainer>
                    <BarChart data={report.weekly} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" vertical={false} />
                      <XAxis dataKey="week" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} label={{ value: 'Semana', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v, _n, p) => [Number(v), (p?.payload as { partial?: boolean })?.partial ? 'Check-ins (semana parcial)' : 'Check-ins']}
                        labelFormatter={(l) => `Semana ${l}`}
                      />
                      <ReferenceLine y={report.weeklyAvg} stroke={NAVY} strokeDasharray="5 4" strokeWidth={1.5} />
                      <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={28}>
                        {report.weekly.map(w => <Cell key={w.week} fill={w.partial ? CORAL_SOFT : CORAL} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </div>

            {/* Comparativos lado a lado en desktop. */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
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
            </div>
          </div>
        )}

        {/* ───────────────────────── Crecimiento ───────────────────────── */}
        {tab === 'crecimiento' && (
          <div role="tabpanel" aria-label="Crecimiento" className="space-y-5">
            <p className="text-[12px] text-navy-light/60 font-body">
              Crecimiento <strong className="text-navy-light/80">bruto</strong> (solo altas, no se restan bajas). “Nuevo” = fecha de registro del perfil. Objetivo #1 del año: crecer en sedes.
            </p>

            {/* KPIs de crecimiento */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <KpiCard
                label={`Personas nuevas ${growth.year}`}
                value={growth.totalNew.toLocaleString('es-CR')}
                sublabel="Crecimiento bruto"
                changePct={growth.changePct}
                highlight
              />
              <KpiCard
                label="Sede con más nuevos"
                value={topSede ? topSede.sede : '—'}
                sublabel={topSede ? `${topSede.total.toLocaleString('es-CR')} personas` : 'Sin datos'}
              />
              <KpiCard
                label="Sin sede"
                value={sinSede.toLocaleString('es-CR')}
                sublabel="No asistieron a charla"
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {/* Crecimiento por sede */}
              <ChartCard
                title={`Personas nuevas por sede — ${growth.year}`}
                subtitle="Cuántas personas nuevas se sumaron por sede. La sede seleccionada se resalta."
                empty={growth.bySede.length === 0}
                height={Math.max(220, growth.bySede.length * 32)}
                footnote='La sede de cada persona es la de mayor asistencia a charlas (sede dominante). “Sin sede” = personas sin asistencia registrada. Basado en la fecha de registro del perfil.'
              >
                <ResponsiveContainer>
                  <BarChart layout="vertical" data={growth.bySede} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="sede" width={110} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v).toLocaleString('es-CR'), 'Personas nuevas']} cursor={{ fill: 'rgba(22,20,64,0.04)' }} />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={26}>
                      {growth.bySede.map(s => (
                        <Cell key={s.sede} fill={growth.sede !== ALL_SEDES && s.sede === growth.sede ? CORAL : s.sede === NO_SEDE ? '#A9A8BE' : NAVY} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Tendencia de nuevos por mes */}
              <ChartCard
                title={`Nuevos por mes — ${growth.year}`}
                subtitle={`Ritmo de captación de personas nuevas (${sedeLabel}).`}
                empty={growth.totalNew === 0}
                footnote="Cuenta cada persona en el mes en que se registró su perfil."
              >
                <ResponsiveContainer>
                  <BarChart data={growthMonthlyData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v).toLocaleString('es-CR'), 'Personas nuevas']} />
                    <Bar dataKey="total" fill={CORAL} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </div>
        )}
      </ReportShell>
    </div>
  )
}
