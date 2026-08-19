'use client'

import { cn } from '@/lib/utils'

interface BarItem {
  label: string
  count: number
  total: number
}

interface ResponseSummaryChartProps {
  title: string
  items: BarItem[]
  average?: number
  type?: 'bar' | 'yes_no'
}

export function ResponseSummaryChart({ title, items, average, type = 'bar' }: ResponseSummaryChartProps) {
  const max = Math.max(...items.map(i => i.count), 1)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-navy font-display">
          {title}
        </p>
        {average !== undefined && (
          <span className="text-[13px] text-teal-deep font-semibold font-mono">
            Promedio: {average.toFixed(1)} ★
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {items.map(item => {
          const pct = item.total > 0 ? Math.round((item.count / item.total) * 100) : 0
          const barWidth = item.total > 0 ? (item.count / max) * 100 : 0
          return (
            <div key={item.label} className="flex items-center gap-2">
              <span
                className="text-[13px] text-navy-light/80 w-24 shrink-0 truncate font-body"
              >
                {item.label}
              </span>
              <div className="flex-1 h-5 rounded-full overflow-hidden bg-surface-low">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    type === 'yes_no' && item.label === 'No' ? 'bg-coral/60' : 'bg-teal-deep/70'
                  )}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span className="text-[13px] text-navy-light/80 w-20 text-right shrink-0 font-mono">
                {item.count} ({pct}%)
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
