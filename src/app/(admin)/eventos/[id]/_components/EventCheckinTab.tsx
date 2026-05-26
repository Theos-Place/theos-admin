import { CapacityBar } from '@/components/events/CapacityBar'
import { cn } from '@/lib/utils'
import { getEvent } from '@/data/mock-events'

type Event = NonNullable<ReturnType<typeof getEvent>>

const AVATAR_COLORS: Record<string, string> = {
  A: 'bg-coral', B: 'bg-teal-deep', C: 'bg-navy', D: 'bg-purple-700', E: 'bg-amber-500',
  F: 'bg-coral', G: 'bg-teal-deep', H: 'bg-navy', I: 'bg-purple-700', J: 'bg-amber-500',
  K: 'bg-coral', L: 'bg-teal-deep', M: 'bg-navy', N: 'bg-purple-700', O: 'bg-amber-500',
  P: 'bg-coral', Q: 'bg-teal-deep', R: 'bg-navy', S: 'bg-purple-700', T: 'bg-amber-500',
  U: 'bg-coral', V: 'bg-teal-deep', W: 'bg-navy', X: 'bg-purple-700', Y: 'bg-amber-500', Z: 'bg-coral',
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}
function avatarColor(name: string) {
  return AVATAR_COLORS[name.charAt(0).toUpperCase()] ?? 'bg-navy'
}

type Props = {
  event: Event
  checkinCount: number
}

export function EventCheckinTab({ event, checkinCount }: Props) {
  return (
    <div className="space-y-4">
      {event.sub_events.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {event.sub_events.map(se => {
            const seCheckins = event.checkins.filter(c => c.sub_event_id === se.id).length
            return (
              <div key={se.id} className="rounded-2xl p-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
                <p className="text-[10px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>{se.name}</p>
                <p className="mt-1 text-3xl font-extrabold text-navy tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>{seCheckins}</p>
                <CapacityBar current={seCheckins} max={se.max_capacity} />
              </div>
            )
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
          {checkinCount} check-ins registrados
        </p>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--outline-variant)' }}>
          <p className="text-[10px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Últimos check-ins</p>
        </div>
        {event.checkins.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>Aún no hay check-ins registrados.</p>
          </div>
        ) : (
          <div>
            {event.checkins.slice(0, 10).map((ci, idx) => (
              <div
                key={`${ci.member_id}-${idx}`}
                className={cn('flex items-center gap-3 px-4 py-3', idx % 2 === 1 ? 'bg-surface-low/40' : '')}
              >
                <div className={cn('h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0', avatarColor(ci.member_name))}>
                  {getInitials(ci.member_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-navy truncate" style={{ fontFamily: 'var(--font-body)' }}>{ci.member_name}</p>
                  <p className="text-[11px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
                    {new Date(ci.checked_at).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
                    {ci.sub_event_id && ` · ${ci.sub_event_id}`}
                  </p>
                </div>
                <span className={cn(
                  'rounded-md px-2 py-0.5 text-[10px] font-medium',
                  ci.attendance_type === 'server' ? 'bg-coral/10 text-coral' : 'bg-teal-soft/30 text-teal-deep'
                )}>
                  {ci.attendance_type === 'server' ? 'Servidor' : 'Participante'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
