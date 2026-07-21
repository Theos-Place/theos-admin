'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList,
} from 'recharts'
import { KpiCard } from '@/components/reportes/KpiCard'
import { ChartCard } from '@/components/reportes/ChartCard'
import { cn } from '@/lib/utils'
import type { DiscipulosReport } from '@/lib/reports/discipulos'

const NAVY = '#161440'
const CORAL = '#EF5554'
const TEAL = '#519DA2'

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid var(--outline-variant)',
  fontSize: 12,
  fontFamily: 'var(--font-body)',
}

const fmt = (n: number) => n.toLocaleString('es-CR')

export default function ReporteDiscipulosPage() {
  const [report, setReport] = useState<DiscipulosReport | null>(null)
  const [cohortYear, setCohortYear] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Un solo fetch: el payload trae TODOS los cohortes (cohortTable), así que
  // cambiar de año se resuelve en memoria — no vuelve a pegarle al servidor.
  const fetchReport = useCallback(() => {
    fetch('/api/reports/discipulos')
      .then(r => { if (!r.ok) throw new Error('Error cargando el reporte'); return r.json() as Promise<DiscipulosReport> })
      .then(d => { setReport(d); setCohortYear(d.cohortYear); setError(null) })
      .catch(e => setError(e instanceof Error ? e.message : 'Error'))
  }, [])

  useEffect(() => { fetchReport() }, [fetchReport])

  function onCohortYear(y: number) { setCohortYear(y) }

  if (!report) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-72 rounded-lg bg-surface-card animate-pulse" />
        {error ? (
          <p className="text-sm text-coral font-body">{error}</p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-surface-card animate-pulse" />)}
            </div>
            <div className="h-72 rounded-2xl bg-surface-card animate-pulse" />
          </div>
        )}
      </div>
    )
  }

  const { total, dm, criteria, venn, milestones, cohortYears, cohortTable } = report
  const dmPct = total > 0 ? Math.round((dm / total) * 1000) / 10 : 0
  // Cohorte seleccionada: se deriva de cohortTable en memoria (sin refetch).
  const cohort = cohortTable.find(r => r.year === cohortYear) ?? report.cohort

  // Combinaciones para las barras (excluye la triple, que es el DM/hero).
  const comboData = [
    { name: 'Comprometido + Sirve', value: venn.comprometidoSirve },
    { name: 'Comprometido + Dona', value: venn.comprometidoDona },
    { name: 'Sirve + Dona', value: venn.sirveDona },
    { name: 'Las 3 (DM)', value: venn.losTres },
  ]
  const milestoneData = milestones.map(m => ({ ...m, meses: Math.round((m.avgDays / 30.44) * 10) / 10 }))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <Link href="/reportes" className="inline-flex items-center gap-1 text-[13px] text-navy-light/60 hover:text-navy transition-colors font-body">
          <ChevronLeft size={15} /> Reportes
        </Link>
        <h1 className="mt-1 text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">Discípulos Multiplicadores</h1>
        <p className="mt-1 text-sm text-navy-light/60 font-body">
          Personas que cumplen los 3 criterios a la vez: asistencia comprometida, sirven y donan activamente.
        </p>
      </div>

      {/* Hero + criterios */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Discípulos Multiplicadores hoy"
          value={fmt(dm)}
          sublabel={`${dmPct}% de ${fmt(total)} personas`}
          highlight
        />
        <KpiCard
          label="Comprometidos"
          value={fmt(criteria.comprometidos.n)}
          sublabel={`${criteria.comprometidos.pct}% de la base`}
          info="≥6 charlas en los últimos 6 meses y al menos 1 en los últimos 60 días."
        />
        <KpiCard
          label="Sirven"
          value={fmt(criteria.sirven.n)}
          sublabel={`${criteria.sirven.pct}% de la base`}
          info="Registrados como voluntarios activos."
        />
        <KpiCard
          label="Donan activamente"
          value={fmt(criteria.donan.n)}
          sublabel={`${criteria.donan.pct}% de la base`}
          info="Donaron en aproximadamente los últimos 2 trimestres (flag is_donor)."
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Venn de traslape */}
        <ChartCard
          title="Traslape entre criterios"
          subtitle="Cómo se combinan los 3 criterios. El centro son los Discípulos Multiplicadores."
          height={300}
          footnote="Comprometido = coral · Sirve = navy · Dona = teal. Los números son personas en cada región."
        >
          <VennDiagram venn={venn} />
        </ChartCard>

        {/* Combos como barras */}
        <ChartCard
          title="Combinaciones de criterios"
          subtitle="Cuántas personas caen en cada intersección."
          height={300}
        >
          <ResponsiveContainer>
            <BarChart layout="vertical" data={comboData} margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fmt(Number(v)), 'Personas']} cursor={{ fill: 'rgba(22,20,64,0.04)' }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={30}>
                {comboData.map((d, i) => <Cell key={d.name} fill={i === 3 ? CORAL : NAVY} />)}
                <LabelList dataKey="value" position="right" formatter={(v) => fmt(Number(v))} style={{ fontSize: 11, fill: 'var(--navy)', fontFamily: 'var(--font-body)' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Tiempo a hitos */}
      <ChartCard
        title="Tiempo promedio a cada hito"
        subtitle="Meses desde el registro del perfil hasta alcanzar cada hito."
        empty={milestoneData.length === 0}
        height={Math.max(180, milestoneData.length * 56)}
        footnote='La "primera asistencia comprometida" se aproxima por la fecha de la 6.ª charla. Se excluyen valores negativos.'
      >
        <ResponsiveContainer>
          <BarChart layout="vertical" data={milestoneData} margin={{ top: 4, right: 60, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} unit=" m" />
            <YAxis type="category" dataKey="label" width={180} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v, _n, p) => [`${v} meses (~${fmt((p?.payload as { avgDays: number })?.avgDays ?? 0)} días)`, 'Promedio']}
              labelFormatter={(l, p) => `${l} · n=${fmt((p?.[0]?.payload as { n?: number })?.n ?? 0)}`}
            />
            <Bar dataKey="meses" fill={TEAL} radius={[0, 4, 4, 0]} maxBarSize={30}>
              <LabelList dataKey="meses" position="right" formatter={(v) => `${Number(v)} m`} style={{ fontSize: 11, fill: 'var(--navy)', fontFamily: 'var(--font-body)' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Cohorte */}
      <div className="rounded-2xl bg-surface-card p-4 shadow-[var(--shadow-md)] space-y-4">
        <div>
          <h3 className="text-sm font-bold text-navy font-display">Fotografía por cohorte</h3>
          <p className="text-[12px] text-navy-light/70 font-body mt-0.5">
            Personas cuya primera charla fue en el año elegido, y cuántas son Discípulos Multiplicadores hoy.
          </p>
        </div>

        {/* Selector de año */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {cohortYears.map(y => (
            <button
              key={y}
              onClick={() => onCohortYear(y)}
              className={cn(
                'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium font-body transition-colors',
                y === cohortYear ? 'bg-coral text-white' : 'bg-surface-low text-navy-light/70 hover:bg-surface-high',
              )}
            >
              {y}
            </button>
          ))}
        </div>

        {/* Panel del año seleccionado */}
        {cohort && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <CohortStat label={`Nuevos en ${cohort.year}`} value={fmt(cohort.nuevos)} highlight />
            <CohortStat label="Son DM hoy" value={fmt(cohort.dmHoy)} sub={cohort.nuevos > 0 ? `${Math.round((cohort.dmHoy / cohort.nuevos) * 1000) / 10}%` : undefined} />
            <CohortStat label="Comprometidos" value={fmt(cohort.comprometidos)} />
            <CohortStat label="Sirven" value={fmt(cohort.sirven)} />
            <CohortStat label="Donan" value={fmt(cohort.donan)} />
          </div>
        )}

        {/* Mini tabla comparativa */}
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] font-body">
            <thead>
              <tr className="text-navy-light/60 text-left border-b border-outline">
                <th className="py-2 pr-3 font-medium">Cohorte</th>
                <th className="py-2 px-3 font-medium text-right">Nuevos</th>
                <th className="py-2 px-3 font-medium text-right">DM hoy</th>
                <th className="py-2 px-3 font-medium text-right">% DM</th>
              </tr>
            </thead>
            <tbody>
              {cohortTable.map(r => (
                <tr
                  key={r.year}
                  className={cn('border-b border-outline/50', r.year === cohortYear && 'bg-coral/5')}
                >
                  <td className="py-2 pr-3 text-navy font-medium tabular-nums">{r.year}</td>
                  <td className="py-2 px-3 text-right text-navy tabular-nums">{fmt(r.nuevos)}</td>
                  <td className="py-2 px-3 text-right text-navy tabular-nums">{fmt(r.dmHoy)}</td>
                  <td className="py-2 px-3 text-right text-navy-light/70 tabular-nums">
                    {r.nuevos > 0 ? `${Math.round((r.dmHoy / r.nuevos) * 1000) / 10}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/** Diagrama de Venn de 3 conjuntos con las 7 regiones etiquetadas. */
function VennDiagram({ venn }: { venn: DiscipulosReport['venn'] }) {
  return (
    <svg viewBox="0 0 320 300" className="w-full h-full" role="img" aria-label="Diagrama de traslape de criterios">
      <g style={{ mixBlendMode: 'multiply' }}>
        <circle cx="120" cy="115" r="82" fill="rgba(239,85,84,0.28)" />
        <circle cx="200" cy="115" r="82" fill="rgba(22,20,64,0.22)" />
        <circle cx="160" cy="190" r="82" fill="rgba(81,157,162,0.28)" />
      </g>
      {/* Etiquetas de conjunto */}
      <text x="70" y="45" textAnchor="middle" fontSize="12" fontWeight="700" fill={CORAL} fontFamily="var(--font-display)">Comprometido</text>
      <text x="250" y="45" textAnchor="middle" fontSize="12" fontWeight="700" fill={NAVY} fontFamily="var(--font-display)">Sirve</text>
      <text x="160" y="290" textAnchor="middle" fontSize="12" fontWeight="700" fill={TEAL} fontFamily="var(--font-display)">Dona</text>
      {/* Números por región */}
      <VennNum x={88} y={100} n={venn.soloComprometido} />
      <VennNum x={232} y={100} n={venn.soloSirve} />
      <VennNum x={160} y={220} n={venn.soloDona} />
      <VennNum x={160} y={92} n={venn.comprometidoSirve} />
      <VennNum x={115} y={165} n={venn.comprometidoDona} />
      <VennNum x={205} y={165} n={venn.sirveDona} />
      <VennNum x={160} y={145} n={venn.losTres} big />
    </svg>
  )
}

function VennNum({ x, y, n, big }: { x: number; y: number; n: number; big?: boolean }) {
  return (
    <text
      x={x} y={y}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={big ? 20 : 14}
      fontWeight={big ? 800 : 700}
      fill="#161440"
      fontFamily="var(--font-display)"
    >
      {n.toLocaleString('es-CR')}
    </text>
  )
}

function CohortStat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={cn('rounded-xl p-3', highlight ? 'bg-coral/10' : 'bg-surface-low')}>
      <p className="text-[11px] text-navy-light/70 font-body">{label}</p>
      <p className={cn('mt-1 text-xl font-extrabold tabular-nums font-display leading-none', highlight ? 'text-coral' : 'text-navy')}>{value}</p>
      {sub && <p className="mt-1 text-[11px] text-navy-light/70 font-body">{sub}</p>}
    </div>
  )
}
