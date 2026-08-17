import { cn } from '@/lib/utils'
import type { SalaryChange } from '@/types/employee'
import { formatCRC } from '@/lib/format'

interface SalaryTimelineProps {
  history: SalaryChange[]
  /** null = monto restringido (solo rol finanzas lo recibe del API). */
  initialSalary: number | null
  startDate: string
}

export function SalaryTimeline({ history, initialSalary, startDate }: SalaryTimelineProps) {
  // Con montos restringidos (null) las filas se muestran sin cifras.
  const restricted = initialSalary == null || history.some(h => h.new_salary == null || h.previous_salary == null)
  // Build full timeline: most recent first
  const items = [
    ...history.map(h => ({
      date: h.date,
      salary: h.new_salary,
      prevSalary: h.previous_salary,
      reason: h.reason,
      approvedBy: h.approved_by,
      isInitial: false,
    })),
    {
      date: startDate,
      salary: restricted
        ? null
        : initialSalary! - history.reduce((sum, h) => sum + (h.new_salary! - h.previous_salary!), 0),
      prevSalary: null as number | null,
      reason: 'Salario inicial de contratación',
      approvedBy: null as string | null,
      isInitial: true,
    },
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="space-y-0">
      {items.map((item, idx) => {
        const pct = item.prevSalary != null && item.salary != null
          ? ((item.salary - item.prevSalary) / item.prevSalary * 100).toFixed(1)
          : null
        return (
          <div key={idx} className="flex gap-4">
            {/* Line + dot */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'h-3 w-3 rounded-full shrink-0 mt-1.5',
                  item.isInitial ? 'bg-navy-light/30' : 'bg-teal-deep'
                )}
              />
              {idx < items.length - 1 && (
                <div className="flex-1 w-px mt-1 bg-[var(--outline-variant)]" />
              )}
            </div>
            {/* Content */}
            <div className={cn('pb-5', idx === items.length - 1 && 'pb-0')}>
              <p className="text-[12px] text-navy-light/70 mb-0.5 font-mono">
                {new Date(item.date).toLocaleDateString('es-CR', { month: 'short', year: 'numeric' })}
              </p>
              <p className="text-sm font-semibold text-navy font-display">
                {item.salary != null ? `${formatCRC(item.salary)}` : '₡ ••••••'}
                {pct && (
                  <span className="ml-2 text-[12px] font-medium text-teal-deep">
                    +{pct}%
                  </span>
                )}
              </p>
              <p className="text-[12px] text-navy-light/70 mt-0.5 font-body">
                {item.reason}
              </p>
              {item.approvedBy && (
                <p className="text-[12px] text-navy-light/70 mt-0.5 font-body">
                  Aprobado por {item.approvedBy}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
