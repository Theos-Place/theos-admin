'use client'

import { useEffect, useState } from 'react'
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
  year, week, sede, onVolver,
}: {
  year: number
  week: number
  /** 'all' o el nombre de la sede; se pasa tal cual al endpoint. */
  sede: string
  onVolver: () => void
}) {
  const [detalle, setDetalle] = useState<DetalleDeSemana | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Sin resetear estado acá dentro: el padre le pasa una `key` por semana, así
  // que el componente se remonta y arranca limpio. Es la forma que no dispara
  // renders en cascada.
  useEffect(() => {
    let vivo = true
    const clave = `${year}-W${String(week).padStart(2, '0')}`
    const qs = new URLSearchParams({ semana: clave })
    if (sede && sede !== 'all') qs.set('sede', sede)
    fetch(`/api/reports/charla-attendance?${qs}`)
      .then(async r => {
        if (r.ok) return r.json()
        const b = await r.json().catch(() => null)
        throw new Error(b?.error ?? 'No se pudo cargar la semana.')
      })
      .then(d => { if (vivo) setDetalle(d) })
      .catch(e => { if (vivo) setError(e.message) })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [year, week, sede])

  const maximo = detalle?.porSede[0]?.total ?? 1

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
              : 'Solo esta semana, no el acumulado del año.'}
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
        <div className="flex items-center gap-2 py-10 justify-center text-navy-light/80">
          <Loader2 size={16} className="animate-spin" aria-hidden />
          <span className="text-sm font-body">Cargando la semana…</span>
        </div>
      ) : error ? (
        <p className="text-[13px] text-coral-deep font-body py-6" role="alert">{error}</p>
      ) : detalle ? (
        <>
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

          <div className="space-y-2 pt-1">
            <p className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">Por sede</p>
            {detalle.porSede.map(s => (
              <div key={s.sede} className="flex items-center gap-3">
                <span className="w-44 shrink-0 truncate text-[13px] text-navy font-body">{s.sede}</span>
                <div className="flex-1 h-5 rounded-full bg-surface-low overflow-hidden">
                  <div className="h-full rounded-full bg-coral" style={{ width: `${Math.max(2, (s.total / maximo) * 100)}%` }} />
                </div>
                <span className="w-28 shrink-0 text-right text-[13px] text-navy-light/80 font-body tabular-nums">
                  <strong className="text-navy">{s.total}</strong>
                  {s.servidores > 0 && ` · ${s.servidores} serv.`}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
