import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Card KPI reutilizable: valor grande + subtítulo + cambio % opcional (flecha/color).
 *  Compartido por todos los reportes. */
export function KpiCard({
  label, value, sublabel, changePct, highlight, info,
}: {
  label: string
  value: string | number
  sublabel?: string
  changePct?: number | null
  /** Destaca la card (p. ej. el año seleccionado, que es el foco). */
  highlight?: boolean
  /** Texto de ayuda: muestra un ícono de info con tooltip al lado del label. */
  info?: string
}) {
  const up = changePct != null && changePct > 0
  const down = changePct != null && changePct < 0
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus
  return (
    <div className={cn(
      'rounded-2xl p-4 shadow-[var(--shadow-md)] transition-colors',
      highlight ? 'bg-coral/[0.06] ring-2 ring-coral/40' : 'bg-surface-card',
    )}>
      <p className={cn(
        'text-[12px] tracking-widest uppercase font-display flex items-center gap-1',
        highlight ? 'text-coral' : 'text-navy-light/70',
      )}>
        {label}
        {info && (
          <span className="group/info relative inline-flex">
            <span
              tabIndex={0}
              role="button"
              aria-label={info}
              className="cursor-help text-navy-light/50 hover:text-navy-light/80 focus:outline-none focus:text-navy-light/80"
            >
              <Info size={12} />
            </span>
            {/* Tooltip propio: visible en hover, foco de teclado y tap (no el
                `title` nativo, que no aparece en móvil y es lento). */}
            <span
              role="tooltip"
              className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 w-48 -translate-x-1/2 rounded-lg bg-navy px-2.5 py-1.5 text-[12px] font-normal normal-case leading-snug tracking-normal text-white opacity-0 shadow-[var(--shadow-lg)] transition-opacity duration-150 font-body group-hover/info:opacity-100 group-focus-within/info:opacity-100"
            >
              {info}
            </span>
          </span>
        )}
      </p>
      <p className="mt-1.5 text-2xl font-extrabold text-navy tabular-nums font-display leading-none">{value}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        {sublabel && <p className="text-[12px] text-navy-light/70 font-body">{sublabel}</p>}
        {changePct != null && (
          <span className={cn(
            'inline-flex items-center gap-0.5 text-[12px] font-medium font-body shrink-0',
            up ? 'text-teal-deep' : down ? 'text-coral' : 'text-navy-light/70',
          )}>
            <Icon size={13} />
            {changePct > 0 ? '+' : ''}{changePct}%
          </span>
        )}
      </div>
    </div>
  )
}
