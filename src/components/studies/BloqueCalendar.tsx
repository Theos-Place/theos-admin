'use client'

// BLQ-1 · Calendario anual de bloques de capacitación.
//
// Los 12 meses en una línea; cada bloque es una barra que va del PRIMER folleto
// (3 semanas antes de abrir) al cierre de matrícula, con sus hitos marcados
// encima. Debajo, en su propio carril, las ventanas de matrícula de los grupos
// (GRU-1) que caen en el año.
//
// MÓVIL: un año entero en 360 px no se lee. En pantalla angosta esto no se
// muestra — la página cae a la lista, que sí funciona ahí.
import {
  monthTicks, bloqueBar, colorFor, ventanaBar, positionInYear,
  type BloqueLite, type VentanaGrupo,
} from '@/lib/studies/bloque-calendar'
import { cn } from '@/lib/utils'

const fmtCorto = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('es-CR', { day: 'numeric', month: 'short' })

export function BloqueCalendar({ year, bloques, ventanas, todayIso, onSelect }: {
  year: number
  bloques: BloqueLite[]
  /** Ventanas de matrícula de grupos (GRU-1). Vacío = no se pinta el carril. */
  ventanas?: VentanaGrupo[]
  /** Hoy (YYYY-MM-DD) para la línea de "estamos acá". */
  todayIso: string
  onSelect?: (bloqueId: string) => void
}) {
  const ticks = monthTicks(year)
  // Orden por fecha: así el color de cada bloque no baila entre recargas.
  const ordenados = [...bloques].sort((a, b) => a.fecha_apertura.localeCompare(b.fecha_apertura))
  const barras = ordenados
    .map((b, i) => ({ bar: bloqueBar(b, year), color: colorFor(i) }))
    .filter((x): x is { bar: NonNullable<ReturnType<typeof bloqueBar>>; color: ReturnType<typeof colorFor> } => x.bar !== null)

  const hoyPct = positionInYear(todayIso, year)
  const ventanasVisibles = (ventanas ?? [])
    .map(v => ({ v, geo: ventanaBar(v, year) }))
    .filter((x): x is { v: VentanaGrupo; geo: NonNullable<ReturnType<typeof ventanaBar>> } => x.geo !== null)

  return (
    <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] p-5 space-y-4 overflow-x-auto">
      <div className="min-w-[720px] space-y-3">
        {/* Meses */}
        <div className="relative h-5">
          {ticks.map(t => (
            <span
              key={t.mes}
              className="absolute text-[10px] uppercase tracking-widest text-navy-light/60 font-display"
              style={{ left: `${t.pct}%` }}
            >
              {t.mes}
            </span>
          ))}
        </div>

        {/* Lienzo */}
        <div className="relative">
          {/* Grilla de meses */}
          <div className="absolute inset-0 pointer-events-none">
            {ticks.map(t => (
              <span
                key={t.mes}
                className="absolute top-0 bottom-0 w-px bg-[var(--outline-variant)]"
                style={{ left: `${t.pct}%` }}
              />
            ))}
          </div>

          {/* Hoy */}
          {hoyPct != null && (
            <div
              className="absolute top-0 bottom-0 w-px bg-coral z-10 pointer-events-none"
              style={{ left: `${hoyPct}%` }}
              aria-hidden
            >
              <span className="absolute -top-1 -left-1 h-2 w-2 rounded-full bg-coral" />
            </div>
          )}

          <div className="relative space-y-2 py-2">
            {barras.length === 0 && (
              <p className="text-[13px] text-navy-light/60 font-body py-6 text-center">
                No hay bloques en {year}.
              </p>
            )}

            {barras.map(({ bar, color }) => (
              <div key={bar.id} className="relative h-9">
                <button
                  type="button"
                  onClick={() => onSelect?.(bar.id)}
                  title={`${bar.nombre} · ${bar.hitos.map(h => `${h.label}: ${fmtCorto(h.fecha)}`).join(' · ')}`}
                  className={cn(
                    'absolute top-1.5 h-6 rounded-lg border text-left transition-all hover:brightness-95',
                    color.bar, color.border,
                    bar.cortadoAlInicio && 'rounded-l-none',
                    bar.cortadoAlFinal && 'rounded-r-none',
                  )}
                  style={{ left: `${bar.leftPct}%`, width: `${bar.widthPct}%` }}
                >
                  <span className="sr-only">{bar.nombre}</span>
                </button>

                {/* Hitos sobre la barra */}
                {bar.hitos.map(h => (
                  <span
                    key={h.key}
                    title={`${h.label}: ${fmtCorto(h.fecha)}`}
                    className={cn(
                      'absolute top-1 h-7 w-[3px] rounded-full z-[5]',
                      h.key === 'apertura' ? 'bg-white' : 'bg-navy/70',
                    )}
                    style={{ left: `${h.pct}%` }}
                  />
                ))}

                {/* Nombre: al lado de la barra, para que se lea aunque sea corta */}
                <span
                  className={cn('absolute top-2 text-[11px] font-body whitespace-nowrap', color.text)}
                  style={
                    bar.leftPct + bar.widthPct > 80
                      ? { right: `${100 - bar.leftPct}%`, paddingRight: 6 }
                      : { left: `${bar.leftPct + bar.widthPct}%`, paddingLeft: 6 }
                  }
                >
                  {bar.nombre}
                </span>
              </div>
            ))}

            {/* Carril de ventanas de matrícula por grupo (GRU-1) */}
            {ventanasVisibles.length > 0 && (
              <div className="pt-3 mt-1 border-t border-[var(--outline-variant)] space-y-1">
                <p className="text-[10px] uppercase tracking-widest text-navy-light/60 font-display">
                  Ventanas de matrícula por grupo ({ventanasVisibles.length})
                </p>
                <div className="relative h-3">
                  {ventanasVisibles.map(({ v, geo }) => (
                    <span
                      key={v.id}
                      title={`${v.nombre}: ${fmtCorto(v.desde)} – ${fmtCorto(v.hasta)}`}
                      className="absolute top-1 h-1.5 rounded-full bg-teal-deep/40"
                      style={{ left: `${geo.leftPct}%`, width: `${geo.widthPct}%` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Leyenda */}
        <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] text-navy-light/70 font-body">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-[3px] rounded-full bg-navy/70" /> Hito de folleto
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-[3px] rounded-full bg-white border border-navy/30" /> Apertura del bloque
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-coral" /> Hoy
          </span>
          <span className="text-navy-light/60">
            La barra va del primer folleto (3 semanas antes de abrir) al cierre de matrícula.
          </span>
        </div>
      </div>
    </div>
  )
}
