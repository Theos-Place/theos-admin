'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { EVENT_TYPE_CONFIG, EVENT_TYPES, type EventType, type MockEvent } from '@/data/mock-events'
import { useEvents } from '@/hooks/useEvents'
import { EventTypeBadge } from '@/components/events/EventTypeBadge'
import { EventStatusBadge } from '@/components/events/EventStatusBadge'
import { CapacityBar } from '@/components/events/CapacityBar'
import { CalendarGrid } from '@/components/events/CalendarGrid'
import { cn } from '@/lib/utils'
import { Plus, LayoutList, Calendar, Download, Code, ExternalLink } from 'lucide-react'

const TYPE_FILTERS: { key: EventType | 'all'; label: string }[] = [
  { key: 'all', label: 'Todos' },
  ...EVENT_TYPES.filter(t => t.is_active).map(t => ({
    key: t.id as EventType,
    label: t.name,
  })),
]

function downloadAllEventsICS(events: MockEvent[]) {
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  const vevents = events.map(event => [
    'BEGIN:VEVENT',
    `UID:${event.id}@theosplace.org`,
    `DTSTAMP:${formatDate(new Date().toISOString())}`,
    `DTSTART:${formatDate(event.start_at)}`,
    `DTEND:${formatDate(event.end_at)}`,
    `SUMMARY:${event.name}`,
    `DESCRIPTION:${event.description || ''}`,
    `LOCATION:${event.location || ''}`,
    'END:VEVENT',
  ].join('\r\n')).join('\r\n')

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Theos Place//Sistema Admin//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    vevents,
    'END:VCALENDAR',
  ].join('\r\n')

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `theos-eventos-${new Date().toISOString().split('T')[0]}.ics`
  link.click()
  URL.revokeObjectURL(url)
}

