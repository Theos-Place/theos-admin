'use client'

import { cn } from '@/lib/utils'

interface TimelineItem {
  date: string
  type: 'salary' | 'position' | 'vacation' | 'start'
  label: string
  sub: string | undefined
  icon: React.ElementType
  color: string
}

interface TabHistorialProps {
  timeline: TimelineItem[]
}

export function TabHistorial({ timeline }: TabHistorialProps) {
  return (
    <div className="space-y-1">
      {timeline.map((item, i) => {
        const Icon = item.icon
        return (
          <div key={i} className="flex gap-3 pb-4 relative">
            {i < timeline.length - 1 && (
              <div className="absolute left-3.5 top-7 bottom-0 w-px bg-[var(--outline-variant)]" />
            )}
            <div className={cn('h-7 w-7 rounded-full flex items-center justify-center shrink-0 z-10', item.color)}>
              <Icon size={13} />
            </div>
            <div className="pt-0.5">
              <p className="text-[13px] font-medium text-navy font-body">
                {item.label}
              </p>
              {item.sub && (
                <p className="text-[11px] text-navy-light/50 font-body">{item.sub}</p>
              )}
              <p className="text-[10px] text-navy-light/30 mt-0.5 font-mono">
                {new Date(item.date + 'T00:00:00').toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
