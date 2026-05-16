'use client'

import { cn } from '@/lib/utils'

interface WeekProgressBarProps {
  current: number
  total: number
  className?: string
}

export function WeekProgressBar({ current, total, className }: WeekProgressBarProps) {
  const segments = Array.from({ length: total }, (_, i) => i < current)

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span
        className="text-[10px] text-navy-light/50"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Semana {current} de {total}
      </span>
      <div className="flex gap-0.5">
        {segments.map((filled, i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full',
              filled ? 'bg-navy' : 'bg-surface-low'
            )}
          />
        ))}
      </div>
    </div>
  )
}
