'use client'

import { useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TimePickerProps {
  /** Valor en formato HH:mm (o ''). */
  value: string
  onChange: (v: string) => void
  error?: boolean
  /** Hora mínima seleccionable (HH:mm) — opcional. */
  min?: string
  /** Paso en minutos. Default 15. */
  step?: number
  placeholder?: string
  /** AUD-1 · Nombre accesible del disparador. Hace falta porque el control es un
   *  <button>, no un <input>: un <label> de al lado no lo alcanza ni con htmlFor.
   *  Pasale el mismo texto del label visible. */
  ariaLabel?: string
}

function buildTimes(step: number): string[] {
  const out: string[] = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += step) {
      out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return out
}

/** "19:00" → "7:00 p.m." */
function label12(t: string): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h < 12 ? 'a.m.' : 'p.m.'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

export function TimePicker({ value, onChange, error, min, step = 15, placeholder = 'Hora', ariaLabel }: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const times = buildTimes(step)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey) }
  }, [open])

  // Centra el valor seleccionado al abrir.
  useEffect(() => {
    if (open && listRef.current) {
      const sel = listRef.current.querySelector('[data-selected="true"]') as HTMLElement | null
      if (sel) sel.scrollIntoView({ block: 'center' })
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'w-full flex items-center justify-between gap-2 rounded-xl bg-surface-low px-3 py-2 text-sm text-left outline-none transition-all font-body',
          'focus:ring-1 focus:ring-coral/30',
          error ? 'ring-1 ring-coral border-coral' : 'border border-transparent',
          value ? 'text-navy' : 'text-navy-light/80',
        )}
      >
        <span className="truncate">{value ? label12(value) : placeholder}</span>
        <Clock size={15} className="shrink-0 text-navy-light/80" />
      </button>

      {open && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-2xl bg-surface-card p-1.5 shadow-[var(--shadow-lg)] border border-[var(--outline-variant)]"
        >
          {times.map(t => {
            const disabled = !!min && t < min
            const isSel = t === value
            return (
              <button
                key={t}
                type="button"
                data-selected={isSel}
                disabled={disabled}
                onClick={() => { onChange(t); setOpen(false) }}
                className={cn(
                  'w-full rounded-lg px-3 py-1.5 text-sm text-left transition-colors font-body',
                  isSel ? 'bg-coral text-white' : 'text-navy hover:bg-surface-low',
                  disabled && 'opacity-30 cursor-not-allowed hover:bg-transparent',
                )}
              >
                {label12(t)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
