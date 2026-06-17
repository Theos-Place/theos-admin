'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface RecurrenceSelectorProps {
  value: string | null
  onChange: (v: string | null) => void
}

const DAYS = [
  { key: 'MON', label: 'L' },
  { key: 'TUE', label: 'M' },
  { key: 'WED', label: 'X' },
  { key: 'THU', label: 'J' },
  { key: 'FRI', label: 'V' },
  { key: 'SAT', label: 'S' },
  { key: 'SUN', label: 'D' },
]

function parseRule(rule: string | null) {
  if (!rule) return { freq: 'WEEKLY', day: 'SUN' }
  const parts = rule.split(':')
  return { freq: parts[0] ?? 'WEEKLY', day: parts[1] ?? 'SUN' }
}

export function RecurrenceSelector({ value, onChange }: RecurrenceSelectorProps) {
  const parsed = parseRule(value)
  const [freq, setFreq] = useState(parsed.freq)
  const [selectedDay, setSelectedDay] = useState(parsed.day)
  const [endDate, setEndDate] = useState('')

  // El toggle "Evento recurrente" externo controla si hay recurrencia. Acá solo
  // se eligen frecuencia/día. Si llega sin regla (value null) se fija un default
  // sensato (semanal) para que recurrence_rule nunca quede inválido con is_recurring=true.
  useEffect(() => {
    if (value === null) onChange(`${freq}:${selectedDay}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function handleFreqChange(f: string) {
    setFreq(f)
    onChange(`${f}:${selectedDay}`)
  }

  function handleDayChange(d: string) {
    setSelectedDay(d)
    onChange(`${freq}:${d}`)
  }

  const inputCls = 'rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'

  return (
    <div className="space-y-3">
      {/* Frecuencia */}
      <div className="space-y-1.5">
            <p className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display">
              Frecuencia
            </p>
            <div className="flex gap-2">
              {['WEEKLY', 'MONTHLY'].map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => handleFreqChange(f)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-[12px] font-medium border transition-all font-display',
                    freq === f ? 'bg-navy text-white border-navy' : 'text-navy-light hover:bg-surface-low'
                  , 'border-outline')}
                >
                  {f === 'WEEKLY' ? 'Semanal' : 'Mensual'}
                </button>
              ))}
            </div>
          </div>

          {/* Día */}
          <div className="space-y-1.5">
            <p className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display">
              Día de la semana
            </p>
            <div className="flex gap-1.5">
              {DAYS.map(d => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => handleDayChange(d.key)}
                  className={cn(
                    'h-8 w-8 rounded-lg text-[12px] font-medium border transition-all font-display',
                    selectedDay === d.key ? 'bg-coral text-white border-coral' : 'text-navy-light hover:bg-surface-low'
                  , 'border-outline')}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fin de recurrencia */}
          <div className="space-y-1.5">
            <p className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display">
              Fecha de fin (opcional)
            </p>
            <input
              type="date"
              className={inputCls}
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
      </div>
    </div>
  )
}
