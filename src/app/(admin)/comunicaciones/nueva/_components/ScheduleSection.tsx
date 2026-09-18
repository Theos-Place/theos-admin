import { cn } from '@/lib/utils'
import { Clock } from 'lucide-react'
import {
  TICK_MINUTES, HORAS_EN_PUNTO, partesDeLaProgramacion, componerProgramacion,
} from '@/lib/communications/schedule'

const SECTION_TITLE = 'text-[11px] uppercase tracking-widest text-navy-light/80 font-display'

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
  // El estado sigue siendo UN string ('YYYY-MM-DDTHH:00'): así el resto del
  // formulario y la validación no se enteran de que la pantalla cambió.
  const { dia, hora } = partesDeLaProgramacion(scheduledAt)

  return (
    <div className="rounded-2xl p-5 space-y-4 bg-surface-card shadow-[var(--shadow-md)]">
      <p className={cn(SECTION_TITLE)}>
        4 · Programar (opcional)
      </p>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-navy font-body">¿Programar envío?</p>
          <p className="text-[13px] text-navy-light/80 mt-0.5 font-body">
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
            <span className={cn('text-[13px] text-navy-light/80 font-body flex items-center gap-1.5')}>
              <Clock size={13} className="text-navy-light/80 shrink-0" aria-hidden /> Fecha y hora
            </span>
            {/* DÍA Y HORA POR SEPARADO, y no un datetime-local.
                Comprobado en el navegador el 2026-09-18: `step=3600` NO alcanza
                —el campo igual dibuja los minutos, deja escribir "15:37" y solo
                protesta al enviar, con un mensaje del navegador en inglés—. O
                sea que ofrecía una precisión que el cron no puede cumplir.
                Con una lista de 24 horas, el minuto no existe en la pantalla.
                El servidor sigue validando aparte (minutos_no_cero). */}
            <div className="flex gap-2">
              <input
                id="fecha-envio"
                type="date"
                aria-label="Día del envío"
                className="flex-1 min-w-0 rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
                value={dia}
                onChange={e => setScheduledAt(componerProgramacion(e.target.value, hora))}
              />
              <select
                id="hora-envio"
                aria-label="Hora del envío"
                className="rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
                value={hora}
                onChange={e => setScheduledAt(componerProgramacion(dia, e.target.value))}
              >
                <option value="">Hora…</option>
                {HORAS_EN_PUNTO.map(h => (
                  <option key={h.valor} value={h.valor}>{h.etiqueta}</option>
                ))}
              </select>
            </div>
            <p className="text-[13px] text-navy-light/80 font-body">
              Los envíos salen en horas en punto. La cola se revisa cada hora, así que puede salir
              hasta {TICK_MINUTES} minutos después.
            </p>
          </div>
          <div className="space-y-1">
            <label htmlFor="zona-horaria" className="text-[13px] text-navy-light/80 font-body">Zona horaria</label>
            <select id="zona-horaria"
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
