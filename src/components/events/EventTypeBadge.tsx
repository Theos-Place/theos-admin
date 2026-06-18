'use client'

import { cn } from '@/lib/utils'
import { eventTypeConfig } from '@/data/event-config'

interface EventTypeBadgeProps {
  type: string
  size?: 'sm' | 'md'
}

const DOT_COLORS: Record<string, string> = {
  navy:   'bg-navy',
  teal:   'bg-teal-deep',
  coral:  'bg-coral',
  purple: 'bg-purple-700',
  amber:  'bg-amber-600',
}

const TEXT_COLORS: Record<string, string> = {
  navy:   'text-navy',
  teal:   'text-teal-deep',
  coral:  'text-coral',
  purple: 'text-purple-700',
  amber:  'text-amber-600',
}

export function EventTypeBadge({ type, size = 'sm' }: EventTypeBadgeProps) {
  const config = eventTypeConfig(type)
  const dotColor = DOT_COLORS[config.color] ?? 'bg-navy'
  const textColor = TEXT_COLORS[config.color] ?? 'text-navy'
  const dotSize = size === 'md' ? 'h-2.5 w-2.5' : 'h-2 w-2'
  const textSize = size === 'md' ? 'text-sm' : 'text-[11px]'

  return (
    <span className={cn('inline-flex items-center gap-1.5 font-body', textSize, textColor)}>
      <span className={cn('rounded-full shrink-0', dotColor, dotSize)} />
      {config.label}
    </span>
  )
}
