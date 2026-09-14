'use client'

import { cn } from '@/lib/utils'
import { ETIQUETA_VISIBLE, BADGE_VISIBLE, type EstadoVisible } from '@/lib/studies/estado-visible'

/** Chip: el grupo es una capacitación de dirigentes (is_leader_training = true). */
export function LeaderTrainingBadge({ modality, className }: { modality?: string | null; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-[13px] font-medium font-display bg-coral/10 text-coral-deep', className)}>
      Capacitación de dirigentes{modality ? ` · ${modality}` : ''}
    </span>
  )
}

/** Chip: el grupo es virtual (is_virtual = true). */
export function VirtualGroupBadge({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-[13px] font-medium font-display bg-teal-soft/40 text-teal-deep', className)}>
      Virtual
    </span>
  )
}

/** Chip derivado: el grupo no tiene dirigente asignado (leader_id IS NULL).
 *  No es un estado guardado — desaparece al asignar dirigente. */
export function NoLeaderBadge({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-[13px] font-medium font-display bg-amber-100 text-amber-700', className)}>
      Sin dirigente
    </span>
  )
}

interface GroupStatusBadgeProps {
  /** Acepta el estado VISIBLE, que tiene un escalón más que el guardado:
   *  "Por iniciar" es un grupo cuya matrícula cerró y que todavía no arranca.
   *  Se calcula con estadoVisible(); ver lib/studies/estado-visible.ts. */
  status: EstadoVisible
  className?: string
}

export function GroupStatusBadge({ status, className }: GroupStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-[13px] font-medium font-display',
        BADGE_VISIBLE[status],
        className
      )}
    >
      {ETIQUETA_VISIBLE[status]}
    </span>
  )
}
