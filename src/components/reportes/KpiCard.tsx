import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Card KPI reutilizable: valor grande + subtítulo + cambio % opcional (flecha/color).
 *  Compartido por todos los reportes. */
export function KpiCard({
  label, value, sublabel, changePct,
}: {
  label: string
  value: string | number
  sublabel?: string
  changePct?: number | null
}) {
  const up = changePct != null && changePct > 0
  const down = changePct != null && changePct < 0
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus
  return (
    <div className="rounded-2xl bg-surface-card p-4 shadow-[var(--shadow-md)]">
      <p className="text-[11px] tracking-widest uppercase text-navy-light/60 font-display">{label}</p>
      <p className="mt-1.5 text-2xl font-extrabold text-navy tabular-nums font-display leading-none">{value}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        {sublabel && <p className="text-[12px] text-navy-light/60 font-body">{sublabel}</p>}
        {changePct != null && (
          <span className={cn(
            'inline-flex items-center gap-0.5 text-[12px] font-medium font-body shrink-0',
            up ? 'text-teal-deep' : down ? 'text-coral' : 'text-navy-light/60',
          )}>
            <Icon size={13} />
            {changePct > 0 ? '+' : ''}{changePct}%
          </span>
        )}
      </div>
    </div>
  )
}
