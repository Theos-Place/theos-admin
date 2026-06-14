'use client'

import { useState, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUrlFilter } from '@/hooks/useUrlFilter'
import { EVENT_TYPE_CONFIG, EVENT_TYPES, type EventType, type MockEvent } from '@/data/mock-events'
import { useEvents, useAllEventsLight } from '@/hooks/useEvents'
import { EventTypeBadge } from '@/components/events/EventTypeBadge'
import { EventStatusBadge } from '@/components/events/EventStatusBadge'
import { RealizadoBadge } from '@/components/events/RealizadoBadge'
import { CapacityBar } from '@/components/events/CapacityBar'
import { FilterChips } from '@/components/shared/FilterChips'
import { Tabs } from '@/components/shared/Tabs'
import { CalendarGrid } from '@/components/events/CalendarGrid'
import { expandRecurring, nextOccurrence, recurrenceLabel, isPastEvent } from '@/lib/events/expand-recurrence'
import { cn } from '@/lib/utils'
import { Plus, Calendar, Download, Code, ExternalLink, Repeat } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'

const TYPE_FILTERS: { key: EventType | 'all'; label: string }[] = [
  { key: 'all', label: 'Todos' },
  ...EVENT_TYPES.filter(t => t.is_active).map(t => ({
    key: t.id as EventType,
    label: t.name,
  })),
]

type StatusFilter = 'proximos' | 'realizados' | 'todos'

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'proximos',   label: 'Próximos' },
  { key: 'realizados', label: 'Realizados' },
  { key: 'todos',      label: 'Todos' },
]

const PAGE_SIZE = 15

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