export default function EventosPage() {
  const router = useRouter()
  const { events, loading } = useEvents()
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [typeFilter, setTypeFilter] = useState<EventType | 'all'>('all')
  const now = new Date()
  const [currentMonth, setCurrentMonth] = useState(now.getMonth())
  const [currentYear, setCurrentYear] = useState(now.getFullYear())

  const thisMonthEvents = events.filter(e => {
    const d = new Date(e.start_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })

  const next7Days = events.filter(e => {
    const d = new Date(e.start_at)
    const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= 7
  })

  const totalRegistrations = events.reduce((sum, e) => sum + e.registrations.length, 0)

  const todayCheckins = events.reduce((sum, e) => {
    return sum + e.checkins.filter(c => {
      const d = new Date(c.checked_at)
      return d.toDateString() === now.toDateString()
    }).length
  }, 0)

  const filtered = useMemo(() => {
    return events.filter(e => typeFilter === 'all' || e.event_type === typeFilter)
  }, [events, typeFilter])

  function handlePrev() {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(y => y - 1)
    } else {
      setCurrentMonth(m => m - 1)
    }
  }

  function handleNext() {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(y => y + 1)
    } else {
      setCurrentMonth(m => m + 1)
    }
  }

  const calendarMonthEvents = events.filter(e => {
    const d = new Date(e.start_at)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  })

  return (
    <div className="space-y-6">
      {/* Header editorial */}
      <div className="rounded-2xl bg-navy px-4 py-4 sm:px-6 sm:py-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between shadow-[var(--shadow-md)]">
        <div>
          <h1
            className="text-2xl text-white font-display font-extrabold tracking-[-0.02em]"
          >
            Eventos
          </h1>
          <p className="mt-1 text-sm text-white/50 font-body">
            {loading ? 'Cargando…' : `${events.length} eventos en el sistema`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:shrink-0">
          <button
            onClick={() => downloadAllEventsICS(filtered)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3.5 py-2 text-sm text-white/80 hover:bg-white/10 transition-all duration-150 font-body"
          >
            <Download size={13} />
            Exportar calendario
          </button>
          <a
            href="/calendario"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3.5 py-2 text-sm text-white/80 hover:bg-white/10 transition-all duration-150 font-body"
          >
            <ExternalLink size={13} />
            Ver calendario público
          </a>
          <Link
            href="/eventos/embed"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3.5 py-2 text-sm text-white/80 hover:bg-white/10 transition-all duration-150 font-body"
          >
            <Code size={13} />
            Compartir calendario
          </Link>
          <Link
            href="/eventos/nuevo"
            className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-all duration-150 font-body"
          >
            <Plus size={14} />
            Crear evento
          </Link>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Este mes', value: thisMonthEvents.length, color: 'text-navy' },
          { label: 'Próximos 7 días', value: next7Days.length, color: 'text-teal-deep' },
          { label: 'Inscritos totales', value: totalRegistrations, color: 'text-coral' },
          { label: 'Check-ins hoy', value: todayCheckins, color: 'text-navy' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)]"
          >
            <p
              className="text-[10px] tracking-widest uppercase text-navy-light/40 font-display"
            >
              {label}
            </p>
            <p
              className={cn('mt-2 text-4xl font-extrabold tabular-nums font-display', color)}
            >
              {value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Toggle Vista */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div
          className="inline-flex rounded-full p-1 bg-surface-low"
        >
          <button
            onClick={() => setView('list')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm transition-all duration-150',
              view === 'list'
                ? 'bg-navy text-white shadow-sm'
                : 'text-navy-light/60 hover:text-navy',
              'font-body'
            )}
          >
            <LayoutList size={14} />
            Lista
          </button>
          <button
            onClick={() => setView('calendar')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm transition-all duration-150',
              view === 'calendar'
                ? 'bg-navy text-white shadow-sm'
                : 'text-navy-light/60 hover:text-navy',
              'font-body'
            )}
          >
            <Calendar size={14} />
            Calendario
          </button>
        </div>

        {view === 'list' && (
          <div className="flex gap-1.5 flex-wrap">
            {TYPE_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setTypeFilter(f.key)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-[12px] font-medium border transition-all duration-150',
                  typeFilter === f.key
                    ? 'bg-navy text-white border-navy'
                    : 'text-navy-light/60 hover:text-navy hover:bg-surface-low border-transparent',
                  'font-display'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Vista Lista */}
      {view === 'list' && (
        <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Evento', 'Tipo', 'Fecha', 'Capacidad', 'Inscritos', 'Estado', ''].map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] tracking-widest uppercase text-navy-light/50 font-display"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((event, idx) => {
                  const config = EVENT_TYPE_CONFIG[event.event_type]
                  const dotColors: Record<string, string> = {
                    navy: 'bg-navy', teal: 'bg-teal-deep', coral: 'bg-coral',
                    purple: 'bg-purple-700', amber: 'bg-amber-500',
                  }
                  const dotColor = dotColors[config.color] ?? 'bg-navy'
                  const startDate = new Date(event.start_at)
                  return (
                    <tr
                      key={event.id}
                      onClick={() => router.push(`/eventos/${event.id}`)}
                      className={cn(
                        'hover:bg-navy/5 transition-colors cursor-pointer',
                        idx % 2 === 1 ? 'bg-surface-low/40' : ''
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {event.flyer_url && (
                            <img src={event.flyer_url} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0" />
                          )}
                          <span className={cn('h-2 w-2 rounded-full shrink-0', dotColor)} />
                          <span className="text-sm font-medium text-navy truncate max-w-[200px] font-body">
                            {event.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <EventTypeBadge type={event.event_type} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-[12px] text-navy-light/60 whitespace-nowrap font-body">
                        {startDate.toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <CapacityBar current={event.registrations.length} max={event.max_capacity} />
                      </td>
                      <td className="px-4 py-3 text-sm text-navy tabular-nums font-body">
                        {event.registrations.length}
                      </td>
                      <td className="px-4 py-3">
                        <EventStatusBadge status={event.status} />
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <Link
                          href={`/eventos/${event.id}`}
                          className="rounded-lg px-2.5 py-1 text-[11px] text-navy-light border border-[var(--outline-variant)] hover:bg-surface-low transition-colors font-body"
                        >
                          →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: tarjetas */}
          <ul className="md:hidden">
            {filtered.map((event, idx) => {
              const config = EVENT_TYPE_CONFIG[event.event_type]
              const dotColors: Record<string, string> = {
                navy: 'bg-navy', teal: 'bg-teal-deep', coral: 'bg-coral',
                purple: 'bg-purple-700', amber: 'bg-amber-500',
              }
              const dotColor = dotColors[config.color] ?? 'bg-navy'
              const startDate = new Date(event.start_at)
              return (
                <li
                  key={event.id}
                  onClick={() => router.push(`/eventos/${event.id}`)}
                  className="flex items-center gap-3 px-4 py-3 active:bg-surface-low cursor-pointer"
                  style={idx < filtered.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
                >
                  {event.flyer_url ? (
                    <img src={event.flyer_url} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', dotColor)} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-navy font-body">{event.name}</p>
                    <p className="truncate text-[12px] text-navy-light/60 font-body">
                      {startDate.toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · '}{event.registrations.length} inscritos
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <EventTypeBadge type={event.event_type} size="sm" />
                    <EventStatusBadge status={event.status} size="sm" />
                  </div>
                </li>
              )
            })}
          </ul>

          {filtered.length === 0 && (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-navy-light/40 font-body">
                No hay eventos con ese filtro.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Vista Calendario */}
      {view === 'calendar' && (
        <div className="overflow-x-auto">
          <div className="min-w-[640px] md:min-w-0">
            <CalendarGrid
              events={calendarMonthEvents}
              month={currentMonth}
              year={currentYear}
              onEventClick={id => router.push(`/eventos/${id}`)}
              onPrev={handlePrev}
              onNext={handleNext}
            />
          </div>
        </div>
      )}
    </div>
  )
}
