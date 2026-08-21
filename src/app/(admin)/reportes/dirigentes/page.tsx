'use client'

/**
 * DIR-7 · Reporte de dirigentes.
 *
 * Los cinco buckets de estado son excluyentes y suman el total, así que la barra
 * de estado se puede leer como una partición. El desglose por estudio y por zona
 * NO suma el total (un dirigente tiene varios códigos y varias zonas) y eso se
 * dice en la nota de cada tarjeta en vez de dejar que el lector saque la cuenta
 * y no le cierre.
 */
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ChevronLeft, ArrowUp, ArrowDown, Minus, AlertTriangle } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
} from 'recharts'
import { ChartCard } from '@/components/reportes/ChartCard'
import { cn } from '@/lib/utils'
import type { DirigentesReport, LeaderHistoryPoint } from '@/lib/reports/dirigentes'

const NAVY = '#161440'
const TEAL = '#519DA2'

const tooltipStyle = {
  borderRadius: 12, border: '1px solid var(--outline-variant)',
  fontSize: 12, fontFamily: 'var(--font-body)',
}
const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString('es-CR')

type Payload = DirigentesReport & { ver_matiz: boolean }

/** Tarjeta de número grande. `hint` explica qué cuenta, que en este reporte es
 *  la mitad del valor: "activos" y "dando ahora" se confunden fácil. */
function Kpi({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-2xl bg-surface-card p-4 shadow-[var(--shadow-md)]">
      <p className="text-[11px] uppercase tracking-wide text-navy-light/80 font-body">{label}</p>
      <p className="mt-1 text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">{fmt(value)}</p>
      {hint && <p className="mt-0.5 text-[13px] text-navy-light/80 font-body">{hint}</p>}
    </div>
  )
}

/** Comparación contra un punto histórico. Sin punto dice por qué no lo hay:
 *  la serie arrancó el 2026-08-21 y antes de eso no existe el dato. */
function Delta({ label, actual, punto }: { label: string; actual: number; punto: LeaderHistoryPoint | null }) {
  if (!punto) {
    return (
      <div className="rounded-2xl bg-surface-low p-4">
        <p className="text-[11px] uppercase tracking-wide text-navy-light/80 font-body">{label}</p>
        <p className="mt-1 text-[13px] text-navy-light/80 font-body">
          Todavía sin dato. La serie empezó a guardarse el 21 de agosto de 2026.
        </p>
      </div>
    )
  }
  const d = actual - punto.activos
  const Icon = d > 0 ? ArrowUp : d < 0 ? ArrowDown : Minus
  return (
    <div className="rounded-2xl bg-surface-card p-4 shadow-[var(--shadow-md)]">
      <p className="text-[11px] uppercase tracking-wide text-navy-light/80 font-body">{label}</p>
      <p className={cn(
        'mt-1 flex items-center gap-1 text-2xl font-display font-extrabold tracking-[-0.02em]',
        d > 0 ? 'text-success' : d < 0 ? 'text-coral' : 'text-navy',
      )}>
        <Icon size={18} aria-hidden="true" />
        {d > 0 ? '+' : ''}{fmt(d)}
      </p>
      <p className="mt-0.5 text-[13px] text-navy-light/80 font-body">
        Eran {fmt(punto.activos)} el {new Date(`${punto.captured_on}T12:00:00`).toLocaleDateString('es-CR', {
          day: '2-digit', month: 'short', year: 'numeric',
        })}
      </p>
    </div>
  )
}

