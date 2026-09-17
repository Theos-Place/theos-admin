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
    // `relative` en la TARJETA: el tooltip se ancla a ella, así que sale JUSTO
    // DEBAJO y no tapa el número. Anclado al label —como quedó en el primer
    // intento— caía encima del valor, que es lo que la persona fue a leer.
    <div className={cn(
      'relative rounded-2xl p-4 shadow-[var(--shadow-md)] transition-colors',
      highlight ? 'bg-coral/[0.06] ring-2 ring-coral/40' : 'bg-surface-card',
    )}>
      {/* El tooltip mide lo mismo que la tarjeta (left-0 right-0 sobre el
          contenedor de arriba), así que NO se puede salir de pantalla. Antes
          iba pegado al ícono con `absolute left-1/2 w-48 -translate-x-1/2`:
          192px centrados en un ícono que en mobile queda contra el borde
          derecho, o sea medio tooltip afuera y cortado. */}
      <p className={cn(
        'text-[13px] tracking-widest uppercase font-display flex items-start gap-1',
        highlight ? 'text-coral' : 'text-navy-light/80',
      )}>
        {/* min-w-0 + break-words: sin esto el texto es un item flex que no baja
            de su min-content y se sale por el costado. Es la red de seguridad
            para cualquier label largo; el caso concreto que lo destapó
            —"DISCÍPULOS MULTIPLICADORES HOY" en dos columnas— se resolvió
            además pasando esas grillas a una sola columna en mobile, porque
            partir la palabra a la mitad se leía peor que el desborde. */}
        <span className="min-w-0 break-words">{label}</span>
        {info && (
          <span className="group/info inline-flex shrink-0">
            <span
              tabIndex={0}
              role="button"
              aria-label={info}
              className="cursor-help text-navy-light/80 hover:text-navy-light/80 focus:outline-none focus:text-navy-light/80"
            >
              <Info size={12} className="mt-px" />
            </span>
            {/* Tooltip propio: visible en hover, foco de teclado y tap (no el
                `title` nativo, que no aparece en móvil y es lento). */}
            <span
              role="tooltip"
              className="pointer-events-none absolute left-0 right-0 top-full z-30 mt-1.5 rounded-lg bg-navy px-2.5 py-1.5 text-[13px] font-normal normal-case leading-snug tracking-normal text-white opacity-0 shadow-[var(--shadow-lg)] transition-opacity duration-150 font-body group-hover/info:opacity-100 group-focus-within/info:opacity-100"
            >
              {info}
            </span>
          </span>
        )}
      </p>
      <p className="mt-1.5 text-2xl font-extrabold text-navy tabular-nums font-display leading-none">{value}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        {sublabel && <p className="text-[13px] text-navy-light/80 font-body">{sublabel}</p>}
        {changePct != null && (
          <span className={cn(
            'inline-flex items-center gap-0.5 text-[13px] font-medium font-body shrink-0',
            up ? 'text-teal-deep' : down ? 'text-coral' : 'text-navy-light/80',
          )}>
            <Icon size={13} />
            {changePct > 0 ? '+' : ''}{changePct}%
          </span>
        )}
      </div>
    </div>
  )
}
