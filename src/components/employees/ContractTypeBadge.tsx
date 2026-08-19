import { cn } from '@/lib/utils'
import type { ContractType } from '@/types/employee'

interface ContractTypeBadgeProps {
  type: ContractType
  size?: 'sm' | 'md'
}

export function ContractTypeBadge({ type, size = 'md' }: ContractTypeBadgeProps) {
  const textSize = size === 'sm' ? 'text-[11px]' : 'text-[13px]'
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 font-semibold font-display',
        textSize,
        type === 'planilla'
          ? 'bg-navy/10 text-navy'
          : 'bg-teal-deep/10 text-teal-deep'
      )}
    >
      {type === 'planilla' ? 'Planilla' : 'Servicios prof.'}
    </span>
  )
}
