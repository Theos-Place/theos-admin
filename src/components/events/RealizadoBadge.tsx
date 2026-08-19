'use client'

import { cn } from '@/lib/utils'

/** Estado DERIVADO "Realizado": el evento ya pasó (ends_at < ahora).
 *  No existe en la BD — se calcula con `isPastEvent()` y no muta nada. */
export function RealizadoBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md font-medium font-display bg-navy/10 text-navy/80',
        size === 'md' ? 'text-xs px-2.5 py-1' : 'text-[11px] px-2 py-0.5'
      )}
    >
      Realizado
    </span>
  )
}
