'use client'

import { useState, useMemo, useEffect, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUrlFilter } from '@/hooks/useUrlFilter'
import { useAuth } from '@/hooks/useAuth'
import { useEventTypes } from '@/hooks/useEventTypes'
import { EVENT_TYPE_CONFIG, type EventType, type MockEvent } from '@/data/event-config'
import { useEvents, useAllEventsLight } from '@/hooks/useEvents'
import { EventTypeBadge } from '@/components/events/EventTypeBadge'
import { EventStatusBadge } from '@/components/events/EventStatusBadge'
import { RealizadoBadge } from '@/components/events/RealizadoBadge'
import { EventCard } from '@/components/events/EventCard'
import { CapacityBar } from '@/components/events/CapacityBar'
import { FilterChips } from '@/components/shared/FilterChips'
import { Tabs } from '@/components/shared/Tabs'
import { CalendarGrid } from '@/components/events/CalendarGrid'
import { recurrenceLabel, isPastEvent } from '@/lib/events/expand-recurrence'
import { monthEvents, eventsInRange } from '@/lib/events/event-views'
import { cn } from '@/lib/utils'
import { Plus, Calendar, Download, Code, ExternalLink, Repeat } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { CheckSquare } from 'lucide-react'

type EventView = 'calendar' | 'list' | 'grid'
const VIEW_STORAGE_KEY = 'theos_eventos_view'

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
  const { hasRole } = useAuth()
  const canShare = hasRole('comunicaciones', 'direccion', 'admin')
  const canCheckin = hasRole('encargado_eventos', 'direccion', 'admin')
  // Filtros de tipo desde la BD (no el mock): si se agrega un tipo, aparece solo.
  const eventTypes = useEventTypes()
  const typeFilters = useMemo(
    () => [{ key: 'all', label: 'Todos' }, ...eventTypes.map(t => ({ key: t.id, label: t.name }))],
    [eventTypes],
  )
  const { events, loading } = useEvents()
  const { events: allEventsLight } = useAllEventsLight()
  // Vista en URL (?view=) + recuerdo en localStorage; default calendario.
  const [viewRaw, setViewRaw] = useUrlFilter('view', 'calendar')
  const view: EventView = (['calendar', 'list', 'grid'] as const).includes(viewRaw as EventView)
    ? (viewRaw as EventView) : 'calendar'
  const [typeRaw, setTypeFilterRaw] = useUrlFilter('tipo', 'all')
  const typeFilter = typeRaw as EventType | 'all'
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const now = new Date()
  const [currentMonth, setCurrentMonth] = useState(now.getMonth())
  const [currentYear, setCurrentYear] = useState(now.getFullYear())

  // Si la URL no trae ?view=, restaurar la vista recordada (default calendario).
  const initRef = useRef(false)
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    const sp = new URLSearchParams(window.location.search)
    if (!sp.has('view')) {
      // Compatibilidad con links viejos que usaban ?vista=
      const legacy = sp.get('vista')
      const stored = localStorage.getItem(VIEW_STORAGE_KEY)
      const next = [legacy, stored].find(v => v && v !== 'calendar' && ['list', 'grid', 'calendar'].includes(v))
      if (next) setViewRaw(next)
    }
  }, [setViewRaw])

  function setView(v: string) {
    setViewRaw(v)
    try { localStorage.setItem(VIEW_STORAGE_KEY, v) } catch { /* ignore */ }
  }

  // Cambiar de filtro reinicia la paginación
  function setTypeFilter(key: EventType | 'all') {
    setTypeFilterRaw(key)
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

  // Ocurrencias del mes en curso (recurrentes contados por día).
  const thisMonthEvents = monthEvents(merged, now.getMonth(), now.getFullYear())

  // Ocurrencias de los próximos 7 días (recurrentes por día).
  const next7Days = (() => {
    const from = new Date(now); from.setHours(0, 0, 0, 0)
    const to = new Date(from); to.setDate(to.getDate() + 7)
    return eventsInRange(merged, from, to)
  })()

  const totalRegistrations = events.reduce((sum, e) => sum + e.registrations.length, 0)

  const todayCheckins = events.reduce((sum, e) => {
    return sum + e.checkins.filter(c => {
      const d = new Date(c.checked_at)
      return d.toDateString() === now.toDateString()
    }).length
  }, 0)

  // Lista/Grid: próximas OCURRENCIAS (los recurrentes se cuentan por día, no una
  // sola vez) dentro de una ventana de 90 días hacia adelante. Filtro por tipo.
  // Los realizados se ven únicamente en el calendario (con opacidad/badge).
  const listRows = useMemo(() => {
    const from = new Date(); from.setHours(0, 0, 0, 0)
    const to = new Date(from); to.setDate(to.getDate() + 90)
    const up = eventsInRange(merged, from, to)
    return typeFilter === 'all' ? up : up.filter(e => e.event_type === typeFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merged, typeFilter])

  const visibleRows = listRows.slice(0, visibleCount)

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

  // Calendario: todo el historial + ocurrencias virtuales de recurrentes del mes
  // visible (util compartido — misma expansión que lista, grid y público).
  const calendarMonthEvents = useMemo(
    () => monthEvents(merged, currentMonth, currentYear),
    [merged, currentMonth, currentYear],
  )

  // Contador del header según la vista activa.
  const headerCount = view === 'calendar' ? calendarMonthEvents.length : listRows.length
  const headerNoun = view === 'calendar'
    ? `evento${calendarMonthEvents.length !== 1 ? 's' : ''} este mes`
    : `evento${listRows.length !== 1 ? 's' : ''} próximo${listRows.length !== 1 ? 's' : ''}`

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
            {loading ? 'Cargando…' : `${headerCount.toLocaleString('es-CR')} ${headerNoun}`}
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
          {canShare && (
            <Link
              href="/eventos/embed"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3.5 py-2 text-sm text-white/80 hover:bg-white/10 transition-all duration-150 font-body"
            >
              <Code size={13} />
              Compartir calendario
            </Link>
          )}
          {canCheckin && (
            <Link
              href="/eventos/checkin"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3.5 py-2 text-sm text-white/80 hover:bg-white/10 transition-all duration-150 font-body"
            >
              <CheckSquare size={13} />
              Check-in
            </Link>
          )}
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
          { key: 'calendar', label: 'Calendario' },
          { key: 'list', label: 'Lista' },
          { key: 'grid', label: 'Grid' },
        ]}
        active={view}
        onChange={setView}
      />

      {/* Lista y Grid: solo próximos; único filtro = tipo de evento */}
      {(view === 'list' || view === 'grid') && (
        <FilterChips
          chips={typeFilters}
          activeKey={typeFilter}
          onSelect={k => setTypeFilter(k as EventType | 'all')}
          ariaLabel="Filtrar eventos por tipo"
        />
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
                      key={`${event.id}-${event.start_at}`}
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
                  key={`${event.id}-${event.start_at}`}
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
            <EmptyState icon={Calendar} title="No hay eventos próximos con ese filtro" />
          )}

          {/* Paginación: contador + cargar más */}
          {listRows.length > 0 && (
            <div className="flex flex-col items-center gap-2 px-4 py-4 border-t border-[var(--outline-variant)]">
              <p className="text-[12px] text-navy-light/60 font-body">
                Mostrando {Math.min(visibleCount, listRows.length)} de {listRows.length} próximos
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

      {/* Vista Grid: cards con flyer (misma data que la lista: próximos, 15) */}
      {view === 'grid' && (
        <div className="space-y-4">
          {listRows.length === 0 ? (
            <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)]">
              <EmptyState icon={Calendar} title="No hay eventos próximos con ese filtro" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleRows.map(event => (
                  <EventCard key={`${event.id}-${event.start_at}`} event={event} />
                ))}
              </div>
              <div className="flex flex-col items-center gap-2">
                <p className="text-[12px] text-navy-light/60 font-body">
                  Mostrando {Math.min(visibleCount, listRows.length)} de {listRows.length} próximos
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
            </>
          )}
        </div>
      )}

      {/* Vista Calendario */}
      {view === 'calendar' && (
        <CalendarGrid
          events={calendarMonthEvents}
          month={currentMonth}
          year={currentYear}
          onEventClick={(id, occ) => router.push(occ ? `/eventos/${id}?date=${encodeURIComponent(occ)}` : `/eventos/${id}`)}
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
