'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Calendar, Clock, MapPin, Repeat } from 'lucide-react'
import type { AdminEvent } from '@/types/event'
import type { EventEligibilityResult } from '@/lib/events/eligibility'
import { EventTypeBadge } from '@/components/events/EventTypeBadge'
import { EventStatusBadge } from '@/components/events/EventStatusBadge'
import { RealizadoBadge } from '@/components/events/RealizadoBadge'
import { isPastEvent, recurrenceLabel } from '@/lib/events/expand-recurrence'
import { useEventTypeStyle } from '@/hooks/useEventTypes'

interface EventCardProps {
  event: AdminEvent
  /** Si false, la card no navega al detalle administrativo (miembros sin
   *  permiso sobre el módulo eventos no pueden verlo). */
  linkToDetail?: boolean
  /** Elegibilidad de inscripción del usuario actual para este evento —
   *  ausente si el evento no requiere inscripción. */
  eligibility?: EventEligibilityResult
  onRegister?: () => void
  onRequestScholarship?: () => void
}

/** Card grande y visual de un evento para la vista Grid. */
export function EventCard({ event, linkToDetail = true, eligibility, onRegister, onRequestScholarship }: EventCardProps) {
  const typeColor = useEventTypeStyle()(event.event_type).color
  const past = isPastEvent(event)
  const start = new Date(event.start_at)
  const recurrence = event.is_recurring ? recurrenceLabel(event.recurrence_rule) : null
  // Ocurrencias virtuales comparten el id del padre → pasamos su fecha para que
  // el detalle muestre la de esta ocurrencia, no la del padre.
  const isOccurrence = (event as AdminEvent & { occurrence_key?: string }).occurrence_key != null
  const href = isOccurrence
    ? `/eventos/${event.id}?date=${encodeURIComponent(event.start_at)}`
    : `/eventos/${event.id}`

  const body = (
    <>
      {/* Flyer o placeholder */}
      <div className="relative h-36 w-full overflow-hidden">
        {event.flyer_url ? (
          <Image
            src={event.flyer_url}
            alt={`Flyer de ${event.name}`}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: typeColor + '1A', color: typeColor }}>
            <Calendar size={36} strokeWidth={1.5} />
          </div>
        )}
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
          {past ? <RealizadoBadge /> : <EventStatusBadge status={event.status} />}
          {event.is_recurring && (
            <span className="inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-medium text-navy-light/80 font-body">
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
          <p className="flex items-center gap-1.5 text-[13px] text-navy-light/80 font-body">
            <Clock size={13} className="shrink-0 text-navy-light/80" />
            {start.toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}
            {' · '}
            {start.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', hour12: true })}
          </p>
          {event.location && (
            <p className="flex items-center gap-1.5 text-[13px] text-navy-light/80 font-body">
              <MapPin size={13} className="shrink-0 text-navy-light/80" />
              <span className="truncate">{event.location}</span>
            </p>
          )}
        </div>
      </div>
    </>
  )

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-surface-card shadow-[var(--shadow-md)] transition-shadow hover:shadow-[var(--shadow-lg)]">
      {linkToDetail ? (
        <Link href={href} className="group flex flex-col">{body}</Link>
      ) : (
        <div className="flex flex-col">{body}</div>
      )}
      {eligibility && (
        <div className="border-t border-[var(--outline-variant)] p-3">
          {eligibility.is_eligible ? (
            <button
              type="button"
              onClick={onRegister}
              className="w-full rounded-xl bg-coral/10 hover:bg-coral/20 px-4 py-2 text-[13px] font-medium text-coral transition-colors font-body"
            >
              Inscribirme
            </button>
          ) : eligibility.already_registered ? (
            <span className="block text-center rounded-xl bg-teal-soft/20 px-4 py-2 text-[13px] font-medium text-teal-deep font-body">
              Ya inscrito/a
            </span>
          ) : (
            <span className="block text-center text-[13px] text-navy-light/80 font-body">
              {eligibility.reasons_blocked[0] ?? 'No disponible'}
            </span>
          )}
          {eligibility.requires_payment && !eligibility.exempt && eligibility.is_eligible && onRequestScholarship && (
            <button
              type="button"
              onClick={onRequestScholarship}
              className="mt-1.5 w-full text-center text-[13px] text-coral hover:text-coral-deep transition-colors font-body underline decoration-dotted"
            >
              ¿Necesitás ayuda para pagar? Solicitar beca
            </button>
          )}
        </div>
      )}
    </div>
  )
}
