'use client'

/**
 * Footer de paginación reutilizable: contador "Mostrando X de Y" + botón
 * "Cargar más" acumulativo. Lo comparten los listados server-side (miembros,
 * grupos, pagos…) y los client-side paginados (dirigentes, plantillas…).
 *
 * No se renderiza si no hay nada cargado (shown === 0).
 */
export function LoadMoreFooter({
  shown,
  total,
  hasMore,
  loading,
  onLoadMore,
  noun = 'resultados',
  increment,
}: {
  shown: number
  total: number
  hasMore: boolean
  loading: boolean
  onLoadMore: () => void
  /** Sustantivo del contador, ej. "grupos", "pagos". */
  noun?: string
  /** Cantidad por página, para la etiqueta del botón ("Cargar 25 más"). */
  increment?: number
}) {
  if (shown === 0) return null
  const fmt = (n: number) => n.toLocaleString('es-CR')
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap border-t border-[var(--outline-variant)]">
      <span className="text-xs text-navy-light/80 font-body">
        Mostrando <strong className="text-navy">{fmt(shown)}</strong> de{' '}
        <strong className="text-navy">{fmt(total)}</strong> {noun}
      </span>
      {hasMore && (
        <button
          onClick={onLoadMore}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--outline-variant)] px-3 py-1.5 text-xs text-navy-light hover:bg-surface-low transition-colors disabled:opacity-50 font-body"
        >
          {loading ? 'Cargando…' : increment ? `Cargar ${increment} más` : 'Cargar más'}
        </button>
      )}
    </div>
  )
}
