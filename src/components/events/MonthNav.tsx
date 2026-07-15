'use client'

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

interface MonthNavProps {
  month: number
  year: number
  onPrev: () => void
  onNext: () => void
  onPrevYear: () => void
  onNextYear: () => void
  onToday: () => void
  onSetMonth: (month: number) => void
  onSetYear: (year: number) => void
}

/** Navegación de mes/año compartida por calendario, lista y cuadrícula de
 *  eventos — mismo control, misma UX en las 3 vistas. */
export function MonthNav({ month, year, onPrev, onNext, onPrevYear, onNextYear, onToday, onSetMonth, onSetYear }: MonthNavProps) {
  const today = new Date()
  const yearOptions: number[] = []
  for (let y = Math.min(2020, year); y <= Math.max(today.getFullYear() + 1, year); y++) yearOptions.push(y)

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-surface-card px-3 sm:px-5 py-3 shadow-[var(--shadow-md)]">
      <div className="flex items-center gap-0.5 sm:gap-1">
        <button onClick={onPrevYear} aria-label="Año anterior" className="h-8 w-7 flex items-center justify-center rounded-xl hover:bg-surface-low text-navy-light/60 hover:text-navy transition-colors font-display">«</button>
        <button onClick={onPrev} aria-label="Mes anterior" className="h-8 w-7 flex items-center justify-center rounded-xl hover:bg-surface-low text-navy-light/60 hover:text-navy transition-colors font-display">‹</button>
        <select
          value={month}
          onChange={e => onSetMonth(Number(e.target.value))}
          aria-label="Mes"
          className="rounded-lg bg-surface-low px-2 py-1.5 text-sm font-medium text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
        >
          {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select
          value={year}
          onChange={e => onSetYear(Number(e.target.value))}
          aria-label="Año"
          className="rounded-lg bg-surface-low px-2 py-1.5 text-sm font-medium text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body tabular-nums"
        >
          {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={onNext} aria-label="Mes siguiente" className="h-8 w-7 flex items-center justify-center rounded-xl hover:bg-surface-low text-navy-light/60 hover:text-navy transition-colors font-display">›</button>
        <button onClick={onNextYear} aria-label="Año siguiente" className="h-8 w-7 flex items-center justify-center rounded-xl hover:bg-surface-low text-navy-light/60 hover:text-navy transition-colors font-display">»</button>
      </div>
      <button
        onClick={onToday}
        className="rounded-full border border-[var(--outline-variant)] px-3.5 py-1.5 text-[12px] font-medium text-navy-light hover:bg-coral/5 hover:text-coral hover:border-coral/30 transition-colors font-body"
      >
        Hoy
      </button>
    </div>
  )
}
