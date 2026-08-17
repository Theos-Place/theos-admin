'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, Legend, Cell,
} from 'recharts'
import { ReportShell } from '@/components/reportes/ReportShell'
import { KpiCard } from '@/components/reportes/KpiCard'
import { ChartCard } from '@/components/reportes/ChartCard'
import { UpdatingBadge } from '@/components/reportes/UpdatingBadge'
import { Tabs } from '@/components/shared/Tabs'
import { ALL_SEDES, type CharlaReport } from '@/lib/reports/charla-attendance'
import { NO_SEDE, type GrowthReport } from '@/lib/reports/member-growth'

const NAVY = '#161440'
const CORAL = '#EF5554'
const CORAL_DIM = 'rgba(239,85,84,0.55)' // coral apagado: semanas no destacadas
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

  // ── Asistencia semanal: semana a destacar + línea fantasma del año anterior ──
  const isCurrentYear = report.year === new Date().getFullYear()
  // Para el año en curso destacamos la última semana con datos (la "actual");
  // para años cerrados, la semana pico del período.
  const peakWeek = report.weekly.reduce<{ week: number; total: number } | null>(
    (best, w) => (!best || w.total > best.total ? { week: w.week, total: w.total } : best), null)
  const latestWeek = report.weekly.length ? report.weekly[report.weekly.length - 1].week : null
  const highlightWeek = isCurrentYear ? latestWeek : peakWeek?.week ?? null
  const prevYear = report.year - 1
  // Intervalo de etiquetas del eje X: ~12 visibles como máximo (cada 2 / cada 4).
  const xTickInterval = report.weekly.length > 28 ? 3 : 1

  // ── Mini-KPIs (todo del payload actual, sin métricas nuevas) ──
  const totalYear = selectedCard?.total ?? 0
  const bestWeek = peakWeek?.total ?? 0
  const sedeLeader = report.sedeRanking[0] ?? null

  // Datos de gráficos
  const monthlyData = report.monthly.map(m => {
    const row: Record<string, number | string | null> = { month: MONTHS[m.month - 1] }
    for (const y of report.monthlyYears) row[String(y)] = m.values[y]
    return row
  })
  const growthMonthlyData = growth.monthly.map(m => ({ month: MONTHS[m.month - 1], total: m.total }))
  const topSede = growth.bySede.find(s => s.sede !== NO_SEDE)
  const sinSede = growth.bySede.find(s => s.sede === NO_SEDE)?.total ?? 0
  const growthTotal = growth.bySede.reduce((acc, s) => acc + s.total, 0)
  const sinSedePct = growthTotal > 0 ? Math.round((sinSede / growthTotal) * 1000) / 10 : 0
  // "Sin sede" es una categoría especial: va al final del gráfico, no entre sedes.
  const bySedeOrdered = [
    ...growth.bySede.filter(s => s.sede !== NO_SEDE),
    ...growth.bySede.filter(s => s.sede === NO_SEDE),
  ]

  return (
    <div className={loading ? 'opacity-60 transition-opacity pointer-events-none' : 'transition-opacity'}>
      <UpdatingBadge show={loading} />
      <ReportShell
        title="Crecimiento y Asistencia"
        description="Personas nuevas y check-ins a charlas por sede. Fuente: perfiles (fecha de registro) y eventos de tipo charla; la sede se deriva de la asistencia."
        years={report.years}
        year={report.year}
        onYear={onYear}
        sedes={report.sedes}
        sede={report.sede}
        onSede={onSede}
        sedeCounts={Object.fromEntries(report.sedeRanking.map(s => [s.sede, s.total]))}
        totalCount={report.sedeRanking.reduce((acc, s) => acc + s.total, 0)}
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
          <div role="tabpanel" aria-label="Asistencia" className="space-y-3">
            {/* Card de promedio semanal (año del pill) + mini-KPIs a la izquierda
                (1/5) y el gráfico semanal a la derecha (4/5). */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
              <div className="lg:col-span-1 space-y-3">
                {selectedCard && (
                  <KpiCard
                    label={`Promedio semanal ${selectedCard.year}`}
                    value={selectedCard.weeklyAvg}
                    sublabel={`${selectedCard.total.toLocaleString('es-CR')} check-ins`}
                    changePct={selectedCard.changePct}
                    highlight
                  />
                )}
                {/* Mini-KPIs compactos: aprovechan el espacio al lado del gráfico. */}
                <div className="rounded-2xl bg-surface-card p-4 shadow-[var(--shadow-md)] space-y-2.5">
                  <MiniStat label="Total del año" value={totalYear.toLocaleString('es-CR')} />
                  <MiniStat label="Mejor semana" value={bestWeek.toLocaleString('es-CR')} sub="check-ins" />
                  <MiniStat label="Sede líder" value={sedeLeader ? sedeLeader.sede : '—'} sub={sedeLeader ? `${sedeLeader.total.toLocaleString('es-CR')} check-ins` : undefined} />
                  <MiniStat
                    label={`Vs. ${prevYear}`}
                    value={selectedCard?.changePct != null ? `${selectedCard.changePct > 0 ? '+' : ''}${selectedCard.changePct}%` : '—'}
                    tone={selectedCard?.changePct == null ? 'muted' : selectedCard.changePct >= 0 ? 'up' : 'down'}
                  />
                </div>
              </div>
              <div className="lg:col-span-4">
                <ChartCard
                  title={`Asistencia semanal — ${report.year}`}
                  subtitle={`Check-ins por semana (${sedeLabel}). Línea punteada navy = promedio del año.`}
                  empty={report.weekly.length === 0}
                  height={230}
                  footnote={hasPartialWeek ? 'Las barras en tono claro son semanas parciales (feriado o pocos días con charlas), no caídas reales.' : undefined}
                >
                  <ResponsiveContainer>
                    <BarChart data={report.weekly} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" vertical={false} />
                      <XAxis dataKey="week" interval={xTickInterval} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v, _n, p) => [Number(v), (p?.payload as { partial?: boolean })?.partial ? 'Check-ins (semana parcial)' : 'Check-ins']}
                        labelFormatter={(l) => `Semana ${l}`}
                      />
                      <ReferenceLine y={report.weeklyAvg} stroke={NAVY} strokeDasharray="5 4" strokeWidth={1.5} />
                      <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={28}>
                        {report.weekly.map(w => (
                          <Cell key={w.week} fill={w.partial ? CORAL_SOFT : w.week === highlightWeek ? CORAL : CORAL_DIM} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </div>

            {/* Comparativos lado a lado en desktop. */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* Comparación por sede */}
              <ChartCard
                title={`Comparación por sede — ${report.year}`}
                subtitle="Check-ins del año por sede. La sede seleccionada se resalta."
                empty={report.sedeRanking.length === 0}
                height={Math.max(180, report.sedeRanking.length * 26)}
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
                height={210}
                footnote="El mes en curso es un promedio de las semanas completas hasta hoy."
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
          <div role="tabpanel" aria-label="Crecimiento" className="space-y-3">
            <p className="text-[12px] text-navy-light/70 font-body">
              Crecimiento <strong className="text-navy-light/90">bruto</strong> (solo altas, no se restan bajas). “Nuevo” = fecha de registro del perfil. Objetivo #1 del año: crecer en sedes.
            </p>

            {/* KPIs de crecimiento */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <KpiCard
                label={`Personas nuevas ${growth.year}`}
                value={growth.totalNew.toLocaleString('es-CR')}
                sublabel={growth.partialPeriod ? `Bruto · vs. mismo período ${growth.year - 1}` : 'Crecimiento bruto'}
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
                sublabel={`${sinSedePct}% del total · sin asistencia a charlas`}
                info="Personas sin asistencia a charlas registrada. Probablemente ingresaron por estudios bíblicos sin haber asistido a charlas. No es un error de datos."
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* Crecimiento por sede */}
              <ChartCard
                title={`Personas nuevas por sede — ${growth.year}`}
                subtitle="Personas nuevas por sede. La sede seleccionada se resalta."
                empty={growth.bySede.length === 0}
                height={Math.max(180, bySedeOrdered.length * 26)}
                footnote='Sede = la de mayor asistencia a charlas. “Sin sede” (al final) = sin asistencia registrada.'
              >
                <ResponsiveContainer>
                  <BarChart layout="vertical" data={bySedeOrdered} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="sede" width={110} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v).toLocaleString('es-CR'), 'Personas nuevas']} cursor={{ fill: 'rgba(22,20,64,0.04)' }} />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={26}>
                      {bySedeOrdered.map(s => (
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
                height={210}
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

/** Mini-KPI compacto para la columna lateral del gráfico semanal. */
function MiniStat({ label, value, sub, tone = 'default' }: {
  label: string
  value: string
  sub?: string
  tone?: 'default' | 'up' | 'down' | 'muted'
}) {
  const valueColor = tone === 'up' ? 'text-teal-deep' : tone === 'down' ? 'text-coral' : tone === 'muted' ? 'text-navy-light/70' : 'text-navy'
  return (
    <div className="flex items-baseline justify-between gap-2">
      <p className="text-[12px] text-navy-light/70 font-body">{label}</p>
      <p className={`text-sm font-extrabold tabular-nums font-display leading-none text-right ${valueColor}`}>
        {value}
        {sub && <span className="block text-[11px] font-normal text-navy-light/70 font-body mt-0.5">{sub}</span>}
      </p>
    </div>
  )
}
