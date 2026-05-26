import { ExternalLink } from 'lucide-react'
import { RecurrenceSelector } from '@/components/events/RecurrenceSelector'
import { inputCls, Toggle, FieldLabel } from './shared'

interface Step2Props {
  start_date: string
  start_time: string
  end_date: string
  end_time: string
  is_virtual: boolean
  location: string
  location_map_url: string
  is_recurring: boolean
  recurrence_rule: string | null
  onStartDateChange: (v: string) => void
  onStartTimeChange: (v: string) => void
  onEndDateChange: (v: string) => void
  onEndTimeChange: (v: string) => void
  onToggleVirtual: () => void
  onLocationChange: (v: string) => void
  onLocationMapUrlChange: (v: string) => void
  onToggleRecurring: () => void
  onRecurrenceRuleChange: (v: string | null) => void
}

export function Step2Programacion({
  start_date,
  start_time,
  end_date,
  end_time,
  is_virtual,
  location,
  location_map_url,
  is_recurring,
  recurrence_rule,
  onStartDateChange,
  onStartTimeChange,
  onEndDateChange,
  onEndTimeChange,
  onToggleVirtual,
  onLocationChange,
  onLocationMapUrlChange,
  onToggleRecurring,
  onRecurrenceRuleChange,
}: Step2Props) {
  return (
    <div className="card" style={{ padding: '20px 24px', width: '100%' }}>
      <div className="card-title" style={{ marginBottom: 20 }}>Programación y ubicación</div>

      {/* Fechas */}
      <div style={{ marginBottom: 20 }}>
        <div className="form-row">
          <div>
            <FieldLabel>Fecha inicio</FieldLabel>
            <input
              type="date"
              className={inputCls}
              style={{ fontFamily: 'var(--font-body)' }}
              value={start_date}
              onChange={e => onStartDateChange(e.target.value)}
            />
          </div>
          <div>
            <FieldLabel>Hora inicio</FieldLabel>
            <input
              type="time"
              className={inputCls}
              style={{ fontFamily: 'var(--font-body)' }}
              value={start_time}
              onChange={e => onStartTimeChange(e.target.value)}
            />
          </div>
          <div>
            <FieldLabel>Fecha fin</FieldLabel>
            <input
              type="date"
              className={inputCls}
              style={{ fontFamily: 'var(--font-body)' }}
              value={end_date}
              onChange={e => onEndDateChange(e.target.value)}
            />
          </div>
          <div>
            <FieldLabel>Hora fin</FieldLabel>
            <input
              type="time"
              className={inputCls}
              style={{ fontFamily: 'var(--font-body)' }}
              value={end_time}
              onChange={e => onEndTimeChange(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Ubicación */}
      <div
        className="pt-4 border-t space-y-4"
        style={{ borderColor: 'var(--outline-variant)', marginBottom: 20 }}
      >
        <Toggle
          checked={is_virtual}
          onToggle={onToggleVirtual}
          label="Evento virtual"
        />
        {!is_virtual && (
          <div className="space-y-3 pl-14">
            <div>
              <FieldLabel>Dirección</FieldLabel>
              <input
                className={inputCls}
                style={{ fontFamily: 'var(--font-body)' }}
                placeholder="Dirección exacta del evento..."
                value={location}
                onChange={e => onLocationChange(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Link Waze / Google Maps</FieldLabel>
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  style={{ fontFamily: 'var(--font-body)' }}
                  placeholder="https://maps.google.com/..."
                  value={location_map_url}
                  onChange={e => onLocationMapUrlChange(e.target.value)}
                />
                {location_map_url && (
                  <a
                    href={location_map_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] text-navy-light hover:bg-surface-low transition-colors"
                    style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                  >
                    <ExternalLink size={13} />
                    Probar
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recurrencia */}
      <div
        className="pt-4 border-t space-y-4"
        style={{ borderColor: 'var(--outline-variant)' }}
      >
        <Toggle
          checked={is_recurring}
          onToggle={onToggleRecurring}
          label="Evento recurrente"
        />
        {is_recurring && (
          <div className="pl-14">
            <RecurrenceSelector
              value={recurrence_rule}
              onChange={onRecurrenceRuleChange}
            />
          </div>
        )}
      </div>
    </div>
  )
}
