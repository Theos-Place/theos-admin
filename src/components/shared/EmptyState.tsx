import type { LucideIcon } from 'lucide-react'
import { Inbox, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type EmptyStateProps = {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  /**
   * QA-2/N2 (2026-10-15) · Si el vacío lo causa un filtro, cómo salir de él.
   * «No hay … con ese filtro» sin un botón obligaba a adivinar cuál filtro
   * dejó la lista vacía. Se pasa SOLO cuando hay algún filtro activo; si no,
   * el botón no aparece.
   */
  onLimpiarFiltros?: () => void
  className?: string
}

/** Estado vacío estándar del sistema (listas sin resultados). */
export function EmptyState({ icon: Icon = Inbox, title, description, action, onLimpiarFiltros, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center px-4 py-14', className)}>
      <Icon size={28} strokeWidth={1.75} className="text-navy-light/80 mb-3" />
      <p className="text-sm font-semibold text-navy-light/80 font-body">{title}</p>
      {description && <p className="text-[13px] text-navy-light/80 mt-1 font-body max-w-sm">{description}</p>}
      {(action || onLimpiarFiltros) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {onLimpiarFiltros && (
            <button
              type="button"
              onClick={onLimpiarFiltros}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--outline-variant)] bg-surface-card px-4 py-2 text-sm font-medium text-navy hover:bg-surface-low transition-colors font-body"
            >
              <X size={14} aria-hidden="true" /> Limpiar filtros
            </button>
          )}
          {action}
        </div>
      )}
    </div>
  )
}
