'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SalaryBadgeProps {
  /** null = monto restringido (solo finanzas lo recibe): se muestra oculto sin botón. */
  amount: number | null
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function SalaryBadge({ amount, className, size = 'md' }: SalaryBadgeProps) {
  const [visible, setVisible] = useState(false)

  const restricted = amount == null
  const formatted = restricted ? '₡ ••••••' : `₡${amount.toLocaleString('es-CR')}`
  const hidden = '₡ ••••••'

  const textSize = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-[12px]' : 'text-sm'
  const iconSize = size === 'lg' ? 16 : 13

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span
        className={cn(textSize, 'font-semibold tabular-nums font-mono', visible && !restricted ? 'text-navy' : 'text-navy-light/40')}
      >
        {visible && !restricted ? formatted : hidden}
      </span>
      {!restricted && (
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          className="text-navy-light/60 hover:text-navy transition-colors"
          aria-label={visible ? 'Ocultar salario' : 'Mostrar salario'}
          title={visible ? 'Ocultar salario' : 'Mostrar salario'}
        >
          {visible
            ? <EyeOff size={iconSize} />
            : <Eye size={iconSize} />
          }
        </button>
      )}
    </div>
  )
}
