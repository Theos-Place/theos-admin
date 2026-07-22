'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, LabelList,
} from 'recharts'
import { ChartCard } from '@/components/reportes/ChartCard'
import { Tabs } from '@/components/shared/Tabs'
import { cn } from '@/lib/utils'
import {
  MAIN_GROUPS, G1_SUBS, GROUP_LABELS, type MainGroup, type RetencionReport,
} from '@/lib/reports/retencion'

const NAVY = '#161440'
const CORAL = '#EF5554'
const TEAL = '#519DA2'
const G1_COLORS: Record<string, string> = { G1a: TEAL, G1b: NAVY, G1c: CORAL }

const tooltipStyle = {
  borderRadius: 12, border: '1px solid var(--outline-variant)',
  fontSize: 12, fontFamily: 'var(--font-body)',
}
// Defensivo: un valor faltante muestra 0 en vez de tumbar la pantalla (p. ej.
// si el cache quedó con un formato distinto tras un deploy).
const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString('es-CR')

export default function ReporteRetencionPage() {
  const [report, setReport] = useState<RetencionReport | null>(null)
  const [group, setGroup] = useState<MainGroup>('G3')
  const [flowYear, setFlowYear] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchReport = useCallback(() => {
    fetch('/api/reports/retencion')
      .then(r => { if (!r.ok) throw new Error('Error cargando el reporte'); return r.json() as Promise<RetencionReport> })
      .then(setReport)
      .catch(e => setError(e instanceof Error ? e.message : 'Error'))
  }, [])
  useEffect(() => { fetchReport() }, [fetchReport])

  if (!report) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-72 rounded-lg bg-surface-card animate-pulse" />
        {error ? <p className="text-sm text-coral font-body">{error}</p> : (
          <div className="space-y-4">
            <div className="h-9 w-72 rounded-xl bg-surface-card animate-pulse" />
            <div className="h-72 rounded-2xl bg-surface-card animate-pulse" />
          </div>
        )}
      </div>
    )
  }

  const { years, coverageNote, uniquesByGroup, g1Subgroups, retentionByGroup, flowByGroup, projectionByGroup } = report

  const uniqueData = years.map((y, i) => {
    const row: Record<string, number | string> = { year: y }
    row.count = uniquesByGroup[group][i]?.count ?? 0
    return row
  })
  const retData = retentionByGroup[group].map(p => ({ label: `${p.fromYear}→${String(p.toYear).slice(2)}`, rate: p.rate, base: p.base, retained: p.retained }))
  const g1SubData = years.map((y, i) => {
    const row: Record<string, number | string> = { year: y }
    for (const s of G1_SUBS) row[s] = g1Subgroups[s][i]?.count ?? 0
    return row
  })
  const projData = projectionByGroup[group].map(p => ({ year: p.year, real: p.projected ? null : p.value, proj: p.value, projected: p.projected }))
  // Filtro de año del flujo: todos los años con datos (para poder mirar cohortes
  // viejas como 2020), default el más reciente.
  const flowYears = years
  const effFlowYear = flowYear && years.includes(flowYear) ? flowYear : years[years.length - 1]
  const flow = flowByGroup[group]?.[effFlowYear]
  const isTerminal = group === 'G4'

  return (
    <div className="space-y-5">
      <div>
        <Link href="/reportes" className="inline-flex items-center gap-1 text-[13px] text-navy-light/60 hover:text-navy transition-colors font-body">
          <ChevronLeft size={15} /> Reportes
        </Link>
        <h1 className="mt-1 text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">Retención y Transición en Grupos</h1>
        <p className="mt-1 text-sm text-navy-light/60 font-body">
          Cómo se retiene y transiciona la gente entre grupos etarios. Clasificado por edad al momento de asistir.
        </p>
      </div>

      <Tabs
        tabs={MAIN_GROUPS.map(g => ({ key: g, label: GROUP_LABELS[g].split(' · ')[0] }))}
        active={group}
        onChange={k => setGroup(k as MainGroup)}
      />
      <p className="text-[12px] text-navy-light/70 font-body -mt-2">{GROUP_LABELS[group]}</p>

      {/* Flujo POR AÑO: de los que asistieron a este grupo en el año elegido,
          cómo están HOY. Filtro de año (últimos 5). */}
      <div className="rounded-2xl bg-surface-card p-4 shadow-[var(--shadow-md)] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-navy font-display">
            De los que asistieron a {group} en {effFlowYear}, hoy…
          </p>
          <div className="flex items-center gap-1.5">
            {flowYears.map(y => (
              <button
                key={y}
                onClick={() => setFlowYear(y)}
                className={cn(
                  'rounded-full px-3 py-1 text-[12px] font-medium font-body transition-colors',
                  y === effFlowYear ? 'bg-coral text-white' : 'bg-surface-low text-navy-light/70 hover:bg-surface-high',
                )}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
        {flow && flow.base > 0 ? (
          <div className={cn('grid grid-cols-2 gap-3', isTerminal ? 'lg:grid-cols-2' : 'lg:grid-cols-4')}>
            <FlowStat label="Siguen asistiendo" value={flow.siguen} tone="navy" sub={`de ${fmt(flow.base)} que asistieron en ${effFlowYear}`} />
            {!isTerminal && <FlowStat label="Transicionaron" value={flow.transicionaron} tone="teal" sub="pasaron al grupo siguiente" />}
            {!isTerminal && <FlowStat label="Perdidos en transición" value={flow.perdidos} tone="coral" sub="cumplieron la edad, no siguieron" />}
            <FlowStat label="Dropout" value={flow.dropout} tone="muted" sub={isTerminal ? 'ya no asisten' : 'dejaron antes de la edad límite'} />
          </div>
        ) : (
          <p className="text-[13px] text-navy-light/60 font-body py-2">Nadie asistió a {group} en {effFlowYear}.</p>
        )}
        <p className="text-[11px] text-navy-light/60 font-body">
          Estado calculado a HOY. Siguen asistiendo = ≥2 charlas en los últimos 4 meses.{isTerminal ? ' G4 es el grupo final: solo aplica seguir asistiendo o dropout.' : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Asistentes únicos por año */}
        <ChartCard title={`Asistentes únicos por año — ${group}`} subtitle="Personas distintas que asistieron al menos una vez ese año." height={260}>
          <ResponsiveContainer>
            <BarChart data={uniqueData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fmt(Number(v)), 'Asistentes']} />
              <Bar dataKey="count" fill={CORAL} radius={[4, 4, 0, 0]} maxBarSize={40}>
                <LabelList dataKey="count" position="top" formatter={(v) => fmt(Number(v))} style={{ fontSize: 10, fill: NAVY, fontFamily: 'var(--font-body)' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Retención año a año */}
        <ChartCard title={`Retención año a año — ${group}`} subtitle="De quienes estuvieron en el grupo un año, cuántos siguen al año siguiente." height={260}>
          <ResponsiveContainer>
            <BarChart data={retData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, _n, p) => [`${v}% (${fmt((p?.payload as { retained: number }).retained)} de ${fmt((p?.payload as { base: number }).base)})`, 'Retención']} />
              <Bar dataKey="rate" fill={TEAL} radius={[4, 4, 0, 0]} maxBarSize={40}>
                <LabelList dataKey="rate" position="top" formatter={(v) => `${Number(v)}%`} style={{ fontSize: 10, fill: NAVY, fontFamily: 'var(--font-body)' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Subgrupos de G1 (solo cuando G1 activo) */}
      {group === 'G1' && (
        <ChartCard title="Subgrupos de G1 por año" subtitle="G1a (2-4) · G1b (5-8) · G1c (9-12)" height={260}>
          <ResponsiveContainer>
            <BarChart data={g1SubData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'var(--font-body)' }} />
              {G1_SUBS.map(s => <Bar key={s} dataKey={s} stackId="g1" fill={G1_COLORS[s]} maxBarSize={40} />)}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Proyección */}
      <ChartCard
        title={`Proyección a 2030 — ${group}`}
        subtitle="Línea sólida = datos reales; punteada = proyección con la retención promedio de los últimos 3 años."
        height={260}
        footnote="Estimación simple: aplica la retención promedio al último año real. No modela ingresos nuevos."
      >
        <ResponsiveContainer>
          <LineChart data={projData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [v == null ? '—' : fmt(Number(v)), n === 'proj' ? 'Proyección' : 'Real']} />
            <Line type="monotone" dataKey="real" stroke={CORAL} strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} name="Real" />
            <Line type="monotone" dataKey="proj" stroke={CORAL} strokeWidth={2} strokeDasharray="5 4" dot={false} name="Proyección" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <p className="text-[11px] text-navy-light/60 font-body">{coverageNote}</p>
    </div>
  )
}

function FlowStat({ label, value, sub, tone }: { label: string; value: number; sub?: string; tone: 'navy' | 'teal' | 'coral' | 'muted' }) {
  const color = tone === 'teal' ? 'text-teal-deep' : tone === 'coral' ? 'text-coral' : tone === 'muted' ? 'text-navy-light/60' : 'text-navy'
  const bg = tone === 'teal' ? 'bg-teal-soft/20' : tone === 'coral' ? 'bg-coral/10' : tone === 'muted' ? 'bg-surface-low' : 'bg-surface-low'
  return (
    <div className={cn('rounded-2xl p-4 shadow-[var(--shadow-md)]', bg)}>
      <p className="text-[11px] tracking-widest uppercase text-navy-light/70 font-display">{label}</p>
      <p className={cn('mt-1.5 text-2xl font-extrabold tabular-nums font-display leading-none', color)}>{fmt(value)}</p>
      {sub && <p className="mt-1.5 text-[11px] text-navy-light/70 font-body">{sub}</p>}
    </div>
  )
}
