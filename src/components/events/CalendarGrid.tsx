'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { type MockEvent, EVENT_TYPE_CONFIG } from '@/data/event-config'
import { isPastEvent } from '@/lib/events/expand-recurrence'
import { Popover } from '@/components/shared/Popover'
import { EventTypeBadge } from '@/components/events/EventTypeBadge'
import { RealizadoBadge } from '@/components/events/RealizadoBadge'
import { MapPin, Clock, ExternalLink, Repeat, ChevronRight } from 'lucide-react'

// Las ocurrencias virtuales de recurrentes traen occurrence_key (mismo id que
// el padre → el clic lleva al detalle del padre, pero la key de React es única).
type CalendarEvent = MockEvent & { occurrence_key?: string }

interface CalendarGridProps {
  events: CalendarEvent[]
  month: number
  year: number
  onEventClick?: (id: string, occurrenceDate?: string) => void
  /** Clic en el espacio vacío de una celda de día → crear evento con esa fecha (YYYY-MM-DD). */
  onDayClick?: (dateYmd: string) => void
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

// Solo el color de fondo (para los puntos en mobile y la lista del día).
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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function isRecurring(ev: CalendarEvent): boolean {
  return ev.is_recurring || ev.occurrence_key != null || ev.parent_event_id != null
}

type PopoverState =
  | { kind: 'day'; day: number; events: CalendarEvent[]; rect: DOMRect }
  | { kind: 'event'; event: CalendarEvent; rect: DOMRect }
  | null

export function CalendarGrid({ events, month, year, onEventClick, onDayClick, onPrev, onNext }: CalendarGridProps) {
  const today = new Date()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const [pop, setPop] = useState<PopoverState>(null)

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  function eventsOnDay(day: number): CalendarEvent[] {
    return events
      .filter(e => {
        const d = new Date(e.start_at)
        return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
      })
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
  }

  function openDay(day: number, evs: CalendarEvent[], e: React.MouseEvent) {
    e.stopPropagation() // no disparar el "crear evento" de la celda
    setPop({ kind: 'day', day, events: evs, rect: e.currentTarget.getBoundingClientRect() })
  }
  function openEvent(ev: CalendarEvent, e: React.MouseEvent) {
    e.stopPropagation() // no disparar el "crear evento" de la celda
    setPop({ kind: 'event', event: ev, rect: e.currentTarget.getBoundingClientRect() })
  }
  function handleDayClick(day: number) {
    if (!onDayClick) return
    const ymd = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    onDayClick(ymd)
  }
  function goToEvent(ev: CalendarEvent) {
    setPop(null)
    // Para recurrentes pasamos la fecha de ESTA ocurrencia, así el detalle no
    // muestra la del evento padre.
    onEventClick?.(ev.id, isRecurring(ev) ? ev.start_at : undefined)
  }

  return (
    <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--outline-variant)]">
        <button
          onClick={onPrev}
          className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-surface-low text-navy-light/60 hover:text-navy transition-colors font-display"
          aria-label="Mes anterior"
        >
          ‹
        </button>
        <h3 className="text-sm font-semibold text-navy font-display">
          {MONTH_NAMES[month]} {year}
        </h3>
        <button
          onClick={onNext}
          className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-surface-low text-navy-light/60 hover:text-navy transition-colors font-display"
          aria-label="Mes siguiente"
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
              onClick={day && onDayClick ? () => handleDayClick(day) : undefined}
              className={cn(
                'min-h-[58px] p-1 sm:min-h-[80px] sm:p-1.5 border-b border-r border-[var(--outline-variant)]',
                isWeekend && 'bg-surface-low/40',
                !day && 'opacity-0 pointer-events-none',
                day && onDayClick && 'cursor-pointer hover:bg-coral/5 transition-colors'
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
                            onClick={e => openEvent(ev, e)}
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
                        <button
                          onClick={e => openDay(day, dayEvents, e)}
                          className="text-[8px] text-navy-light/60 leading-none font-body hover:text-navy"
                          aria-label={`Ver los ${dayEvents.length} eventos del día`}
                        >
                          +{dayEvents.length - 4}
                        </button>
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
                          onClick={e => openEvent(ev, e)}
                          title={past ? `${ev.name} — Realizado` : ev.name}
                          className={cn(
                            'w-full text-left rounded px-1.5 py-0.5 text-[10px] font-medium truncate transition-opacity hover:opacity-80 font-body',
                            colorClass,
                            past && 'opacity-75 hover:opacity-90'
                          )}
                        >
                          {ev.flyer_url ? '🖼 ' : ''}{ev.name}
                        </button>
                      )
                    })}
                    {dayEvents.length > 3 && (
                      <button
                        onClick={e => openDay(day, dayEvents, e)}
                        className="text-[9px] text-navy-light/60 px-1 font-body hover:text-navy hover:underline"
                      >
                        +{dayEvents.length - 3} más
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Popover: lista del día (desde "+N más") */}
      {pop?.kind === 'day' && (
        <Popover
          anchorRect={pop.rect}
          onClose={() => setPop(null)}
          titleId="cal-day-pop"
          title={`${pop.day} de ${MONTH_NAMES[month].toLowerCase()} · ${pop.events.length} evento${pop.events.length !== 1 ? 's' : ''}`}
          width={340}
        >
          <ul className="space-y-0.5">
            {pop.events.map(ev => {
              const config = EVENT_TYPE_CONFIG[ev.event_type]
              const past = isPastEvent(ev)
              return (
                <li key={ev.occurrence_key ?? ev.id}>
                  <button
                    onClick={() => goToEvent(ev)}
                    className="w-full flex items-start gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-surface-low transition-colors"
                  >
                    <span className={cn('mt-1.5 h-2 w-2 rounded-full shrink-0', DOT_ONLY[config.color] ?? 'bg-navy', past && 'opacity-50')} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-[12px] text-navy-light/70 tabular-nums font-body shrink-0">{formatTime(ev.start_at)}</span>
                        {past && <RealizadoBadge />}
                        {isRecurring(ev) && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-navy-light/60 font-body"><Repeat size={10} /> Recurrente</span>
                        )}
                      </span>
                      <span className={cn('block text-[13px] font-medium font-body truncate', past ? 'text-navy-light/70' : 'text-navy')}>
                        {ev.flyer_url ? '🖼 ' : ''}{ev.name}
                      </span>
                      <span className="text-[11px] text-navy-light/60 font-body">{config.label}</span>
                    </span>
                    <ChevronRight size={15} className="text-navy-light/60 shrink-0 mt-1" />
                  </button>
                </li>
              )
            })}
          </ul>
        </Popover>
      )}

      {/* Popover: preview de un evento (desde el clic en el evento) */}
      {pop?.kind === 'event' && (() => {
        const ev = pop.event
        const past = isPastEvent(ev)
        return (
          <Popover
            anchorRect={pop.rect}
            onClose={() => setPop(null)}
            titleId="cal-event-pop"
            title={ev.name}
            width={320}
          >
            <div className="px-2.5 py-1.5 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <EventTypeBadge type={ev.event_type} />
                {past && <RealizadoBadge />}
                {isRecurring(ev) && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-navy-light/60 font-body"><Repeat size={11} /> Recurrente</span>
                )}
              </div>

              <div className="flex items-start gap-2 text-[13px] text-navy-light/70 font-body">
                <Clock size={14} className="text-navy-light/60 shrink-0 mt-0.5" />
                <span>
                  {new Date(ev.start_at).toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  {' · '}{formatTime(ev.start_at)}
                  {ev.end_at && ev.end_at !== ev.start_at ? ` – ${formatTime(ev.end_at)}` : ''}
                </span>
              </div>

              {ev.location && (
                <div className="flex items-start gap-2 text-[13px] text-navy-light/70 font-body">
                  <MapPin size={14} className="text-navy-light/60 shrink-0 mt-0.5" />
                  {ev.location_map_url ? (
                    <a
                      href={ev.location_map_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-teal-deep hover:underline"
                    >
                      {ev.location} <ExternalLink size={11} className="shrink-0" />
                    </a>
                  ) : (
                    <span>{ev.location}</span>
                  )}
                </div>
              )}

              <button
                onClick={() => goToEvent(ev)}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-navy px-4 py-2 text-sm text-white hover:bg-navy-light transition-colors font-body"
              >
                Ver detalle completo
                <ChevronRight size={15} />
              </button>
            </div>
          </Popover>
        )
      })()}
    </div>
  )
}