function EventosContent() {
  const router = useRouter()
  // Dos fuentes: activos con relaciones (stats, próximos) + TODOS en liviano
  // (históricos para calendario y "Realizados"). Se fusionan por id.
  const { events, loading } = useEvents()
  const { events: allEventsLight } = useAllEventsLight()
  // Vista, tipo y estado en la URL: sobreviven recargas y se comparten por link.
  const [viewRaw, setView] = useUrlFilter('vista', 'list')
  const view = (viewRaw === 'calendar' ? 'calendar' : 'list') as 'list' | 'calendar'
  const [typeRaw, setTypeFilterRaw] = useUrlFilter('tipo', 'all')
  const typeFilter = typeRaw as EventType | 'all'
  const [statusRaw, setStatusFilterRaw] = useUrlFilter('estado', 'proximos')
  const statusFilter: StatusFilter =
    statusRaw === 'realizados' || statusRaw === 'todos' ? statusRaw : 'proximos'
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const now = new Date()
  const [currentMonth, setCurrentMonth] = useState(now.getMonth())
  const [currentYear, setCurrentYear] = useState(now.getFullYear())

  // Cambiar de filtro reinicia la paginación
  function setTypeFilter(key: EventType | 'all') {
    setTypeFilterRaw(key)
    setVisibleCount(PAGE_SIZE)
  }
  function setStatusFilter(key: StatusFilter) {
    setStatusFilterRaw(key)
    setVisibleCount(PAGE_SIZE)
  }

  const merged = useMemo(() => {
    const fullById = new Map(events.map(e => [e.id, e]))
    const result = allEventsLight.map(e => fullById.get(e.id) ?? e)
    if (result.length === 0) return events // el liviano aún no llega
    const seen = new Set(result.map(e => e.id))
    for (const e of events) if (!seen.has(e.id)) result.push(e)
    return result
  }, [events, allEventsLight])

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

  // Filas de la lista según estado derivado (sin tocar la BD):
  //  - Próximos: futuros activos, asc; un recurrente aparece UNA vez con su
  //    próxima ocurrencia (virtual, fechas desplazadas).
  //  - Realizados: puntuales ya pasados (incluye imports históricos), desc.
  //    Las ocurrencias pasadas de recurrentes solo viven en el calendario.
  const listRows = useMemo(() => {
    const ref = new Date()
    const byType = (e: MockEvent) => typeFilter === 'all' || e.event_type === typeFilter

    const upcoming: MockEvent[] = []
    for (const e of merged) {
      if (!byType(e) || e.is_active === false) continue
      if (e.is_recurring && e.recurrence_rule) {
        const next = nextOccurrence(e, ref)
        if (!next) continue
        const dur = Math.max(0, new Date(e.end_at).getTime() - new Date(e.start_at).getTime())
        upcoming.push({
          ...e,
          start_at: next.toISOString(),
          end_at: new Date(next.getTime() + dur).toISOString(),
        })
      } else if (!isPastEvent(e, ref)) {
        upcoming.push(e)
      }
    }
    upcoming.sort((a, b) => a.start_at.localeCompare(b.start_at))

    const done = merged
      .filter(e => byType(e) && !e.is_recurring && isPastEvent(e, ref))
      .sort((a, b) => b.start_at.localeCompare(a.start_at))

    if (statusFilter === 'proximos') return upcoming
    if (statusFilter === 'realizados') return done
    return [...upcoming, ...done].sort((a, b) => a.start_at.localeCompare(b.start_at))
  }, [merged, typeFilter, statusFilter])

  const visibleRows = listRows.slice(0, visibleCount)
  const counterNoun =
    statusFilter === 'proximos' ? 'próximos' : statusFilter === 'realizados' ? 'realizados' : 'eventos'

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

  // Calendario: todo el historial + ocurrencias virtuales de recurrentes
  // dentro del mes visible (sin filas nuevas en la BD).
  const calendarMonthEvents = useMemo(() => {
    const from = new Date(currentYear, currentMonth, 1)
    const to = new Date(currentYear, currentMonth + 1, 1)
    const inMonth = merged.filter(e => {
      const d = new Date(e.start_at)
      return d >= from && d < to
    })
    const occurrences = merged.flatMap(e => expandRecurring(e, from, to))
    return [...inMonth, ...occurrences]
  }, [merged, currentMonth, currentYear])

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
          <p className="mt-1 text-sm text-white/70 font-body">
            {loading ? 'Cargando…' : `${events.length} eventos en el sistema`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:shrink-0">
          <button
            onClick={() => downloadAllEventsICS(listRows)}
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
              className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display"
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
      <Tabs
        tabs={[
          { key: 'list', label: 'Lista' },
          { key: 'calendar', label: 'Calendario' },
        ]}
        active={view}
        onChange={v => setView(v as 'list' | 'calendar')}
      />

      {view === 'list' && (
        <div className="flex items-center gap-3 flex-wrap">
          {/* Estado derivado: Próximos · Realizados · Todos */}
          <FilterChips
            chips={STATUS_FILTERS}
            activeKey={statusFilter}
            onSelect={k => setStatusFilter(k as StatusFilter)}
            ariaLabel="Filtrar eventos por estado"
          />
          <FilterChips
            chips={TYPE_FILTERS}
            activeKey={typeFilter}
            onSelect={k => setTypeFilter(k as EventType | 'all')}
            ariaLabel="Filtrar eventos por tipo"
          />
        </div>
      )}

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
                      className="px-4 py-3 text-left text-[10px] tracking-widest uppercase text-navy-light/60 font-display"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((event, idx) => {
                  const config = EVENT_TYPE_CONFIG[event.event_type]
                  const dotColors: Record<string, string> = {
                    navy: 'bg-navy', teal: 'bg-teal-deep', coral: 'bg-coral',
                    purple: 'bg-purple-700', amber: 'bg-amber-500',
                  }
                  const dotColor = dotColors[config.color] ?? 'bg-navy'
                  const startDate = new Date(event.start_at)
                  const past = isPastEvent(event)
                  const recurrence = event.is_recurring ? recurrenceLabel(event.recurrence_rule) : null
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
                            <img src={event.flyer_url} alt={`Flyer de ${event.name}`} className="h-9 w-9 rounded-lg object-cover shrink-0" />
                          )}
                          <span className={cn('h-2 w-2 rounded-full shrink-0', dotColor)} />
                          <div className="min-w-0">
                            <span className="block text-sm font-medium text-navy truncate max-w-[200px] font-body">
                              {event.name}
                            </span>
                            {event.is_recurring && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-navy-light/60 font-body">
                                <Repeat size={11} />
                                {recurrence ?? 'Recurrente'}
                              </span>
                            )}
                          </div>
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
                        {past ? <RealizadoBadge /> : <EventStatusBadge status={event.status} />}
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
            {visibleRows.map((event, idx) => {
              const config = EVENT_TYPE_CONFIG[event.event_type]
              const dotColors: Record<string, string> = {
                navy: 'bg-navy', teal: 'bg-teal-deep', coral: 'bg-coral',
                purple: 'bg-purple-700', amber: 'bg-amber-500',
              }
              const dotColor = dotColors[config.color] ?? 'bg-navy'
              const startDate = new Date(event.start_at)
              const past = isPastEvent(event)
              const recurrence = event.is_recurring ? recurrenceLabel(event.recurrence_rule) : null
              return (
                <li
                  key={event.id}
                  onClick={() => router.push(`/eventos/${event.id}`)}
                  className="flex items-center gap-3 px-4 py-3 active:bg-surface-low cursor-pointer"
                  style={idx < visibleRows.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
                >
                  {event.flyer_url ? (
                    <img src={event.flyer_url} alt={`Flyer de ${event.name}`} className="h-10 w-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', dotColor)} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-navy font-body">{event.name}</p>
                    <p className="truncate text-[12px] text-navy-light/60 font-body">
                      {startDate.toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · '}{event.registrations.length} inscritos
                    </p>
                    {event.is_recurring && (
                      <p className="inline-flex items-center gap-1 text-[11px] text-navy-light/60 font-body">
                        <Repeat size={11} />
                        {recurrence ?? 'Recurrente'}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <EventTypeBadge type={event.event_type} size="sm" />
                    {past ? <RealizadoBadge /> : <EventStatusBadge status={event.status} size="sm" />}
                  </div>
                </li>
              )
            })}
          </ul>

          {listRows.length === 0 && (
            <EmptyState
              icon={Calendar}
              title={
                statusFilter === 'proximos'
                  ? 'No hay eventos próximos con ese filtro'
                  : statusFilter === 'realizados'
                    ? 'No hay eventos realizados con ese filtro'
                    : 'No hay eventos con ese filtro'
              }
            />
          )}

          {/* Paginación: contador + cargar más */}
          {listRows.length > 0 && (
            <div className="flex flex-col items-center gap-2 px-4 py-4 border-t border-[var(--outline-variant)]">
              <p className="text-[12px] text-navy-light/60 font-body">
                Mostrando {Math.min(visibleCount, listRows.length)} de {listRows.length} {counterNoun}
              </p>
              {listRows.length > visibleCount && (
                <button
                  onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                  className="rounded-full border border-[var(--outline-variant)] px-4 py-2 text-sm text-navy hover:bg-surface-low transition-colors font-body"
                >
                  Cargar {PAGE_SIZE} más
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Vista Calendario */}
      {view === 'calendar' && (
        <CalendarGrid
          events={calendarMonthEvents}
          month={currentMonth}
          year={currentYear}
          onEventClick={id => router.push(`/eventos/${id}`)}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      )}
    </div>
  )
}

export default function EventosPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-sm text-navy-light/60 font-body">Cargando...</div>
      </div>
    }>
      <EventosContent />
    </Suspense>
  )
}
