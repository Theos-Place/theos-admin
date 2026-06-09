import { cn } from '@/lib/utils'

interface VacationTrackerProps {
  total: number
  used: number
  className?: string
}

export function VacationTracker({ total, used, className }: VacationTrackerProps) {
  const available = Math.max(0, total - used)
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0

  if (total === 0) {
    return (
      <p className="text-[12px] text-navy-light/40 font-body">
        No aplica (servicios profesionales)
      </p>
    )
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="h-2 w-full rounded-full overflow-hidden bg-surface-low">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            pct >= 90 ? 'bg-coral' : pct >= 60 ? 'bg-amber-400' : 'bg-teal-deep'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-navy-light/50 font-body">
        <span>{used} usados</span>
        <span>{available} disponibles de {total}</span>
      </div>
    </div>
  )
}
