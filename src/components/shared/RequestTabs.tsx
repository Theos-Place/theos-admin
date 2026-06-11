'use client'

import { cn } from '@/lib/utils'

/**
 * Tabs clásicos para las páginas de solicitudes (estudios, finanzas):
 * fila con borde inferior, tab activo con border-bottom coral de 2px y texto
 * navy semibold, conteo entre paréntesis, scroll horizontal en mobile.
 */
export type RequestTab = { key: string; label: string }

export function RequestTabs({
  tabs, active, counts, onChange,
}: {
  tabs: RequestTab[]
  active: string
  /** Conteo por key (ej. solicitudes abiertas/en revisión del tipo). */
  counts?: Record<string, number>
  onChange: (key: string) => void
}) {
  return (
    <div
      role="tablist"
      className="flex border-b border-outline overflow-x-auto whitespace-nowrap scroll-smooth [-webkit-overflow-scrolling:touch]"
    >
      {tabs.map(t => {
        const isActive = active === t.key
        const count = counts?.[t.key] ?? 0
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.key)}
            className={cn(
              'shrink-0 px-4 py-2.5 text-sm font-body border-b-2 -mb-px transition-colors',
              isActive
                ? 'border-coral text-navy font-semibold'
                : 'border-transparent text-navy-light/50 hover:text-navy',
            )}
          >
            {t.label}
            {count > 0 && <span className={cn('ml-1', isActive ? 'text-coral' : '')}> ({count})</span>}
          </button>
        )
      })}
    </div>
  )
}
