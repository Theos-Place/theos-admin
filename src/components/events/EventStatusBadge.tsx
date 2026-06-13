'use client'

import { cn } from '@/lib/utils'
import { EVENT_STATUS_CONFIG, type EventStatus } from '@/data/mock-events'

interface EventStatusBadgeProps {
  status: EventStatus
  size?: 'sm' | 'md'
}

const BADGE_STYLES: Record<EventStatus, string> = {
  upcoming:    'bg-teal-soft/30 text-teal-deep',
  in_progress: 'bg-coral/10 text-coral',
  finished:    'bg-navy/10 text-navy/60',
  cancelled:   'bg-red-100 text-red-600',
  archived:    'bg-navy-light/10 text-navy-light/60',
}

export function EventStatusBadge({ status, size = 'sm' }: EventStatusBadgeProps) {
  const config = EVENT_STATUS_CONFIG[status]
  const badgeStyle = BADGE_STYLES[status]
  const textSize = size === 'md' ? 'text-xs' : 'text-[10px]'
  const padding = size === 'md' ? 'px-2.5 py-1' : 'px-2 py-0.5'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md font-medium font-display',
        textSize,
        padding,
        badgeStyle
      )}
    >
      {status === 'in_progress' && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-coral opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-coral" />
        </span>
      )}
      {config.label}
    </span>
  )
}
