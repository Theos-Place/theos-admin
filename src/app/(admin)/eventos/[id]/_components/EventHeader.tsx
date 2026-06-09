import Link from 'next/link'
import {
  ChevronLeft, Calendar, MapPin, Users, Edit2, MoreHorizontal,
  CalendarPlus, ExternalLink, Download, QrCode, X as XIcon,
} from 'lucide-react'
import { EventTypeBadge } from '@/components/events/EventTypeBadge'
import { EventStatusBadge } from '@/components/events/EventStatusBadge'
import type { MockEvent } from '@/data/mock-events'

type Event = MockEvent

function getGoogleCalendarUrl(event: Event) {
  const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
  const title = encodeURIComponent(event.name)
  const start = event.start_at.replace(/[-:]/g, '').replace(/\.\d{3}/, '').replace('+', '%2B')
  const end   = event.end_at.replace(/[-:]/g, '').replace(/\.\d{3}/, '').replace('+', '%2B')
  const details  = encodeURIComponent(event.description || '')
  const location = encodeURIComponent(event.location || '')
  return `${base}&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`
}

function downloadICS(event: Event, withRRule: boolean) {
  const fmt = (d: string) => new Date(d).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Theos Place//Sistema Admin//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@theosplace.org`,
    `DTSTAMP:${fmt(new Date().toISOString())}`,
    `DTSTART:${fmt(event.start_at)}`,
    `DTEND:${fmt(event.end_at)}`,
    `SUMMARY:${event.name}`,
    `DESCRIPTION:${event.description || ''}`,
    `LOCATION:${event.location || ''}`,
    ...(event.location_map_url ? [`URL:${event.location_map_url}`] : []),
    ...(withRRule && event.recurrence_rule ? [`RRULE:${event.recurrence_rule}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${event.name.replace(/\s+/g, '-')}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

type Props = {
  event: Event
  id: string
  cancelled: boolean
  registrationCount: number
  showMenu: boolean
  onMenuToggle: () => void
  onCancelClick: () => void
  showCalendarPopover: boolean
  onCalendarPopoverToggle: () => void
  onCalendarPopoverClose: () => void
  icsWithRRule: boolean
  onIcsWithRRuleChange: (val: boolean) => void
}

export function EventHeader({
  event,
  id,
  cancelled,
  registrationCount,
  showMenu,
  onMenuToggle,
  onCancelClick,
  showCalendarPopover,
  onCalendarPopoverToggle,
  onCalendarPopoverClose,
  icsWithRRule,
  onIcsWithRRuleChange,
}: Props) {
  const startDate = new Date(event.start_at)
  const endDate = new Date(event.end_at)

  return (
    <>
      {/* Back */}
      <Link
        href="/eventos"
        className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors font-body"
      >
        <ChevronLeft size={16} /> Eventos
      </Link>

      {/* Header card */}
      <div className="rounded-2xl bg-navy px-4 py-4 sm:px-6 sm:py-5 shadow-[var(--shadow-md)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <EventTypeBadge type={cancelled ? 'charla' : event.event_type} size="sm" />
              <EventStatusBadge status={cancelled ? 'cancelled' : event.status} size="sm" />
            </div>
            <h1
              className="text-2xl text-white font-bold leading-tight font-display font-extrabold tracking-[-0.02em]"
            >
              {event.name}
            </h1>
            <div className="flex flex-wrap gap-4 text-sm text-white/60 font-body">
              <span className="flex items-center gap-1.5">
                <Calendar size={13} className="text-white/40" />
                {startDate.toLocaleDateString('es-CR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                {' · '}
                {startDate.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
                {' — '}
                {endDate.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin size={13} className="text-white/40" />
                {event.location}
              </span>
              <span className="flex items-center gap-1.5">
                <Users size={13} className="text-white/40" />
                {registrationCount} inscritos
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap lg:flex-nowrap lg:shrink-0">
            {/* Calendar export popover */}
            <div className="relative">
              <button
                onClick={onCalendarPopoverToggle}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3.5 py-2 text-sm text-white/80 hover:bg-white/10 transition-all duration-150 font-body"
              >
                <CalendarPlus size={13} />
                Agregar a mi calendario
              </button>
              {showCalendarPopover && (
                <div
                  className="absolute right-0 top-full mt-2 rounded-2xl p-4 w-72 z-30 space-y-3 bg-surface-card shadow-[var(--shadow-lg)] border border-[var(--outline-variant)]"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] tracking-widest uppercase text-navy-light/40 font-display">
                      Exportar evento
                    </p>
                    <button onClick={onCalendarPopoverClose} className="text-navy-light/40 hover:text-navy transition-colors">
                      <XIcon size={14} />
                    </button>
                  </div>
                  <a
                    href={getGoogleCalendarUrl(event)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onCalendarPopoverClose}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 hover:bg-surface-low transition-colors"
                  >
                    <div className="h-8 w-8 rounded-lg bg-navy/10 flex items-center justify-center shrink-0">
                      <ExternalLink size={14} className="text-navy" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-navy font-body">Google Calendar</p>
                      <p className="text-[11px] text-navy-light/50 font-body">Abre en una nueva pestaña</p>
                    </div>
                  </a>
                  <div>
                    <button
                      onClick={() => { downloadICS(event, icsWithRRule); onCalendarPopoverClose() }}
                      className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 hover:bg-surface-low transition-colors text-left"
                    >
                      <div className="h-8 w-8 rounded-lg bg-navy/10 flex items-center justify-center shrink-0">
                        <Download size={14} className="text-navy" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-navy font-body">Apple / Outlook (.ics)</p>
                        <p className="text-[11px] text-navy-light/50 font-body">Descargar archivo de calendario</p>
                      </div>
                    </button>
                    {event.is_recurring && (
                      <label className="flex items-center gap-2 px-3 pt-1 pb-1 cursor-pointer">
                        <input
                          type="checkbox"
                          className="accent-coral"
                          checked={icsWithRRule}
                          onChange={e => onIcsWithRRuleChange(e.target.checked)}
                        />
                        <span className="text-[11px] text-navy-light/60 font-body">
                          Incluir toda la serie de recurrencia
                        </span>
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>
            <Link
              href={`/eventos/${id}/editar`}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3.5 py-2 text-sm text-white/80 hover:bg-white/10 transition-all duration-150 font-body"
            >
              <Edit2 size={13} />
              Editar
            </Link>
            <Link
              href={`/eventos/${id}/checkin`}
              className="inline-flex items-center gap-1.5 rounded-full bg-coral px-3.5 py-2 text-sm text-white hover:bg-coral-deep transition-all duration-150 font-body"
            >
              <QrCode size={13} />
              Check-in →
            </Link>
            <div className="relative">
              <button
                onClick={onMenuToggle}
                className="h-9 w-9 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:bg-white/10 transition-all"
              >
                <MoreHorizontal size={16} />
              </button>
              {showMenu && (
                <div
                  className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden w-44 z-20 bg-surface-card shadow-[var(--shadow-lg)]"
                >
                  <button
                    onClick={onCancelClick}
                    className="w-full text-left px-4 py-2.5 text-sm text-coral hover:bg-coral/5 transition-colors font-body"
                  >
                    Cancelar evento
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
