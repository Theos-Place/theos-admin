import { cn } from '@/lib/utils'
import { Clock } from 'lucide-react'

const SECTION_TITLE = 'text-[10px] uppercase tracking-widest text-navy-light/60 font-display'

const TIMEZONES = [
  { value: 'America/Costa_Rica', label: 'Costa Rica (GMT-6)' },
  { value: 'America/New_York',   label: 'Este EE.UU. (GMT-5/-4)' },
  { value: 'America/Chicago',    label: 'Centro EE.UU. (GMT-6/-5)' },
  { value: 'America/Los_Angeles',label: 'Pacífico EE.UU. (GMT-8/-7)' },
  { value: 'Europe/Madrid',      label: 'España (GMT+1/+2)' },
]

type Props = {
  scheduled: boolean
  setScheduled: (v: boolean) => void
  scheduledAt: string
  setScheduledAt: (v: string) => void
  timezone: string
  setTimezone: (v: string) => void
}

export function ScheduleSection({
  scheduled,
  setScheduled,
  scheduledAt,
  setScheduledAt,
  timezone,
  setTimezone,
}: Props) {
  return (
    <div className="rounded-2xl p-5 space-y-4 bg-surface-card shadow-[var(--shadow-md)]">
      <p className={cn(SECTION_TITLE)}>
        4 · Programar (opcional)
      </p>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-navy font-body">¿Programar envío?</p>
          <p className="text-[12px] text-navy-light/60 mt-0.5 font-body">
            Elegí cuándo enviar el mensaje
          </p>
        </div>
        <button
          type="button"
          onClick={() => setScheduled(!scheduled)}
          className={cn(
            'relative h-6 w-11 rounded-full transition-colors',
            scheduled ? 'bg-coral' : 'bg-navy/20'
          )}
        >
          <span className={cn('absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', scheduled ? 'translate-x-5' : 'translate-x-0')} />
        </button>
      </div>
      {scheduled && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] text-navy-light/60 font-body flex items-center gap-1.5">
              <Clock size={13} className="text-navy-light/60 shrink-0" /> Fecha y hora
            </label>
            <input
              type="datetime-local"
              className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-navy-light/60 font-body">Zona horaria</label>
            <select
              className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
            >
              {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  )
}
