'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
  /** Fecha máxima seleccionable (YYYY-MM-DD). */
  max?: string
  error?: boolean
  placeholder?: string
  /** Para que un <label htmlFor> lo alcance (el botón lleva el id). */
  id?: string
  disabled?: boolean
  /** Solo informativo (data-required): el control no valida; la pantalla sí. */
  required?: boolean
  /** Clases extra del botón (las de layout de la pantalla: ancho, alto). */
  className?: string
  style?: React.CSSProperties
  /** AUD-1 · Nombre accesible del disparador. Hace falta porque el control es un
   *  <button>, no un <input>: un <label> de al lado no lo alcanza ni con htmlFor.
   *  Pasale el mismo texto del label visible. */
  ariaLabel?: string
}


/** YYYY-MM-DD → Date local (sin corrimiento de zona horaria). */
function ymdToDate(s: string): Date | undefined {
  if (!s) return undefined
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}

/** Lo que muestra el botón: dd/mm/aaaa (formato tico, 2026-10-26). */
function labelOf(d: Date | undefined): string {
  if (!d) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

/**
 * Rango de los menús de mes y año. Sin menús, llegar a un año de nacimiento es
 * retroceder mes por mes: en la charla de Meridiano (2026-10-27) siete
 * personas nuevas quedaron sin fecha de nacimiento porque «el sistema no
 * permitía agregarla». Con `min`/`max` el rango es ese; si no, 1900 a hoy+10.
 */
export function rangoDeMeses(min: Date | undefined, max: Date | undefined, hoy: Date = new Date()): { startMonth: Date; endMonth: Date } {
  return {
    startMonth: min ?? new Date(1900, 0, 1),
    endMonth: max ?? new Date(hoy.getFullYear() + 10, 11, 31),
  }
}

/** Altura típica del calendario (un mes de 6 filas con padding), para el primer render. */
const ALTO_TIPICO = 340
const ANCHO_TIPICO = 300
const MARGEN = 4

/**
 * Dónde va el popover: debajo del botón si cabe en el viewport; si no, encima;
 * y nunca más a la derecha de lo que la ventana permite.
 */
export function posicionDelPopover(
  boton: { top: number; bottom: number; left: number },
  altoReal: number | undefined,
  viewport: { width: number; height: number } = { width: window.innerWidth, height: window.innerHeight },
): { top: number; left: number } {
  const alto = altoReal && altoReal > 0 ? altoReal : ALTO_TIPICO
  const cabeAbajo = boton.bottom + MARGEN + alto <= viewport.height
  const cabeArriba = boton.top - MARGEN - alto >= 0
  const top = cabeAbajo || !cabeArriba ? boton.bottom + MARGEN : boton.top - MARGEN - alto
  const left = Math.max(8, Math.min(boton.left, viewport.width - ANCHO_TIPICO - 8))
  return { top, left }
}

export function DatePicker({ value, onChange, min, max, error, placeholder = 'dd/mm/aaaa', ariaLabel, id, disabled, required, className, style }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null)
  const selected = ymdToDate(value)
  const minDate = ymdToDate(min ?? '')
  const maxDate = ymdToDate(max ?? '')
  const { startMonth, endMonth } = rangoDeMeses(minDate, maxDate)

  // Posiciona el popover (fixed, vía portal) bajo el botón — visible aunque el
  // contenedor del filtro tenga overflow.
  //
  // Y si abajo no cabe, ARRIBA. Es `fixed`, así que lo que sobresale del
  // viewport no se ve ni haciendo scroll: en «Termina el» del evento
  // recurrente (al pie del paso 2) el calendario mostraba el mes y los días
  // de la semana y nada más (video de Floriana, 2026-10-22). La altura real
  // se mide después del primer render; hasta entonces se usa la típica.
  function openPicker() {
    const r = ref.current?.getBoundingClientRect()
    if (r) setRect(posicionDelPopover(r, popRef.current?.offsetHeight))
    setOpen(o => !o)
  }
  useLayoutEffect(() => {
    if (!open) return
    const r = ref.current?.getBoundingClientRect()
    if (r) setRect(posicionDelPopover(r, popRef.current?.offsetHeight))
  }, [open])

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
      if (r) setRect(posicionDelPopover(r, popRef.current?.offsetHeight))
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
        id={id}
        onClick={openPicker}
        disabled={disabled}
        aria-label={ariaLabel}
        data-required={required || undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={style}
        className={cn(
          'w-full flex items-center justify-between gap-2 rounded-xl bg-surface-low px-3 py-2 text-sm text-left outline-none transition-all font-body',
          'focus:ring-1 focus:ring-coral/30',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error ? 'ring-1 ring-coral border-coral' : 'border border-transparent',
          selected ? 'text-navy' : 'text-navy-light/80',
          className,
        )}
      >
        <span className="truncate">{selected ? labelOf(selected) : placeholder}</span>
        <Calendar size={15} className="shrink-0 text-navy-light/80" />
      </button>

      {open && rect && createPortal(
        <div
          ref={popRef}
          // z-[1200] y no z-[100]: el Modal compartido va en z-[1000] (z-[1100] si
          // está encima de otro modal), así que
          // dentro de un modal —«Persona nueva» del check-in, por ejemplo— el
          // calendario se abría DETRÁS del modal y no se veía. Fue lo que pasó en
          // Meridiano (27-oct) y en Pedregal (28-oct): 27 fichas nuevas sin fecha
          // de nacimiento porque «el sistema no dejaba ponerla». Los menús de mes
          // y año del 28-oct no lo arreglaban: el problema era que no se veía.
          className="theos-daypicker fixed z-[1200] rounded-2xl bg-surface-card p-3 shadow-[var(--shadow-lg)] border border-[var(--outline-variant)]"
          style={{ top: rect.top, left: rect.left }}
        >
          <DayPicker
            mode="single"
            locale={es}
            selected={selected}
            defaultMonth={selected}
            captionLayout="dropdown"
            startMonth={startMonth}
            endMonth={endMonth}
            disabled={[...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])]}
            onSelect={(d) => { if (d) { onChange(toYmdLocal(d)); setOpen(false) } }}
          />
          {/* El <input type="date"> nativo se vaciaba con la tecla de borrar; el
              selector propio (26-oct-2026) no tenía cómo, y una fecha opcional
              puesta por error —bautizo, «pausa hasta», un filtro— ya no se
              podía quitar. */}
          {selected && !required && (
            <div className="flex justify-end border-t border-[var(--outline-variant)] pt-2 mt-1">
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false) }}
                className="rounded-lg px-3 py-1.5 text-[13px] text-coral-deep hover:bg-coral/10 font-body"
              >
                Borrar fecha
              </button>
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
