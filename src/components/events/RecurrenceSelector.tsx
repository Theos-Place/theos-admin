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

const ORDER = DAYS.map(d => d.key)

function parseRule(rule: string | null): { freq: string; days: string[] } {
  if (!rule) return { freq: 'WEEKLY', days: ['SUN'] }
  const [freq, daysPart] = rule.split(':')
  const days = (daysPart ?? 'SUN').split(',').map(d => d.trim()).filter(Boolean)
  return { freq: freq || 'WEEKLY', days: days.length ? days : ['SUN'] }
}

export function RecurrenceSelector({ value, onChange }: RecurrenceSelectorProps) {
  const parsed = parseRule(value)
  const [freq, setFreq] = useState(parsed.freq)
  const [days, setDays] = useState<string[]>(parsed.days)
  const [endDate, setEndDate] = useState('')

  // El toggle "Evento recurrente" externo controla si hay recurrencia. Acá solo
  // se eligen frecuencia/días. Si llega sin regla (value null) se fija un default
  // sensato (semanal) para que recurrence_rule nunca quede inválido con is_recurring=true.
  useEffect(() => {
    if (value === null) onChange(`${freq}:${days.join(',')}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function emit(nextFreq: string, nextDays: string[]) {
    // Ordena los días de forma estable (L→D) para una regla canónica.
    const ordered = ORDER.filter(d => nextDays.includes(d))
    onChange(`${nextFreq}:${ordered.join(',')}`)
  }

  function handleFreqChange(f: string) {
    setFreq(f)
    // Mensual: un solo día (no tiene sentido varios por mes en este modelo).
    const next = f === 'MONTHLY' ? days.slice(0, 1) : days
    setDays(next)
    emit(f, next)
  }

  function toggleDay(d: string) {
    if (freq === 'MONTHLY') {
      // Selección única en mensual.
      setDays([d])
      emit(freq, [d])
      return
    }
    // Semanal: multi-selección, pero nunca queda vacío.
    const next = days.includes(d) ? days.filter(x => x !== d) : [...days, d]
    if (next.length === 0) return
    setDays(next)
    emit(freq, next)
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

      {/* Días */}
      <div className="space-y-1.5">
        <p className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display">
          {freq === 'WEEKLY' ? 'Días de la semana' : 'Día de la semana'}
        </p>
        <div className="flex gap-1.5">
          {DAYS.map(d => (
            <button
              key={d.key}
              type="button"
              aria-pressed={days.includes(d.key)}
              onClick={() => toggleDay(d.key)}
              className={cn(
                'h-8 w-8 rounded-lg text-[12px] font-medium border transition-all font-display',
                days.includes(d.key) ? 'bg-coral text-white border-coral' : 'text-navy-light hover:bg-surface-low'
              , 'border-outline')}
            >
              {d.label}
            </button>
          ))}
        </div>
        {freq === 'WEEKLY' && (
          <p className="text-[11px] text-navy-light/60 font-body">
            Podés elegir varios días por semana.
          </p>
        )}
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
