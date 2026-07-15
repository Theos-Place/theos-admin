'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { DatePicker } from '@/components/events/DatePicker'

interface RecurrenceSelectorProps {
  value: string | null
  onChange: (v: string | null) => void
  /** Fecha de inicio del evento (YYYY-MM-DD) para sugerir día/posición mensual. */
  startDate?: string
  /** Último día (YYYY-MM-DD) en que la serie genera ocurrencias — '' = sin fin. */
  endDate?: string
  onEndDateChange?: (v: string) => void
}

const DAYS = [
  { key: 'MON', label: 'L', code: 'MO' },
  { key: 'TUE', label: 'M', code: 'TU' },
  { key: 'WED', label: 'X', code: 'WE' },
  { key: 'THU', label: 'J', code: 'TH' },
  { key: 'FRI', label: 'V', code: 'FR' },
  { key: 'SAT', label: 'S', code: 'SA' },
  { key: 'SUN', label: 'D', code: 'SU' },
]
const ORDER = DAYS.map(d => d.key)
// getDay() 0=Dom..6=Sáb → código RRULE de 2 letras
const DOW_CODE = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
const DOW_NAME: Record<string, string> = { SU: 'domingo', MO: 'lunes', TU: 'martes', WE: 'miércoles', TH: 'jueves', FR: 'viernes', SA: 'sábado' }
const POS_NAME: Record<string, string> = { '1': 'primer', '2': 'segundo', '3': 'tercer', '4': 'cuarto', '-1': 'último' }

type MonthMode = 'dom' | 'dow' // día del mes | posición + día de semana

/** A partir de una fecha YYYY-MM-DD, sugiere {día del mes, posición, día semana}. */
function suggestFromDate(startDate?: string): { day: number; pos: string; dow: string } {
  const d = startDate ? new Date(`${startDate}T12:00:00`) : new Date()
  const day = d.getDate()
  const dow = DOW_CODE[d.getDay()]
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  // Si es la última ocurrencia de ese día en el mes → "último".
  const pos = day + 7 > daysInMonth ? '-1' : String(Math.ceil(day / 7))
  return { day, pos, dow }
}

function parseRule(rule: string | null) {
  const r = (rule ?? '').trim()
  // Semanal (formato propio): WEEKLY:MON,WED
  const weekly = r.match(/^WEEKLY:([A-Z,]+)$/i)
  if (weekly) {
    const days = weekly[1].toUpperCase().split(',').map(s => s.trim()).filter(Boolean)
    return { freq: 'WEEKLY' as const, days, monthMode: 'dom' as MonthMode, monthDay: 1, monthPos: '1', monthDow: 'MO' }
  }
  // Mensual estándar: FREQ=MONTHLY;BYMONTHDAY=N  ó  FREQ=MONTHLY;BYDAY=2TU
  if (/FREQ=MONTHLY/i.test(r)) {
    const bmd = r.match(/BYMONTHDAY=(\d+)/i)
    if (bmd) return { freq: 'MONTHLY' as const, days: [] as string[], monthMode: 'dom' as MonthMode, monthDay: Number(bmd[1]), monthPos: '1', monthDow: 'MO' }
    const bdp = r.match(/BYDAY=(-?\d)([A-Z]{2})/i)
    if (bdp) return { freq: 'MONTHLY' as const, days: [] as string[], monthMode: 'dow' as MonthMode, monthDay: 1, monthPos: bdp[1], monthDow: bdp[2].toUpperCase() }
    return { freq: 'MONTHLY' as const, days: [] as string[], monthMode: 'dom' as MonthMode, monthDay: 1, monthPos: '1', monthDow: 'MO' }
  }
  return null
}

