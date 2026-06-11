'use client'

import { cn } from '@/lib/utils'
import { type MockEvent, EVENT_TYPE_CONFIG } from '@/data/mock-events'
import { isPastEvent } from '@/lib/events/expand-recurrence'

// Las ocurrencias virtuales de recurrentes traen occurrence_key (mismo id que
// el padre → el clic lleva al detalle del padre, pero la key de React es única).
type CalendarEvent = MockEvent & { occurrence_key?: string }

interface CalendarGridProps {
  events: CalendarEvent[]
  month: number
  year: number
  onEventClick?: (id: string) => void
  onPrev: () => void
  onNext: () => void
}

const DOT_BG: Record<string, string> = {
  navy:   'bg-navy text-white',
  teal:   'bg-teal-deep text-white',
  coral:  'bg-coral text-white',
  purple: 'bg-purple-700 text-white',
  amber:  'bg-amber-500 text-white',
}

// Solo el color de fondo (para los puntos en mobile).
const DOT_ONLY: Record<string, string> = {
  navy:   'bg-navy',
  teal:   'bg-teal-deep',
  coral:  'bg-coral',
  purple: 'bg-purple-700',
  amber:  'bg-amber-500',
}

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function CalendarGrid({ events, month, year, onEventClick, onPrev, onNext }: CalendarGridProps) {
  const today = new Date()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  function eventsOnDay(day: number): CalendarEvent[] {
    return events.filter(e => {
      const d = new Date(e.start_at)
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
    })
  }

  return (
    <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--outline-variant)]">
        <button
          onClick={onPrev}
          className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-surface-low text-navy-light/60 hover:text-navy transition-colors font-display"
        >
          ‹
        </button>
        <h3
          className="text-sm font-semibold text-navy font-display"
        >
          {MONTH_NAMES[month]} {year}
        </h3>
        <button
          onClick={onNext}
          className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-surface-low text-navy-light/60 hover:text-navy transition-colors font-display"
        >
          ›
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-[var(--outline-variant)]">
        {DAY_LABELS.map(d => (
          <div
            key={d}
            className="py-2 text-center text-[10px] tracking-widest uppercase text-navy-light/60 font-display"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          const isToday = day !== null &&
            today.getFullYear() === year &&
            today.getMonth() === month &&
            today.getDate() === day
          const dayEvents = day ? eventsOnDay(day) : []
          const isWeekend = i % 7 === 0 || i % 7 === 6

          return (
            <div
              key={i}
              className={cn(
                'min-h-[58px] p-1 sm:min-h-[80px] sm:p-1.5 border-b border-r border-[var(--outline-variant)]',
                isWeekend && 'bg-surface-low/40',
                !day && 'opacity-0 pointer-events-none'
              )}
            >
              {day && (
                <>
                  <div
                    className={cn(
                      'h-6 w-6 flex items-center justify-center rounded-full mb-1 text-[12px] font-medium font-display',
                      isToday ? 'bg-coral text-white' : 'text-navy-light/60'
                    )}
                  >
                    {day}
                  </div>

                  {/* Mobile: puntos de color (los nombres no caben) */}
                  {dayEvents.length > 0 && (
                    <div className="flex flex-wrap gap-1 px-0.5 sm:hidden">
                      {dayEvents.slice(0, 4).map(ev => {
                        const config = EVENT_TYPE_CONFIG[ev.event_type]
                        const past = isPastEvent(ev)
                        return (
                          <button
                            key={ev.occurrence_key ?? ev.id}
                            onClick={() => onEventClick?.(ev.id)}
                            aria-label={past ? `${ev.name} (realizado)` : ev.name}
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              DOT_ONLY[config.color] ?? 'bg-navy',
                              past && 'opacity-40'
                            )}
                          />
                        )
                      })}
                      {dayEvents.length > 4 && (
                        <span className="text-[8px] text-navy-light/40 leading-none font-body">+{dayEvents.length - 4}</span>
                      )}
                    </div>
                  )}

                  {/* sm+: etiquetas con nombre */}
                  <div className="hidden sm:block space-y-0.5">
                    {dayEvents.slice(0, 3).map(ev => {
                      const config = EVENT_TYPE_CONFIG[ev.event_type]
                      const colorClass = DOT_BG[config.color] ?? 'bg-navy text-white'
                      const past = isPastEvent(ev)
                      return (
                        <button
                          key={ev.occurrence_key ?? ev.id}
                          onClick={() => onEventClick?.(ev.id)}
                          title={past ? `${ev.name} — Realizado` : ev.name}
                          className={cn(
                            'w-full text-left rounded px-1.5 py-0.5 text-[10px] font-medium truncate transition-opacity hover:opacity-80 font-body',
                            colorClass,
                            past && 'opacity-60 hover:opacity-80'
                          )}
                        >
                          {ev.flyer_url ? '🖼 ' : ''}{ev.name}
                        </button>
                      )
                    })}
                    {dayEvents.length > 3 && (
                      <p className="text-[9px] text-navy-light/40 px-1 font-body">
                        +{dayEvents.length - 3} más
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
