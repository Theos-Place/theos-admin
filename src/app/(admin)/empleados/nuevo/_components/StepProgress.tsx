import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StepDef {
  num: number
  label: string
}

interface StepProgressProps {
  steps: StepDef[]
  currentStep: number
}

export function StepProgress({ steps, currentStep }: StepProgressProps) {
  return (
    <div
      className="hidden lg:flex items-center rounded-2xl px-6 py-4 bg-surface-card shadow-[var(--shadow-md)]"
    >
      {steps.map((s, i) => (
        <div key={s.num} className="flex items-center flex-1 last:flex-none">
          <div className="flex items-center gap-2.5 shrink-0">
            <div
              className={cn(
                'h-7 w-7 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors font-display',
                currentStep > s.num
                  ? 'bg-teal-deep text-white'
                  : currentStep === s.num
                  ? 'bg-coral text-white'
                  : 'bg-navy/10 text-navy-light/40'
              )}
            >
              {currentStep > s.num ? <Check size={13} /> : s.num}
            </div>
            <span
              className={cn(
                'text-[12px] font-medium whitespace-nowrap font-display',
                currentStep === s.num
                  ? 'text-navy'
                  : currentStep > s.num
                  ? 'text-teal-deep'
                  : 'text-navy-light/40'
              )}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className="flex-1 h-px mx-4 bg-[var(--outline-variant)]" />
          )}
        </div>
      ))}
    </div>
  )
}
