import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TopBarProps {
  step: number
  totalSteps: number
  canAdvance: boolean
  onNext: () => void
  onFinish: () => void
}

export function TopBar({ step, totalSteps, canAdvance, onNext, onFinish }: TopBarProps) {
  return (
    <div
      className="sticky top-0 z-10 rounded-2xl px-5 py-3 flex items-center justify-between gap-3 bg-surface-card shadow-[var(--shadow-md)]"
    >
      <div className="flex items-center gap-3">
        <Link
          href="/empleados"
          className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors font-body"
        >
          <ChevronLeft size={16} />
          Empleados
        </Link>
        <span className="text-navy-light/20">|</span>
        <span className="text-sm font-semibold text-navy font-display">
          Contratar empleado
        </span>
        <span
          className="rounded-full bg-navy/10 px-2.5 py-0.5 text-[11px] font-semibold text-navy-light/50 lg:hidden font-display"
        >
          {step}/{totalSteps}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/empleados"
          className="rounded-full border border-[var(--outline-variant)] px-3.5 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors font-body"
        >
          Cancelar
        </Link>
        {step < totalSteps ? (
          <button
            type="button"
            onClick={onNext}
            disabled={!canAdvance}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-[12px] text-white transition-colors font-body',
              canAdvance ? 'bg-coral hover:bg-coral-deep' : 'bg-navy-light/20 cursor-not-allowed'
            )}
          >
            Siguiente →
          </button>
        ) : (
          <button
            type="button"
            onClick={onFinish}
            disabled={!canAdvance}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-[12px] text-white transition-colors font-body',
              canAdvance ? 'bg-coral hover:bg-coral-deep' : 'bg-navy-light/20 cursor-not-allowed'
            )}
          >
            Formalizar contrato
          </button>
        )}
      </div>
    </div>
  )
}
