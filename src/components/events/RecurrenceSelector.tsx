'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { DatePicker } from '@/components/events/DatePicker'
import {
  construirRegla, leerRegla, describirRegla, RECURRENCIA_DEFAULT, type Recurrencia,
} from '@/lib/events/recurrence-rule'

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
  { key: 'MON', label: 'L' }, { key: 'TUE', label: 'M' }, { key: 'WED', label: 'X' },
  { key: 'THU', label: 'J' }, { key: 'FRI', label: 'V' }, { key: 'SAT', label: 'S' },
  { key: 'SUN', label: 'D' },
]
// getDay() 0=Dom..6=Sáb → código RRULE de 2 letras
const DOW_CODE = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
const DOW_NAME: Record<string, string> = { SU: 'domingo', MO: 'lunes', TU: 'martes', WE: 'miércoles', TH: 'jueves', FR: 'viernes', SA: 'sábado' }
const POS_NAME: Record<string, string> = { '1': '1º', '2': '2º', '3': '3º', '4': '4º', '-1': 'último' }
const POS_ORDEN = ['1', '2', '3', '4', '-1']

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

export function RecurrenceSelector({ value, onChange, startDate, endDate, onEndDateChange }: RecurrenceSelectorProps) {
  const sug = suggestFromDate(startDate)
  const leida = leerRegla(value)

  /** Todo el estado en un objeto: construirRegla y describirRegla lo toman
   *  entero, así no hay que pasar siete argumentos posicionales a cada cambio
   *  —que era donde se colaban los errores al agregar un campo. */
  const [rec, setRec] = useState<Recurrencia>(leida ?? {
    ...RECURRENCIA_DEFAULT,
    monthDay: sug.day, monthPos: [sug.pos], monthDow: sug.dow,
  })

  // Si llega sin regla (value null), fija un default sensato según la fecha.
  useEffect(() => {
    if (value === null) onChange(construirRegla(rec))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function set(over: Partial<Recurrencia>) {
    const next = { ...rec, ...over }
    setRec(next)
    onChange(construirRegla(next))
  }

  function toggleDay(d: string) {
    const next = rec.days.includes(d) ? rec.days.filter(x => x !== d) : [...rec.days, d]
    if (next.length === 0) return   // dejar cero días no describe nada
    set({ days: next })
  }

  function togglePos(p: string) {
    const next = rec.monthPos.includes(p) ? rec.monthPos.filter(x => x !== p) : [...rec.monthPos, p]
    if (next.length === 0) return
    set({ monthMode: 'dow', monthPos: next })
  }

  const inputCls = 'rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'
  const unidad = rec.freq === 'WEEKLY' ? 'semana' : 'mes'

  return (
    <div className="space-y-3">
      {/* Frecuencia + cada cuánto */}
      <div className="space-y-1.5">
        <p className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">Frecuencia</p>
        <div className="flex flex-wrap items-center gap-2">
          {(['WEEKLY', 'MONTHLY'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => set({ freq: f })}
              className={cn('rounded-lg px-3 py-1.5 text-[13px] font-medium border transition-all font-display border-outline',
                rec.freq === f ? 'bg-navy text-white border-navy' : 'text-navy-light hover:bg-surface-low')}
            >
              {f === 'WEEKLY' ? 'Semanal' : 'Mensual'}
            </button>
          ))}
          {/* "cada N": es lo que permite "cada dos semanas" sin inventar una
              frecuencia nueva — la repetición sigue siendo semanal, solo se
              saltea. */}
          <span className="text-sm text-navy-light/80 font-body ml-1">cada</span>
          <input
            type="number"
            min={1}
            max={12}
            aria-label={`Repetir cada cuántas ${unidad}s`}
            value={rec.interval}
            onChange={e => set({ interval: Math.min(12, Math.max(1, Number(e.target.value) || 1)) })}
            className={cn(inputCls, 'w-16 text-center')}
          />
          <span className="text-sm text-navy-light/80 font-body">
            {rec.interval === 1 ? unidad : `${unidad}s`}
          </span>
        </div>
      </div>

      {/* Semanal: días (multi) */}
      {rec.freq === 'WEEKLY' && (
        <div className="space-y-1.5">
          <p className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">Días de la semana</p>
          <div className="flex gap-1.5">
            {DAYS.map(d => (
              <button
                key={d.key}
                type="button"
                aria-pressed={rec.days.includes(d.key)}
                onClick={() => toggleDay(d.key)}
                className={cn('h-8 w-8 rounded-lg text-[13px] font-medium border transition-all font-display border-outline',
                  rec.days.includes(d.key) ? 'bg-coral text-white border-coral' : 'text-navy-light hover:bg-surface-low')}
              >
                {d.label}
              </button>
            ))}
          </div>
          <p className="text-[13px] text-navy-light/80 font-body">Podés elegir varios días por semana.</p>
        </div>
      )}

      {/* Mensual: día del mes | posiciones + día de semana */}
      {rec.freq === 'MONTHLY' && (
        <div className="space-y-2">
          <p className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">Cada mes, repetir</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="monthMode" className="accent-coral" checked={rec.monthMode === 'dom'} onChange={() => set({ monthMode: 'dom' })} />
            <span className="text-sm text-navy font-body">El día</span>
            <select
              className={inputCls}
              aria-label="Día del mes"
              value={rec.monthDay}
              onChange={e => set({ monthMode: 'dom', monthDay: Number(e.target.value) })}
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 cursor-pointer flex-wrap">
              <input type="radio" name="monthMode" className="accent-coral" checked={rec.monthMode === 'dow'} onChange={() => set({ monthMode: 'dow' })} />
              <span className="text-sm text-navy font-body">El</span>
              {/* Botones y no un select: son VARIOS a la vez, que es lo que
                  permite "el primer y tercer sábado". */}
              <span className="flex gap-1">
                {POS_ORDEN.map(p => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={rec.monthMode === 'dow' && rec.monthPos.includes(p)}
                    onClick={() => togglePos(p)}
                    className={cn('rounded-lg px-2 py-1 text-[13px] font-medium border transition-all font-display border-outline',
                      rec.monthMode === 'dow' && rec.monthPos.includes(p)
                        ? 'bg-coral text-white border-coral' : 'text-navy-light hover:bg-surface-low')}
                  >
                    {POS_NAME[p]}
                  </button>
                ))}
              </span>
              <select
                className={inputCls}
                aria-label="Día de la semana"
                value={rec.monthDow}
                onChange={e => set({ monthMode: 'dow', monthDow: e.target.value })}
              >
                {DOW_CODE.map(c => <option key={c} value={c}>{DOW_NAME[c]}</option>)}
              </select>
            </label>
          </div>
        </div>
      )}

      {/* Qué quedó configurado, en palabras. Sin esto, "FREQ=MONTHLY;BYDAY=1SA,3SA"
          solo lo entiende quien lo escribió. */}
      <p className="rounded-xl bg-surface-low px-3 py-2 text-[13px] text-navy font-body">
        {describirRegla(rec)}
        {endDate ? `, hasta el ${endDate}` : ''}
      </p>

      {/* Fin de la recurrencia (opcional) */}
      {onEndDateChange && (
        <div className="space-y-1.5 pt-1">
          <p className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">Termina el (opcional)</p>
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
                className="shrink-0 text-[13px] text-navy-light/80 hover:text-coral transition-colors font-body"
              >
                Quitar
              </button>
            )}
          </div>
          <p className="text-[13px] text-navy-light/80 font-body">Sin fecha, la serie se repite indefinidamente.</p>
        </div>
      )}
    </div>
  )
}
