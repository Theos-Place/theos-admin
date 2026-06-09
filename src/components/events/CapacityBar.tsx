'use client'

import { cn } from '@/lib/utils'

interface CapacityBarProps {
  current: number
  max: number
  showLabel?: boolean
}

export function CapacityBar({ current, max, showLabel = true }: CapacityBarProps) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0
  const fillColor = pct > 90 ? 'bg-coral' : pct > 70 ? 'bg-amber-500' : 'bg-teal-deep'

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="h-1.5 w-16 rounded-full bg-surface-low overflow-hidden flex-shrink-0">
        <div
          className={cn('h-full rounded-full transition-all duration-500', fillColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span
          className="text-[11px] text-navy-light/60 whitespace-nowrap font-body"
        >
          {current}/{max}
        </span>
      )}
    </div>
  )
}
