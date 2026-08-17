'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DayPicker } from 'react-day-picker'
import { es } from 'react-day-picker/locale'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toYmdLocal } from '@/lib/format'
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

function labelOf(d: Date | undefined): string {
  if (!d) return ''
  return `${d.getDate()} de ${MESES[d.getMonth()]} ${d.getFullYear()}`
}

export function DatePicker({ value, onChange, min, error, placeholder = 'Seleccionar fecha' }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null)
  const selected = ymdToDate(value)
  const minDate = ymdToDate(min ?? '')

  // Posiciona el popover (fixed, vía portal) bajo el botón — visible aunque el
  // contenedor del filtro tenga overflow.
  function openPicker() {
    const r = ref.current?.getBoundingClientRect()
    if (r) setRect({ top: r.bottom + 4, left: r.left })
    setOpen(o => !o)
  }

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      const t = e.target as Node
      if (ref.current?.contains(t) || popRef.current?.contains(t)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    function reposition() {
      const r = ref.current?.getBoundingClientRect()
      if (r) setRect({ top: r.bottom + 4, left: r.left })
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={openPicker}
        className={cn(
          'w-full flex items-center justify-between gap-2 rounded-xl bg-surface-low px-3 py-2 text-sm text-left outline-none transition-all font-body',
          'focus:ring-1 focus:ring-coral/30',
          error ? 'ring-1 ring-coral border-coral' : 'border border-transparent',
          selected ? 'text-navy' : 'text-navy-light/50',
        )}
      >
        <span className="truncate">{selected ? labelOf(selected) : placeholder}</span>
        <Calendar size={15} className="shrink-0 text-navy-light/70" />
      </button>

      {open && rect && createPortal(
        <div
          ref={popRef}
          className="theos-daypicker fixed z-[100] rounded-2xl bg-surface-card p-3 shadow-[var(--shadow-lg)] border border-[var(--outline-variant)]"
          style={{ top: rect.top, left: rect.left }}
        >
          <DayPicker
            mode="single"
            locale={es}
            selected={selected}
            defaultMonth={selected}
            disabled={minDate ? { before: minDate } : undefined}
            onSelect={(d) => { if (d) { onChange(toYmdLocal(d)); setOpen(false) } }}
          />
        </div>,
        document.body,
      )}
    </div>
  )
}
