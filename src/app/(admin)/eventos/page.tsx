'use client'

import { useState, useMemo, useEffect, useRef, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUrlFilter } from '@/hooks/useUrlFilter'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import { useEventTypes, useEventTypeStyle } from '@/hooks/useEventTypes'
import { type EventType, type AdminEvent } from '@/data/event-config'
import { useEvents, useAllEventsLight } from '@/hooks/useEvents'
import { toDomainEvent } from '@/lib/events/adapter'
import type { DbEventEnriched } from '@/lib/supabase/queries/events'
import type { EventEligibilityResult } from '@/lib/events/eligibility'
import { useEventRegistration } from '@/components/events/useEventRegistration'
import { MemberCombobox } from '@/components/shared/MemberCombobox'
import { EVENT_ON_BEHALF_ROLES } from '@/lib/auth/on-behalf'
import { EventTypeBadge } from '@/components/events/EventTypeBadge'
import { EventStatusBadge } from '@/components/events/EventStatusBadge'
import { RealizadoBadge } from '@/components/events/RealizadoBadge'
import { EventCard } from '@/components/events/EventCard'
import { CapacityBar } from '@/components/events/CapacityBar'
import { FilterChips } from '@/components/shared/FilterChips'
import { Tabs } from '@/components/shared/Tabs'
import { CalendarGrid } from '@/components/events/CalendarGrid'
import { MonthNav } from '@/components/events/MonthNav'
import { recurrenceLabel, isPastEvent } from '@/lib/events/expand-recurrence'
import { monthEvents, eventsInRange } from '@/lib/events/event-views'
import { cn } from '@/lib/utils'
import { eventPageActions } from '@/lib/events/page-actions'
import { downloadBlob } from '@/lib/export'
import { Plus, Calendar, Download, Code, ExternalLink, Repeat, CheckCircle2, X, AlertCircle } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { CheckSquare } from 'lucide-react'

type EventView = 'calendar' | 'list' | 'grid'
const VIEW_STORAGE_KEY = 'theos_eventos_view'

const PAGE_SIZE = 15

function downloadAllEventsICS(events: AdminEvent[]) {
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

  downloadBlob(ics, `theos-eventos-${new Date().toISOString().split('T')[0]}.ics`, 'text/calendar;charset=utf-8')
}

/** Convierte un resultado de elegibilidad en un AdminEvent mínimo, suficiente
 *  para las 3 vistas (calendario/lista/cuadrícula) — usado cuando el usuario
 *  no tiene el módulo eventos y por lo tanto no puede llamar /api/events. */
function eligibilityToStubEvent(e: EventEligibilityResult): AdminEvent {
  return {
    id: e.event_id,
    name: e.title,
    event_type: e.event_type as EventType,
    description: '',
    start_at: e.starts_at,
    end_at: e.ends_at ?? e.starts_at,
    location: e.location ?? '',
    location_map_url: null,
    is_virtual: false,
    virtual_url: null,
    requires_registration: true,
    max_capacity: e.max_capacity,
    requires_payment: e.requires_payment,
    payment_amount: e.requires_payment ? e.price : null,
    server_price: null,
    servers_pay: true,
    organizing_committee_ids: [],
    requires_survey: false,
    status: e.status,
    is_recurring: e.is_recurring,
    recurrence_rule: e.recurrence_rule,
    recurrence_end: null,
    parent_event_id: null,
    exception_dates: [],
    sub_events: [],
    registrations: Array.from({ length: e.registrations_count }),
    checkins: [],
    volunteer_bookings: [],
    cancellation_reason: null,
    flyer_url: e.flyer_url,
    is_active: true,
  } as unknown as AdminEvent
}

