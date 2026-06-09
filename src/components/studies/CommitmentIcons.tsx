'use client'

import { Heart, Hammer, CalendarCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface CommitmentIconsProps {
  donor: boolean
  server: boolean
  charlas: boolean
  size?: number
}

function TooltipIcon({
  active,
  icon: Icon,
  tooltip,
  size,
}: {
  active: boolean
  icon: React.ElementType
  tooltip: string
  size: number
}) {
  const [show, setShow] = useState(false)

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <Icon
        size={size}
        strokeWidth={1.75}
        className={cn(
          'transition-colors',
          active ? 'text-coral' : 'text-navy-light/25'
        )}
      />
      {show && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded-md px-2 py-1 text-[10px] text-white z-50 shadow-[var(--shadow-md)]"
          style={{ background: 'var(--navy, #1e2a45)' }}
        >
          {tooltip}
        </div>
      )}
    </div>
  )
}

export function CommitmentIcons({ donor, server, charlas, size = 14 }: CommitmentIconsProps) {
  return (
    <div className="flex items-center gap-2">
      <TooltipIcon active={donor}   icon={Heart}        tooltip="Donador activo"    size={size} />
      <TooltipIcon active={server}  icon={Hammer}       tooltip="Servidor activo"   size={size} />
      <TooltipIcon active={charlas} icon={CalendarCheck} tooltip="Asiste a charlas" size={size} />
    </div>
  )
}
