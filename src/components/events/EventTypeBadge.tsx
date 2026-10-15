'use client'

import { cn } from '@/lib/utils'
import { useEventTypeStyle } from '@/hooks/useEventTypes'
import { textoSobreSuTinte } from '@/lib/contrast'

interface EventTypeBadgeProps {
  type: string
  size?: 'sm' | 'md'
  /** 'dark' sobre la cabecera navy: la letra va blanca y el punto conserva el color. */
  tone?: 'light' | 'dark'
}

/** Badge de tipo de evento. Color y etiqueta salen del catálogo de la BD
 *  (event_types) → tipos custom creados por admins se ven solos, sin tocar código. */
export function EventTypeBadge({ type, size = 'sm', tone = 'light' }: EventTypeBadgeProps) {
  const typeStyle = useEventTypeStyle()
  const { label, color } = typeStyle(type)
  const dotSize = size === 'md' ? 'h-2.5 w-2.5' : 'h-2 w-2'
  const textSize = size === 'md' ? 'text-sm' : 'text-[13px]'

  return (
    // QA-2/M1 · El color del tipo es de IDENTIFICACIÓN (el punto). Como letra,
    // varios no llegan a 4.5 (y los tipos nuevos los elige un admin): la letra
    // se oscurece lo justo sobre blanco, o va blanca sobre la cabecera navy.
    <span className={cn('inline-flex items-center gap-1.5 font-body', textSize)}
      style={{ color: tone === 'dark' ? '#FFFFFF' : textoSobreSuTinte(color, 0) }}>
      <span className={cn('rounded-full shrink-0', dotSize)} style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}