function EventosContent() {
  const router = useRouter()
  const registerSearchParams = useSearchParams()
  // Dos fuentes: activos con relaciones (stats, próximos) + TODOS en liviano
  // (históricos para calendario y "Realizados"). Se fusionan por id.
  const { user } = useAuth()
  const { can } = usePermissions()
  // Sin permiso sobre el módulo: vista de solo inscripción (antes vivía en la
  // página aparte /mis-eventos) — mismas 3 vistas, sin acciones de gestión.
  const canManage = can('eventos', 'view')
  // EVE-3: compartir = solo admin/comunicaciones; check-in = EVENT_CHECKIN_ROLES
  // (incluye direccion a propósito — es la constante que exigen los endpoints).
  const { share: canShare, checkin: canCheckin } = eventPageActions(user?.roles ?? [])

  // Elegibilidad de inscripción del propio usuario — disponible para
  // cualquiera con member_id, gestione o no el módulo (un miembro del staff
  // también puede inscribirse a un evento como cualquier otro miembro).
  // FRM-4 · Inscribir a OTRA persona (caso real: lo pide por teléfono). El
  // endpoint ya lo permitía y no había forma de llegar desde la pantalla; ahora
  // además queda el rastro de quién inscribió (recorded_by).
  const puedeInscribirAOtro = (user?.roles ?? [])
    .some(r => r === 'admin' || (EVENT_ON_BEHALF_ROLES as string[]).includes(r))
  const [inscribirA, setInscribirA] = useState<{ id: string; name: string } | null>(null)
  const memberId = inscribirA?.id ?? user?.member_id ?? null
  const [eligibility, setEligibility] = useState<EventEligibilityResult[]>([])
  // Hace falta saber si la lista YA CARGÓ, no solo si está vacía: sin esto,
  // "cargando" y "cargó y no está" se ven igual (las dos son []) y el deep link
  // no puede decidir si esperar o avisar.
  const [eligLoaded, setEligLoaded] = useState(false)
  const [eligRefresh, setEligRefresh] = useState(0)
  useEffect(() => {
    if (!memberId) return
    let alive = true
    fetch(`/api/eventos/elegibilidad?member_id=${memberId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive) { setEligibility(d?.eligibility ?? []); setEligLoaded(true) } })
      .catch(() => { if (alive) setEligLoaded(true) })
    return () => { alive = false }
  }, [memberId, eligRefresh])
  const eligibilityByEventId = useMemo(
    () => new Map(eligibility.map(e => [e.event_id, e])),
    [eligibility],
  )
  const { openRegister, openReceipt, requestScholarship, successEvent, clearSuccess, modals: registrationModals } =
    useEventRegistration(memberId, () => setEligRefresh(k => k + 1))

  // EVE-1: deep link ?register=<eventId> (viene del calendario público, con o
  // sin login-gate): al cargar la elegibilidad abre el modal de inscripción de
  // ese evento — mismo flujo y misma verificación que el botón normal.
  const registerParam = registerSearchParams.get('register')
  const registerHandled = useRef(false)
  /** Por qué no se pudo abrir la inscripción del deep link. */
  const [registerFallo, setRegisterFallo] = useState<string | null>(null)
  useEffect(() => {
    if (registerHandled.current || !registerParam) return
    const elig = eligibilityByEventId.get(registerParam)
    if (elig) {
      registerHandled.current = true
      openRegister(elig)
      router.replace('/eventos', { scroll: false })
      return
    }
    // NO estaba en la lista. Antes acá había un `return` pelado y eso era el
    // bug: la persona venía del link público, entraba, y la pantalla no abría
    // nada NI decía nada — parecía que el botón no funcionaba. Puede pasar por
    // varias razones legítimas (ya empezó, cupo lleno, ya está inscrita), así
    // que se le pregunta al endpoint público y se explica.
    if (!eligLoaded) return
    registerHandled.current = true
    router.replace('/eventos', { scroll: false })
    fetch(`/api/public/events/${registerParam}`)
      .then(r => (r.ok ? r.json() : null))
      .then((d: { event?: { title?: string; requires_registration?: boolean; cupo_lleno?: boolean; starts_at?: string } } | null) => {
        const ev = d?.event
        const nombre = ev?.title ? `«${ev.title}»` : 'este evento'
        if (!ev) return setRegisterFallo(`No encontramos ${nombre}. Puede que el enlace ya no sirva.`)
        if (ev.requires_registration === false) return setRegisterFallo(`${nombre} no necesita inscripción: te esperamos.`)
        if (ev.cupo_lleno) return setRegisterFallo(`Ya no hay cupo en ${nombre}. Escribinos si querés quedar en lista de espera.`)
        if (ev.starts_at && new Date(ev.starts_at).getTime() < Date.now()) {
          return setRegisterFallo(`La inscripción a ${nombre} ya cerró: el evento empezó.`)
        }
        setRegisterFallo(`No pudimos abrir la inscripción a ${nombre}. Puede ser que ya estés inscrito/a — revisá la lista de abajo.`)
      })
      .catch(() => setRegisterFallo('No pudimos abrir la inscripción. Probá de nuevo en un momento.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerParam, eligibilityByEventId, eligLoaded])
  // Filtros de tipo desde la BD (no el mock): si se agrega un tipo, aparece solo.
  const eventTypes = useEventTypes()
  const typeStyle = useEventTypeStyle()
  const typeFilters = useMemo(
    () => [{ key: 'all', label: 'Todos' }, ...eventTypes.map(t => ({ key: t.id, label: t.name }))],
    [eventTypes],
  )
  const { events, loading: loadingManage } = useEvents()
  const { events: allEventsLight } = useAllEventsLight()
  // Sin permiso de gestión: no hay /api/events (403), así que el calendario/
  // lista/cuadrícula se arman con la propia elegibilidad — misma limitación
  // que tenía /mis-eventos (solo eventos abiertos a inscripción).
  const loading = canManage ? loadingManage : false
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
      // (El fallback del param legacy ?vista= se retiró — deuda del overview;
      // los links viejos caen al default o a la vista recordada.)
      const stored = localStorage.getItem(VIEW_STORAGE_KEY)
      const next = [stored].find(v => v && v !== 'calendar' && ['list', 'grid', 'calendar'].includes(v))
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

  // SEC-1 (2026-07-29): sin el módulo eventos la vista se arma con el endpoint
  // PÚBLICO — así se ven TODOS los eventos publicados (incluidos los
  // históricos), sin datos de gestión: el whitelist público no trae
  // inscripciones ni check-ins, y los cancelados/archivados quedan fuera.
  // La elegibilidad se sigue usando para el botón de inscripción.
  const [publicEvents, setPublicEvents] = useState<AdminEvent[]>([])
  useEffect(() => {
    if (canManage) return
    let alive = true
    fetch('/api/public/events')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        // El endpoint público responde { events, total } con la forma de BD
        // (starts_at/ends_at) → el mismo adaptador del listado admin.
        if (!alive || !Array.isArray(d?.events)) return
        setPublicEvents((d.events as DbEventEnriched[]).map(toDomainEvent))
      })
      .catch(() => {})
    return () => { alive = false }
  }, [canManage])

  // Fallback: si el endpoint público no trae nada, al menos los eventos a los
  // que la persona puede inscribirse (comportamiento anterior).
  //
  // Se filtran los INTERNOS. La elegibilidad los trae a propósito —sin ellos el
  // link de inscripción de un evento interno no encontraría nada y el botón
  // volvería a no hacer nada— pero LISTARLOS sería justo lo que "interno" no
  // debe hacer. El deep link no pasa por acá: usa eligibilityByEventId, que sí
  // los tiene. Quien gestiona eventos ve todo.
  const memberEvents: AdminEvent[] = useMemo(
    () => eligibility
      .filter(e => canManage || e.is_public)
      .map(eligibilityToStubEvent),
    [eligibility, canManage],
  )
  const merged = useMemo(() => {
    if (!canManage) {
      if (publicEvents.length === 0) return memberEvents
      // Los datos de elegibilidad (cupo, precio) enriquecen al público.
      const eligById = new Map(memberEvents.map(e => [e.id, e]))
      return publicEvents.map(e => ({ ...e, ...(eligById.get(e.id) ?? {}) }))
    }
    const fullById = new Map(events.map(e => [e.id, e]))
    const result = allEventsLight.map(e => fullById.get(e.id) ?? e)
    if (result.length === 0) return events // el liviano aún no llega
    const seen = new Set(result.map(e => e.id))
    for (const e of events) if (!seen.has(e.id)) result.push(e)
    return result
  }, [canManage, memberEvents, publicEvents, events, allEventsLight])

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

  // Lista/Grid: OCURRENCIAS del mes seleccionado (mismo mes/año que el
  // calendario — los recurrentes se cuentan por día, no una sola vez). Filtro
  // por tipo. Realizados incluidos (con badge), igual que en el calendario.
  const listRows = useMemo(() => {
    const up = monthEvents(merged, currentMonth, currentYear)
    return typeFilter === 'all' ? up : up.filter(e => e.event_type === typeFilter)
  }, [merged, typeFilter, currentMonth, currentYear])

  const visibleRows = listRows.slice(0, visibleCount)

  // Cambiar de mes/año reinicia la paginación (mismo criterio que el filtro de tipo).
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [currentMonth, currentYear])

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

  function handleToday() {
    const d = new Date()
    setCurrentMonth(d.getMonth())
    setCurrentYear(d.getFullYear())
  }

  // Calendario: todo el historial + ocurrencias virtuales de recurrentes del mes
  // visible (util compartido — misma expansión que lista, grid y público).
  const calendarMonthEvents = useMemo(
    () => monthEvents(merged, currentMonth, currentYear),
    [merged, currentMonth, currentYear],
  )

  // Contador del header — mismo mes que la navegación, en las 3 vistas.
  const headerCount = view === 'calendar' ? calendarMonthEvents.length : listRows.length
  const headerNoun = `evento${headerCount !== 1 ? 's' : ''} este mes`

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
          <p className="mt-1 text-sm text-white/80 font-body">
            {loading ? 'Cargando…' : `${headerCount.toLocaleString('es-CR')} ${headerNoun}`}
            {inscribirA && <> · inscribiendo a <span className="text-white font-medium">{inscribirA.name}</span></>}
          </p>

          {/* FRM-4 · Inscribir a otra persona. Queda en el header y no dentro del
              modal a propósito: así se ve DURANTE toda la navegación a nombre de
              quién se está actuando, y no se descubre al confirmar. */}
          {puedeInscribirAOtro && (
            <div className="mt-3 flex flex-col gap-1 w-full sm:w-72">
              <span className="text-[11px] uppercase tracking-widest text-white/80 font-display">
                Inscribir a otra persona
              </span>
              {inscribirA ? (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm text-white">
                  <span className="truncate font-body">{inscribirA.name}</span>
                  <button
                    onClick={() => setInscribirA(null)}
                    aria-label="Volver a inscribirme a mí"
                    className="text-white/80 hover:text-white shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <MemberCombobox
                  dropdown
                  variant="onDark"
                  pageSize={6}
                  placeholder="Buscar miembro…"
                  onSelect={m => setInscribirA({ id: m.id, name: `${m.first_name} ${m.last_name}`.trim() })}
                />
              )}
            </div>
          )}
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
          {canManage && (
            <Link
              href="/eventos/nuevo"
              className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-all duration-150 font-body"
            >
              <Plus size={14} />
              Crear evento
            </Link>
          )}
        </div>
      </div>

      {/* Confirmación de inscripción (gratis/exenta — la que requiere pago abre el comprobante aparte) */}
      {successEvent && (
        <div className="rounded-2xl p-5 flex items-start gap-3 bg-teal/10 border border-teal-deep/20">
          <CheckCircle2 size={20} className="text-teal-deep shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-navy font-body">¡Inscripción confirmada!</p>
            <p className="text-[13px] text-navy-light/80 font-body">Quedaste inscrito/a en {successEvent}.</p>
          </div>
          <button onClick={clearSuccess} aria-label="Cerrar aviso de inscripción" className="ml-auto text-navy-light/80 hover:text-navy"><X size={16} /></button>
        </div>
      )}

      {/* El deep link del calendario público no pudo abrir la inscripción. Se
          explica en vez de no hacer nada, que era lo que pasaba antes. */}
      {registerFallo && (
        <div className="rounded-2xl p-5 flex items-start gap-3 bg-coral/[0.07] border border-coral/20" role="status">
          <AlertCircle size={20} className="text-coral-deep shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-navy font-body">No se abrió la inscripción</p>
            <p className="text-[13px] text-navy-light/80 font-body">{registerFallo}</p>
          </div>
          <button onClick={() => setRegisterFallo(null)} aria-label="Cerrar aviso" className="ml-auto text-navy-light/80 hover:text-navy"><X size={16} /></button>
        </div>
      )}


      {/* Stats cards — solo gestión (inscritos/check-ins no le sirven a un miembro) */}
      {canManage && (
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
              className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display"
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
      )}

      {/* Toggle Vista */}
      <Tabs
        tabs={[
          { key: 'calendar', label: 'Calendario' },
          { key: 'list', label: 'Lista' },
          { key: 'grid', label: 'Cuadrícula' },
        ]}
        active={view}
        onChange={setView}
      />

      {/* Lista y Grid: mismo selector de mes que el calendario + filtro de tipo */}
      {(view === 'list' || view === 'grid') && (
        <>
          <MonthNav
            month={currentMonth}
            year={currentYear}
            onPrev={handlePrev}
            onNext={handleNext}
            onPrevYear={() => setCurrentYear(y => y - 1)}
            onNextYear={() => setCurrentYear(y => y + 1)}
            onToday={handleToday}
            onSetMonth={setCurrentMonth}
            onSetYear={setCurrentYear}
          />
          <FilterChips
            chips={typeFilters}
            activeKey={typeFilter}
            onSelect={k => setTypeFilter(k as EventType | 'all')}
            ariaLabel="Filtrar eventos por tipo"
          />
        </>
      )}

      {/* Vista Lista */}
      {view === 'list' && (
        <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Evento', 'Tipo', 'Fecha', ...(canManage ? ['Capacidad', 'Inscritos'] : []), 'Estado', 'Inscripción'].map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[11px] tracking-widest uppercase text-navy-light/80 font-display"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((event, idx) => {
                  const typeColor = typeStyle(event.event_type).color
                  const startDate = new Date(event.start_at)
                  const past = isPastEvent(event)
                  const recurrence = event.is_recurring ? recurrenceLabel(event.recurrence_rule) : null
                  const elig = eligibilityByEventId.get(event.id)
                  return (
                    <tr
                      key={`${event.id}-${event.start_at}`}
                      // La ficha del evento es para cualquiera (decisión
                      // 2026-07-31): muestra la info general y, si el evento pide
                      // inscripción, el botón para inscribirse.
                      onClick={() => router.push(`/eventos/${event.id}`)}
                      className={cn(
                        'transition-colors hover:bg-navy/5 cursor-pointer',
                        idx % 2 === 1 ? 'bg-surface-low/40' : ''
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {event.flyer_url && (
                            <Image src={event.flyer_url} alt={`Flyer de ${event.name}`} width={36} height={36} className="h-9 w-9 rounded-lg object-cover shrink-0" />
                          )}
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: typeColor }} />
                          <div className="min-w-0">
                            <span className="block text-sm font-medium text-navy truncate max-w-[200px] font-body">
                              {event.name}
                            </span>
                            {event.is_recurring && (
                              <span className="inline-flex items-center gap-1 text-[13px] text-navy-light/80 font-body">
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
                      <td className="px-4 py-3 text-[13px] text-navy-light/80 whitespace-nowrap font-body">
                        {startDate.toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      {/* Conteos de inscripción = datos de gestión: no para
                          quien solo ve los eventos públicos. */}
                      {canManage && (
                        <>
                          <td className="px-4 py-3">
                            <CapacityBar current={event.registrations.length} max={event.max_capacity} />
                          </td>
                          <td className="px-4 py-3 text-sm text-navy tabular-nums font-body">
                            {event.registrations.length}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3">
                        {past ? <RealizadoBadge /> : <EventStatusBadge status={event.status} />}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {elig?.is_eligible ? (
                            <button
                              type="button"
                              onClick={() => openRegister(elig)}
                              className="rounded-lg px-2.5 py-1 text-[13px] font-medium text-coral bg-coral/10 hover:bg-coral/20 transition-colors font-body whitespace-nowrap"
                            >
                              Inscribirme
                            </button>
                          ) : elig?.already_registered ? (
                            <span className="rounded-lg px-2.5 py-1 text-[13px] font-medium text-teal-deep bg-teal-soft/20 font-body whitespace-nowrap">
                              Ya inscrito/a
                            </span>
                          ) : null}
                          <Link
                            href={`/eventos/${event.id}`}
                            aria-label={`Ver ${event.name}`}
                            className="rounded-lg px-2.5 py-1 text-[13px] text-navy-light border border-[var(--outline-variant)] hover:bg-surface-low transition-colors font-body"
                          >
                            →
                          </Link>
                        </div>
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
              const typeColor = typeStyle(event.event_type).color
              const startDate = new Date(event.start_at)
              const past = isPastEvent(event)
              const recurrence = event.is_recurring ? recurrenceLabel(event.recurrence_rule) : null
              const elig = eligibilityByEventId.get(event.id)
              return (
                <li
                  key={`${event.id}-${event.start_at}`}
                  onClick={() => router.push(`/eventos/${event.id}`)}
                  className={cn('flex items-center gap-3 px-4 py-3', 'active:bg-surface-low cursor-pointer')}
                  style={idx < visibleRows.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
                >
                  {event.flyer_url ? (
                    <Image src={event.flyer_url} alt={`Flyer de ${event.name}`} width={40} height={40} className="h-10 w-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: typeColor }} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-navy font-body">{event.name}</p>
                    <p className="truncate text-[13px] text-navy-light/80 font-body">
                      {startDate.toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {canManage && <>{' · '}{event.registrations.length} inscritos</>}
                    </p>
                    {event.is_recurring && (
                      <p className="inline-flex items-center gap-1 text-[13px] text-navy-light/80 font-body">
                        <Repeat size={11} />
                        {recurrence ?? 'Recurrente'}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <EventTypeBadge type={event.event_type} size="sm" />
                    {past ? <RealizadoBadge /> : <EventStatusBadge status={event.status} size="sm" />}
                    {elig?.is_eligible ? (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); openRegister(elig) }}
                        className="rounded-lg px-2 py-0.5 text-[11px] font-medium text-coral bg-coral/10 font-body whitespace-nowrap"
                      >
                        Inscribirme
                      </button>
                    ) : elig?.already_registered ? (
                      <span className="rounded-lg px-2 py-0.5 text-[11px] font-medium text-teal-deep bg-teal-soft/20 font-body whitespace-nowrap">
                        Ya inscrito/a
                      </span>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>

          {listRows.length === 0 && (
            <EmptyState icon={Calendar} title="No hay eventos este mes con ese filtro" />
          )}

          {/* Paginación: contador + cargar más */}
          {listRows.length > 0 && (
            <div className="flex flex-col items-center gap-2 px-4 py-4 border-t border-[var(--outline-variant)]">
              <p className="text-[13px] text-navy-light/80 font-body">
                Mostrando {Math.min(visibleCount, listRows.length)} de {listRows.length} este mes
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

      {/* Vista Grid: cards con flyer (misma data que la lista: mes seleccionado) */}
      {view === 'grid' && (
        <div className="space-y-4">
          {listRows.length === 0 ? (
            <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)]">
              <EmptyState icon={Calendar} title="No hay eventos este mes con ese filtro" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleRows.map(event => (
                  <EventCard
                    key={`${event.id}-${event.start_at}`}
                    event={event}
                    // La ficha del evento es para cualquiera (2026-07-31): la
                    // propia ficha deja solo el tab de Información a quien no
                    // gestiona, y ofrece el botón de inscripción.
                    linkToDetail
                    eligibility={eligibilityByEventId.get(event.id)}
                    onRegister={() => { const e = eligibilityByEventId.get(event.id); if (e) openRegister(e) }}
                    onRequestScholarship={() => { const e = eligibilityByEventId.get(event.id); if (e) requestScholarship(e) }}
                    onUploadReceipt={() => { const e = eligibilityByEventId.get(event.id); if (e) openReceipt(e) }}
                  />
                ))}
              </div>
              <div className="flex flex-col items-center gap-2">
                <p className="text-[13px] text-navy-light/80 font-body">
                  Mostrando {Math.min(visibleCount, listRows.length)} de {listRows.length} este mes
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
          onDayClick={canManage ? (ymd) => router.push(`/eventos/nuevo?date=${ymd}`) : undefined}
          onPrev={handlePrev}
          onNext={handleNext}
          onPrevYear={() => setCurrentYear(y => y - 1)}
          onNextYear={() => setCurrentYear(y => y + 1)}
          onToday={handleToday}
          onSetMonth={setCurrentMonth}
          onSetYear={setCurrentYear}
          canViewDetail
          eligibilityByEventId={eligibilityByEventId}
          onRegister={openRegister}
        />
      )}

      {registrationModals}
    </div>
  )
}

export default function EventosPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-sm text-navy-light/80 font-body">Cargando...</div>
      </div>
    }>
      <EventosContent />
    </Suspense>
  )
}
