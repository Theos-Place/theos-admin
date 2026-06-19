import { cn } from '@/lib/utils'

/** Contenedor de gráfico reutilizable: título + subtítulo + área de gráfico con
 *  alto fijo. Maneja estado vacío. Compartido por todos los reportes. */
export function ChartCard({
  title, subtitle, empty, height = 300, className, footnote, children,
}: {
  title: string
  subtitle?: string
  empty?: boolean
  height?: number
  className?: string
  /** Nota al pie (p. ej. método de cálculo o aclaración de un dato). */
  footnote?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className={cn('rounded-2xl bg-surface-card p-4 sm:p-5 shadow-[var(--shadow-md)]', className)}>
      <div className="mb-3">
        <h3 className="text-sm font-bold text-navy font-display">{title}</h3>
        {subtitle && <p className="text-[12px] text-navy-light/60 font-body mt-0.5">{subtitle}</p>}
      </div>
      {empty ? (
        <div className="flex items-center justify-center text-[13px] text-navy-light/50 font-body" style={{ height }}>
          Sin datos para este filtro
        </div>
      ) : (
        <div style={{ width: '100%', height }}>{children}</div>
      )}
      {!empty && footnote && (
        <p className="mt-2.5 text-[11px] text-navy-light/60 font-body leading-snug">{footnote}</p>
      )}
    </div>
  )
}
