'use client'

import { cn } from '@/lib/utils'
import type { GroupStatus } from '@/data/mock-studies'

const STATUS_CONFIG: Record<GroupStatus, { label: string; className: string }> = {
  pending_leader:   { label: 'Sin dirigente',       className: 'bg-amber-100 text-amber-700' },
  pending_opening:  { label: 'Pendiente apertura',  className: 'bg-blue-100 text-blue-700' },
  open:             { label: 'Abierto',              className: 'bg-teal-soft/30 text-teal-deep' },
  in_progress:      { label: 'En curso',             className: 'bg-navy/10 text-navy' },
  finished:         { label: 'Finalizado',           className: 'bg-surface-low text-navy-light/50' },
}

interface GroupStatusBadgeProps {
  status: GroupStatus
  className?: string
}

export function GroupStatusBadge({ status, className }: GroupStatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium font-display',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}
