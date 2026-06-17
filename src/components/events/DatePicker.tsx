'use client'

import { useEffect, useRef, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { es } from 'react-day-picker/locale'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import 'react-day-picker/style.css'

interface DatePickerProps {
  /** Valor en formato YYYY-MM-DD (o ''). */
  value: string
  onChange: (v: string) => void
  /** Fecha mínima seleccionable (YYYY-MM-DD). */
  min?: string
  error?: boolean
  placeholder?: string
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** YYYY-MM-DD → Date local (sin corrimiento de zona horaria). */
function ymdToDate(s: string): Date | undefined {
  if (!s) return undefined
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}

function dateToYmd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function labelOf(d: Date | undefined): string {
  if (!d) return ''
  return `${d.getDate()} de ${MESES[d.getMonth()]} ${d.getFullYear()}`
}

export function DatePicker({ value, onChange, min, error, placeholder = 'Seleccionar fecha' }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = ymdToDate(value)
  const minDate = ymdToDate(min ?? '')

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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center justify-between gap-2 rounded-xl bg-surface-low px-3 py-2 text-sm text-left outline-none transition-all font-body',
          'focus:ring-1 focus:ring-coral/30',
          error ? 'ring-1 ring-coral border-coral' : 'border border-transparent',
          selected ? 'text-navy' : 'text-navy-light/50',
        )}
      >
        <span className="truncate">{selected ? labelOf(selected) : placeholder}</span>
        <Calendar size={15} className="shrink-0 text-navy-light/60" />
      </button>

      {open && (
        <div className="theos-daypicker absolute z-50 mt-1 rounded-2xl bg-surface-card p-3 shadow-[var(--shadow-lg)] border border-[var(--outline-variant)]">
          <DayPicker
            mode="single"
            locale={es}
            selected={selected}
            defaultMonth={selected}
            disabled={minDate ? { before: minDate } : undefined}
            onSelect={(d) => { if (d) { onChange(dateToYmd(d)); setOpen(false) } }}
          />
        </div>
      )}
    </div>
  )
}
