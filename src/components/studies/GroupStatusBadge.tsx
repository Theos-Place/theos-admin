'use client'

import { cn } from '@/lib/utils'
import type { GroupStatus } from '@/types/study'

const STATUS_CONFIG: Record<GroupStatus, { label: string; className: string }> = {
  en_matricula: { label: 'En matrícula', className: 'bg-teal-soft/30 text-teal-deep' },
  en_curso:     { label: 'En curso',     className: 'bg-navy/10 text-navy' },
  finalizado:   { label: 'Finalizado',   className: 'bg-surface-low text-navy-light/70' },
}

/** Chip: el grupo es una capacitación de dirigentes (is_leader_training = true). */
export function LeaderTrainingBadge({ modality, className }: { modality?: string | null; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-[12px] font-medium font-display bg-coral/10 text-coral-deep', className)}>
      Capacitación de dirigentes{modality ? ` · ${modality}` : ''}
    </span>
  )
}

/** Chip: el grupo es virtual (is_virtual = true). */
export function VirtualGroupBadge({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-[12px] font-medium font-display bg-teal-soft/40 text-teal-deep', className)}>
      Virtual
    </span>
  )
}

/** Chip derivado: el grupo no tiene dirigente asignado (leader_id IS NULL).
 *  No es un estado guardado — desaparece al asignar dirigente. */
export function NoLeaderBadge({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-[12px] font-medium font-display bg-amber-100 text-amber-700', className)}>
      Sin dirigente
    </span>
  )
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
        'inline-flex items-center rounded-md px-2 py-0.5 text-[12px] font-medium font-display',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}