export default function ReporteDirigentesPage() {
  const [report, setReport] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchReport = useCallback(() => {
    fetch('/api/reports/leaders')
      .then(r => { if (!r.ok) throw new Error('Error cargando el reporte'); return r.json() as Promise<Payload> })
      .then(setReport)
      .catch(e => setError(e instanceof Error ? e.message : 'Error'))
  }, [])
  useEffect(() => { fetchReport() }, [fetchReport])

  if (!report) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-72 rounded-lg bg-surface-card animate-pulse" />
        {error ? <p className="text-sm text-coral font-body">{error}</p> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-surface-card animate-pulse" />)}
          </div>
        )}
      </div>
    )
  }

  // Si el único bucket es "sin zona", no hay desglose que mostrar: una barra
  // sola con el total de activos no dice nada. Mejor la tarjeta vacía con el
  // porqué — hoy nada escribe zone_preference (el formulario de DIR-1 recoge la
  // zona pero es de solo lectura para el coordinador).
  const sinZonas = report.por_zona.length === 0
    || (report.por_zona.length === 1 && report.por_zona[0].zona === 'Sin zona declarada')

  const estadoData = [
    { estado: 'Dando ahora', total: report.dando_ahora },
    { estado: 'Disponibles', total: report.disponibles_sin_grupo },
    ...(report.ver_matiz ? [
      { estado: 'En pausa', total: report.en_pausa },
      { estado: 'En revisión', total: report.en_revision },
    ] : []),
    { estado: 'Inactivos', total: report.inactivos },
  ]

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/reportes"
          className="inline-flex items-center gap-1 text-[13px] text-navy-light/80 font-body hover:text-navy transition-colors"
        >
          <ChevronLeft size={14} aria-hidden="true" /> Reportes
        </Link>
        <h1 className="mt-1 text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">
          Dirigentes
        </h1>
        <p className="mt-1 text-sm text-navy-light/80 font-body">
          Cuántos hay, cuántos están dando estudio y para qué está capacitado el cuerpo de dirigentes.
        </p>
      </div>

      {/* Titulares */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Activos" value={report.activos} hint="En el comité de dirigentes" />
        <Kpi label="Dando ahora" value={report.dando_ahora} hint="Con grupo abierto o en curso" />
        <Kpi label="Disponibles" value={report.disponibles_sin_grupo} hint="Activos, sin grupo asignado" />
        <Kpi label="Designados" value={report.total} hint="Total histórico, activos e inactivos" />
      </div>

      {/* Calidad de datos: EST-1 dice que esto no debería existir, así que
          cuando existe hay que verlo. No es una métrica del cuerpo. */}
      {(report.dando_inactivos > 0 || report.dando_sin_ficha > 0) && (
        <div className="rounded-2xl bg-[rgba(233,185,73,0.12)] px-4 py-3">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-[#A8821F] font-body">
            <AlertTriangle size={14} aria-hidden="true" /> Datos por revisar
          </p>
          <ul className="mt-1 space-y-0.5 text-[13px] text-navy-light/80 font-body">
            {report.dando_inactivos > 0 && (
              <li>
                {fmt(report.dando_inactivos)} dirigente{report.dando_inactivos === 1 ? '' : 's'} lleva
                {report.dando_inactivos === 1 ? '' : 'n'} un grupo abierto estando inactivo{report.dando_inactivos === 1 ? '' : 's'}.
                La regla dice que eso no debería pasar.
              </li>
            )}
            {report.dando_sin_ficha > 0 && (
              <li>
                {fmt(report.dando_sin_ficha)} persona{report.dando_sin_ficha === 1 ? '' : 's'} lleva
                {report.dando_sin_ficha === 1 ? '' : 'n'} un grupo abierto sin ficha de dirigente, así que
                no aparece{report.dando_sin_ficha === 1 ? '' : 'n'} en los conteos de arriba.
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Evolución */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Delta label="Activos vs. hace 3 meses" actual={report.activos} punto={report.evolucion.hace_3_meses} />
        <Delta label="Activos vs. hace 6 meses" actual={report.activos} punto={report.evolucion.hace_6_meses} />
      </div>

      <ChartCard
        title="En qué está cada quien"
        subtitle="Los grupos no se solapan: suman el total de designados"
        height={260}
        footnote={report.ver_matiz
          ? 'Quien tiene un grupo abierto cuenta como "dando ahora" aunque su estado diga otra cosa: dar el estudio es un hecho, el estado es una intención.'
          : 'El desglose de pausa y revisión lo maneja la coordinación de dirigentes; acá van sumados a inactivos.'}
      >
        <ResponsiveContainer>
          <BarChart data={estadoData} layout="vertical" margin={{ left: 12, right: 32 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
            <YAxis type="category" dataKey="estado" width={100} tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(Number(v))} />
            <Bar dataKey="total" fill={NAVY} radius={[0, 6, 6, 0]} name="Dirigentes">
              <LabelList dataKey="total" position="right" style={{ fontSize: 12, fill: NAVY }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Capacidad por estudio: las dos columnas, que NO son lo mismo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Capacitados por estudio"
          subtitle="Para qué está formado cada dirigente"
          empty={report.capacitados.length === 0}
          height={Math.max(220, report.capacitados.length * 30)}
          footnote="Un dirigente cuenta en cada estudio para el que está capacitado, así que las barras no suman el total."
        >
          <ResponsiveContainer>
            <BarChart data={report.capacitados} layout="vertical" margin={{ left: 12, right: 32 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(Number(v))} />
              <Bar dataKey="total" fill={NAVY} radius={[0, 6, 6, 0]} name="Capacitados">
                <LabelList dataKey="total" position="right" style={{ fontSize: 11, fill: NAVY }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Dispuestos a darlo ahora"
          subtitle="Lo que declaró en su disponibilidad"
          empty={report.disponibles_por_estudio.length === 0}
          height={Math.max(220, report.disponibles_por_estudio.length * 30)}
          footnote="Comparado con la tarjeta de al lado: la diferencia es capacidad que existe y no está ofrecida."
        >
          <ResponsiveContainer>
            <BarChart data={report.disponibles_por_estudio} layout="vertical" margin={{ left: 12, right: 32 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(Number(v))} />
              <Bar dataKey="total" fill={TEAL} radius={[0, 6, 6, 0]} name="Disponibles">
                <LabelList dataKey="total" position="right" style={{ fontSize: 11, fill: NAVY }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Por zona */}
      <ChartCard
        title="Dirigentes activos por zona"
        subtitle="Según la preferencia de zona que declararon"
        empty={sinZonas}
        height={Math.max(240, report.por_zona.length * 30)}
        footnote={sinZonas
          ? undefined
          : 'Quien declaró varias zonas cuenta en todas, así que las barras suman más que el total de activos.'}
      >
        <ResponsiveContainer>
          <BarChart data={report.por_zona} layout="vertical" margin={{ left: 12, right: 32 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
            <YAxis type="category" dataKey="zona" width={150} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(Number(v))} />
            <Bar dataKey="dando_ahora" stackId="z" fill={NAVY} radius={[0, 0, 0, 0]} name="Dando ahora" />
            <Bar dataKey="disponibles_sin_grupo" stackId="z" fill={TEAL} radius={[0, 6, 6, 0]} name="Disponibles">
              <LabelList dataKey="activos" position="right" style={{ fontSize: 11, fill: NAVY }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
