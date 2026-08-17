import { Fragment } from 'react'
import { cn } from '@/lib/utils'

const STEPS = [
  { num: 1, label: 'Información' },
  { num: 2, label: 'Programación' },
  { num: 3, label: 'Sub-eventos' },
  { num: 4, label: 'Financiero' },
]

interface StepSidebarProps {
  step: number
  onStepClick: (num: number) => void
}

export function StepSidebar({ step, onStepClick }: StepSidebarProps) {
  return (
    <div className="md:sticky md:top-[76px]">
      <div className="card py-2">
        {STEPS.map((s, idx) => {
          const done   = s.num < step
          const active = s.num === step
          return (
            <Fragment key={s.num}>
              <button
                type="button"
                onClick={() => (done || active) ? onStepClick(s.num) : undefined}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                  active  ? 'bg-surface-low' : '',
                  (done || active) ? 'cursor-pointer' : 'cursor-default opacity-60',
                )}
              >
                <div
                  className={cn(
                    'h-6 w-6 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 transition-colors',
                    active ? 'bg-coral text-white' :
                    done   ? 'bg-teal-deep text-white' :
                    'bg-navy-light/15 text-navy-light/70',
                    'font-display',
                  )}
                >
                  {done ? '✓' : s.num}
                </div>
                <span
                  className={cn(
                    'text-[13px] font-medium transition-colors',
                    active ? 'text-navy' : done ? 'text-teal-deep' : 'text-navy-light/70',
                    'font-display',
                  )}
                >
                  {s.label}
                </span>
              </button>
              {idx < STEPS.length - 1 && (
                <div className="mx-4 h-px bg-[var(--outline-variant)]" />
              )}
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
