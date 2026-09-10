'use client'

import { ArrowLeft, Loader2, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Comparacion, DetalleDeSemana } from '@/lib/reports/semana-detalle'

/**
 * REP-2 · El detalle de UNA semana, debajo del gráfico anual.
 *
 * La vista del año se queda como está: esto es un estado adicional. La
 * pregunta que contesta es "¿cómo nos fue ESTA semana, sede por sede?", que el
 * acumulado no contesta.
 */
function Delta({ c, etiqueta }: { c: Comparacion; etiqueta: string }) {
  if (c.total === null) {
    return (
      <div>
        <p className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">{etiqueta}</p>
        <p className="text-[13px] text-navy-light/80 font-body mt-0.5">Sin datos para comparar</p>
      </div>
    )
  }
  const sube = (c.delta ?? 0) > 0
  const igual = (c.delta ?? 0) === 0
  const Icono = igual ? Minus : sube ? TrendingUp : TrendingDown
  return (
    <div>
      <p className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">{etiqueta}</p>
      <p className={cn('text-sm font-semibold font-body mt-0.5 inline-flex items-center gap-1',
        igual ? 'text-navy-light/80' : sube ? 'text-teal-deep' : 'text-coral-deep')}>
        <Icono size={14} aria-hidden />
        {sube ? '+' : ''}{c.delta}
        {c.pct !== null && <span className="text-[13px] font-normal">({sube ? '+' : ''}{c.pct}%)</span>}
      </p>
      <p className="text-[13px] text-navy-light/80 font-body">eran {c.total}</p>
    </div>
  )
}

export function SemanaDetallePanel({
  year, week, detalle, cargando, error, onVolver,
}: {
  year: number
  week: number
  /** Lo trae la página: el mismo dato alimenta el gráfico de sedes. */
  detalle: DetalleDeSemana | null
  cargando: boolean
  error: string | null
  onVolver: () => void
}) {
  return (
    <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] p-5 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-navy font-display">
            Semana {week} de {year}
            {detalle?.enCurso && (
              <span className="ml-2 rounded-full bg-surface-low px-2.5 py-0.5 text-[11px] font-medium text-navy-light align-middle font-body">
                semana en curso
              </span>
            )}
          </h3>
          <p className="text-[13px] text-navy-light/80 font-body mt-0.5">
            {detalle?.enCurso
              ? 'Todavía no termina: no se puede comparar de igual a igual con una semana completa.'
              : 'Solo esta semana, no el acumulado del año. El gráfico de sedes de abajo también.'}
          </p>
        </div>
        <button
          onClick={onVolver}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--outline-variant)] px-3.5 py-1.5 text-[13px] text-navy-light hover:bg-surface-low transition-colors font-body"
        >
          <ArrowLeft size={13} aria-hidden /> Volver al año
        </button>
      </div>

      {cargando ? (
        <div className="flex items-center gap-2 py-8 justify-center text-navy-light/80">
          <Loader2 size={16} className="animate-spin" aria-hidden />
          <span className="text-sm font-body">Cargando la semana…</span>
        </div>
      ) : error ? (
        <p className="text-[13px] text-coral-deep font-body py-4" role="alert">{error}</p>
      ) : detalle ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">Asistencia</p>
            <p className="text-2xl font-extrabold text-navy font-display tabular-nums">{detalle.total}</p>
            <p className="text-[13px] text-navy-light/80 font-body">
              {detalle.asistentes} participantes
              {detalle.servidores > 0 && ` · ${detalle.servidores} servidores`}
            </p>
          </div>
          <Delta c={detalle.vsSemanaAnterior} etiqueta="vs semana anterior" />
          <Delta c={detalle.vsAnoPasado} etiqueta={`vs semana ${week} de ${year - 1}`} />
        </div>
      ) : null}
    </div>
  )
}
