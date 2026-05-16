'use client'

import { cn } from '@/lib/utils'

const NIVELES = ['N1', 'N2', 'N3', 'N4']
const INICIAL = ['SCJ', 'ASF', 'EVM', 'AED', 'MAT']
const CAMPANA = ['TRANS', 'UFA', 'PQET', 'TPS23']

interface StudyTypeBadgeProps {
  code: string
  name?: string
  size?: 'sm' | 'md'
  className?: string
}

export function StudyTypeBadge({ code, name, size = 'md', className }: StudyTypeBadgeProps) {
  const isNiveles = NIVELES.includes(code)
  const isInicial = INICIAL.includes(code)
  const isCampana = CAMPANA.includes(code)

  const colorClass = isNiveles
    ? 'bg-navy/10 text-navy'
    : isInicial
    ? 'bg-teal-soft/30 text-teal-deep'
    : isCampana
    ? 'bg-purple-100 text-purple-700'
    : 'bg-coral/10 text-coral'

  const sizeClass = size === 'sm'
    ? 'px-1.5 py-0.5 text-[10px]'
    : 'px-2 py-0.5 text-[11px]'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md font-semibold tracking-wide',
        colorClass,
        sizeClass,
        className
      )}
      style={{ fontFamily: 'var(--font-display)' }}
    >
      {code}
      {name && (
        <span className="font-normal opacity-70">
          {name}
        </span>
      )}
    </span>
  )
}
