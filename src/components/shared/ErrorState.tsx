import { AlertCircle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

type ErrorStateProps = {
  title?: string
  message?: string
  onRetry?: () => void
  className?: string
}

/** Estado de error estándar del sistema (fallas al cargar datos). */
export function ErrorState({ title = 'No se pudieron cargar los datos', message, onRetry, className }: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center px-4 py-14', className)}>
      <AlertCircle size={28} strokeWidth={1.75} className="text-coral mb-3" />
      <p className="text-sm font-semibold text-navy font-body">{title}</p>
      {message && <p className="text-[13px] text-navy-light/70 mt-1 font-body max-w-sm">{message}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--outline-variant)] px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
        >
          <RefreshCw size={14} />
          Reintentar
        </button>
      )}
    </div>
  )
}