export function RecurrenceSelector({ value, onChange, startDate, endDate, onEndDateChange }: RecurrenceSelectorProps) {
  const sug = suggestFromDate(startDate)
  const parsed = parseRule(value)

  const [freq, setFreq] = useState<'WEEKLY' | 'MONTHLY'>(parsed?.freq ?? 'WEEKLY')
  const [days, setDays] = useState<string[]>(parsed?.freq === 'WEEKLY' ? parsed.days : ['SUN'])
  const [monthMode, setMonthMode] = useState<MonthMode>(parsed?.monthMode ?? 'dom')
  const [monthDay, setMonthDay] = useState<number>(parsed?.freq === 'MONTHLY' ? parsed.monthDay : sug.day)
  const [monthPos, setMonthPos] = useState<string>(parsed?.freq === 'MONTHLY' ? parsed.monthPos : sug.pos)
  const [monthDow, setMonthDow] = useState<string>(parsed?.freq === 'MONTHLY' ? parsed.monthDow : sug.dow)

  function build(f: 'WEEKLY' | 'MONTHLY', d: string[], mm: MonthMode, mDay: number, mPos: string, mDow: string): string {
    if (f === 'WEEKLY') {
      const ordered = ORDER.filter(x => d.includes(x))
      return `WEEKLY:${(ordered.length ? ordered : ['SUN']).join(',')}`
    }
    return mm === 'dom' ? `FREQ=MONTHLY;BYMONTHDAY=${mDay}` : `FREQ=MONTHLY;BYDAY=${mPos}${mDow}`
  }

  // Si llega sin regla (value null), fija un default sensato según la fecha.
  useEffect(() => {
    if (value === null) onChange(build(freq, days, monthMode, monthDay, monthPos, monthDow))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function emit(over: Partial<{ freq: 'WEEKLY' | 'MONTHLY'; days: string[]; monthMode: MonthMode; monthDay: number; monthPos: string; monthDow: string }>) {
    onChange(build(
      over.freq ?? freq, over.days ?? days, over.monthMode ?? monthMode,
      over.monthDay ?? monthDay, over.monthPos ?? monthPos, over.monthDow ?? monthDow,
    ))
  }

  function handleFreqChange(f: 'WEEKLY' | 'MONTHLY') {
    setFreq(f)
    emit({ freq: f })
  }

  function toggleDay(d: string) {
    const next = days.includes(d) ? days.filter(x => x !== d) : [...days, d]
    if (next.length === 0) return
    setDays(next)
    emit({ days: next })
  }

  const inputCls = 'rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'

  return (
    <div className="space-y-3">
      {/* Frecuencia */}
      <div className="space-y-1.5">
        <p className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display">Frecuencia</p>
        <div className="flex gap-2">
          {(['WEEKLY', 'MONTHLY'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => handleFreqChange(f)}
              className={cn('rounded-lg px-3 py-1.5 text-[12px] font-medium border transition-all font-display border-outline',
                freq === f ? 'bg-navy text-white border-navy' : 'text-navy-light hover:bg-surface-low')}
            >
              {f === 'WEEKLY' ? 'Semanal' : 'Mensual'}
            </button>
          ))}
        </div>
      </div>

      {/* Semanal: días (multi) */}
      {freq === 'WEEKLY' && (
        <div className="space-y-1.5">
          <p className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display">Días de la semana</p>
          <div className="flex gap-1.5">
            {DAYS.map(d => (
              <button
                key={d.key}
                type="button"
                aria-pressed={days.includes(d.key)}
                onClick={() => toggleDay(d.key)}
                className={cn('h-8 w-8 rounded-lg text-[12px] font-medium border transition-all font-display border-outline',
                  days.includes(d.key) ? 'bg-coral text-white border-coral' : 'text-navy-light hover:bg-surface-low')}
              >
                {d.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-navy-light/60 font-body">Podés elegir varios días por semana.</p>
        </div>
      )}

      {/* Mensual: modo día del mes | posición + día */}
      {freq === 'MONTHLY' && (
        <div className="space-y-2">
          <p className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display">Repetir cada mes</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="monthMode" className="accent-coral" checked={monthMode === 'dom'} onChange={() => { setMonthMode('dom'); emit({ monthMode: 'dom' }) }} />
            <span className="text-sm text-navy font-body">El día</span>
            <select
              className={inputCls}
              value={monthDay}
              onChange={e => { const n = Number(e.target.value); setMonthDay(n); setMonthMode('dom'); emit({ monthMode: 'dom', monthDay: n }) }}
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="text-sm text-navy-light/70 font-body">de cada mes</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer flex-wrap">
            <input type="radio" name="monthMode" className="accent-coral" checked={monthMode === 'dow'} onChange={() => { setMonthMode('dow'); emit({ monthMode: 'dow' }) }} />
            <span className="text-sm text-navy font-body">El</span>
            <select
              className={inputCls}
              value={monthPos}
              onChange={e => { setMonthPos(e.target.value); setMonthMode('dow'); emit({ monthMode: 'dow', monthPos: e.target.value }) }}
            >
              {['1', '2', '3', '4', '-1'].map(p => <option key={p} value={p}>{POS_NAME[p]}</option>)}
            </select>
            <select
              className={inputCls}
              value={monthDow}
              onChange={e => { setMonthDow(e.target.value); setMonthMode('dow'); emit({ monthMode: 'dow', monthDow: e.target.value }) }}
            >
              {DOW_CODE.map(c => <option key={c} value={c}>{DOW_NAME[c]}</option>)}
            </select>
            <span className="text-sm text-navy-light/70 font-body">de cada mes</span>
          </label>
        </div>
      )}

      {/* Fin de la recurrencia (opcional) */}
      {onEndDateChange && (
        <div className="space-y-1.5 pt-1">
          <p className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display">Termina el (opcional)</p>
          <div className="flex items-center gap-2 max-w-xs">
            <DatePicker
              value={endDate ?? ''}
              onChange={onEndDateChange}
              min={startDate}
              placeholder="Sin fecha de fin"
            />
            {endDate && (
              <button
                type="button"
                onClick={() => onEndDateChange('')}
                className="shrink-0 text-[12px] text-navy-light/60 hover:text-coral transition-colors font-body"
              >
                Quitar
              </button>
            )}
          </div>
          <p className="text-[11px] text-navy-light/60 font-body">Sin fecha, la serie se repite indefinidamente.</p>
        </div>
      )}
    </div>
  )
}
