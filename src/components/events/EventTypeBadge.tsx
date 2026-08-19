'use client'

import { cn } from '@/lib/utils'
import { useEventTypeStyle } from '@/hooks/useEventTypes'

interface EventTypeBadgeProps {
  type: string
  size?: 'sm' | 'md'
}

/** Badge de tipo de evento. Color y etiqueta salen del catálogo de la BD
 *  (event_types) → tipos custom creados por admins se ven solos, sin tocar código. */
export function EventTypeBadge({ type, size = 'sm' }: EventTypeBadgeProps) {
  const typeStyle = useEventTypeStyle()
  const { label, color } = typeStyle(type)
  const dotSize = size === 'md' ? 'h-2.5 w-2.5' : 'h-2 w-2'
  const textSize = size === 'md' ? 'text-sm' : 'text-[13px]'

  return (
    <span className={cn('inline-flex items-center gap-1.5 font-body', textSize)} style={{ color }}>
      <span className={cn('rounded-full shrink-0', dotSize)} style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}
