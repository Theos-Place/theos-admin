'use client'

import Link from 'next/link'
import { Calendar, Clock, MapPin, Repeat } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MockEvent } from '@/types/event'
import { eventTypeConfig } from '@/data/event-config'
import { EventTypeBadge } from '@/components/events/EventTypeBadge'
import { EventStatusBadge } from '@/components/events/EventStatusBadge'
import { RealizadoBadge } from '@/components/events/RealizadoBadge'
import { isPastEvent, recurrenceLabel } from '@/lib/events/expand-recurrence'

// Fondo del placeholder (cuando el evento no tiene flyer) según el tipo.
const PLACEHOLDER_BG: Record<string, string> = {
  navy:   'bg-navy/10 text-navy',
  teal:   'bg-teal-deep/10 text-teal-deep',
  coral:  'bg-coral/10 text-coral',
  purple: 'bg-purple-700/10 text-purple-700',
  amber:  'bg-amber-500/15 text-amber-600',
}

/** Card grande y visual de un evento para la vista Grid. */
export function EventCard({ event }: { event: MockEvent }) {
  const config = eventTypeConfig(event.event_type)
  const past = isPastEvent(event)
  const start = new Date(event.start_at)
  const recurrence = event.is_recurring ? recurrenceLabel(event.recurrence_rule) : null
  // Ocurrencias virtuales comparten el id del padre → pasamos su fecha para que
  // el detalle muestre la de esta ocurrencia, no la del padre.
  const isOccurrence = (event as MockEvent & { occurrence_key?: string }).occurrence_key != null
  const href = isOccurrence
    ? `/eventos/${event.id}?date=${encodeURIComponent(event.start_at)}`
    : `/eventos/${event.id}`

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-2xl bg-surface-card shadow-[var(--shadow-md)] transition-shadow hover:shadow-[var(--shadow-lg)]"
    >
      {/* Flyer o placeholder */}
      <div className="relative h-36 w-full overflow-hidden">
        {event.flyer_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.flyer_url}
            alt={`Flyer de ${event.name}`}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className={cn('flex h-full w-full items-center justify-center', PLACEHOLDER_BG[config.color] ?? 'bg-navy/10 text-navy')}>
            <Calendar size={36} strokeWidth={1.5} />
          </div>
        )}
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
          {past ? <RealizadoBadge /> : <EventStatusBadge status={event.status} />}
          {event.is_recurring && (
            <span className="inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-medium text-navy-light/70 font-body">
              <Repeat size={10} /> {recurrence ?? 'Recurrente'}
            </span>
          )}
        </div>
      </div>

      {/* Cuerpo */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <EventTypeBadge type={event.event_type} size="sm" />
        <h3 className="text-[15px] font-semibold text-navy font-display leading-snug line-clamp-2">
          {event.name}
        </h3>
        <div className="mt-auto space-y-1 pt-1">
          <p className="flex items-center gap-1.5 text-[12px] text-navy-light/70 font-body">
            <Clock size={13} className="shrink-0 text-navy-light/60" />
            {start.toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}
            {' · '}
            {start.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', hour12: true })}
          </p>
          {event.location && (
            <p className="flex items-center gap-1.5 text-[12px] text-navy-light/70 font-body">
              <MapPin size={13} className="shrink-0 text-navy-light/60" />
              <span className="truncate">{event.location}</span>
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}
