'use client'

import { useState } from 'react'
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
  const active = value !== null
  const parsed = parseRule(value)
  const [freq, setFreq] = useState(parsed.freq)
  const [selectedDay, setSelectedDay] = useState(parsed.day)
  const [endDate, setEndDate] = useState('')

  function handleToggle() {
    if (active) {
      onChange(null)
    } else {
      onChange(`${freq}:${selectedDay}`)
    }
  }

  function handleFreqChange(f: string) {
    setFreq(f)
    if (active) onChange(`${f}:${selectedDay}`)
  }

  function handleDayChange(d: string) {
    setSelectedDay(d)
    if (active) onChange(`${freq}:${d}`)
  }

  const inputCls = 'rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          onClick={handleToggle}
          className={cn(
            'relative h-5 w-9 rounded-full transition-all duration-200 cursor-pointer',
            active ? 'bg-coral' : 'bg-navy-light/20'
          )}
        >
          <div
            className={cn(
              'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200',
              active ? 'translate-x-4' : 'translate-x-0.5'
            )}
          />
        </div>
        <span className="text-sm text-navy font-body">
          {active ? 'Evento recurrente' : 'Sin recurrencia'}
        </span>
      </label>

      {active && (
        <div className="space-y-3 pl-2 border-l-2 border-coral/20 ml-1">
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
      )}
    </div>
  )
}
