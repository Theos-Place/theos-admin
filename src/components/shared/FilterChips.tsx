'use client'

import { cn } from '@/lib/utils'

export type FilterChip = { key: string; label: string; count?: number }

/**
 * Fila de chips de filtro de selección única — lenguaje visual unificado
 * (mismo estilo que los chips rápidos de la página de miembros). Reemplaza los
 * filtros ad-hoc (botones con borde, segmented controls) que tenía cada listado.
 */
export function FilterChips({
  chips,
  activeKey,
  onSelect,
  className,
  ariaLabel,
}: {
  chips: FilterChip[]
  activeKey: string
  onSelect: (key: string) => void
  className?: string
  ariaLabel?: string
}) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn('flex items-center gap-1.5 flex-wrap', className)}>
      {chips.map(({ key, label, count }) => (
        <button
          key={key}
          type="button"
          onClick={() => onSelect(key)}
          aria-pressed={activeKey === key}
          className={cn(
            'rounded-full px-3.5 py-1.5 text-sm transition-all duration-150 font-body',
            activeKey === key
              ? 'bg-navy text-white'
              : 'bg-surface-low text-navy-light/80 hover:bg-surface-card hover:text-navy',
          )}
        >
          {count !== undefined ? `${label} · ${count.toLocaleString('es-CR')}` : label}
        </button>
      ))}
    </div>
  )
}
