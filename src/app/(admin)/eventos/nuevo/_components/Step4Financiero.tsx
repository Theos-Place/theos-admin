import { cn } from '@/lib/utils'
import { type EventType } from '@/data/event-config'
import { inputCls, Toggle, SummaryRow, FieldLabel } from './shared'

type SubEventInput = { id: string; name: string; max_capacity: string }

interface Step4Props {
  requires_payment: boolean
  payment_amount: string
  payment_methods: string[]
  // resumen
  name: string
  event_type: EventType | ''
  selectedTypeName: string | undefined
  committee: string
  start_date: string
  start_time: string
  is_virtual: boolean
  location: string
  location_map_url: string
  is_recurring: boolean
  sub_events: SubEventInput[]
  requires_registration: boolean
  max_capacity: string
  onTogglePayment: () => void
  onPaymentAmountChange: (v: string) => void
  onTogglePaymentMethod: (m: string) => void
}

export function Step4Financiero({
  requires_payment,
  payment_amount,
  payment_methods,
  name,
  selectedTypeName,
  committee,
  start_date,
  start_time,
  is_virtual,
  location,
  location_map_url,
  is_recurring,
  sub_events,
  requires_registration,
  max_capacity,
  onTogglePayment,
  onPaymentAmountChange,
  onTogglePaymentMethod,
}: Step4Props) {
  return (
    <div className="space-y-4">
      {/* Pago */}
      <div className="card py-5 px-6 w-full">
        <div className="card-title mb-4">Financiero</div>
        <div className="space-y-4">
          <Toggle
            checked={requires_payment}
            onToggle={onTogglePayment}
            label="Evento con cobro"
          />
          {requires_payment && (
            <div className="space-y-3 pl-14">
              <div className="form-row">
                <div>
                  <FieldLabel>Monto</FieldLabel>
                  <div className="relative">
                    <span
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-navy-light/60 font-mono"
                    >
                      ₡
                    </span>
                    <input
                      type="number"
                      className={cn(inputCls, 'pl-7', 'font-body')}
                      placeholder="15000"
                      value={payment_amount}
                      onChange={e => onPaymentAmountChange(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel>Métodos de pago</FieldLabel>
                  <div className="flex flex-wrap gap-4 pt-2">
                    {['Tarjeta', 'SINPE Móvil'].map(m => (
                      <label key={m} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="accent-coral"
                          checked={payment_methods.includes(m)}
                          onChange={() => onTogglePaymentMethod(m)}
                        />
                        <span
                          className="text-sm text-navy font-body"
                        >
                          {m}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Resumen */}
      <div className="card py-5 px-6 w-full">
        <div className="card-title mb-4">Resumen del evento</div>
        <div className="space-y-1">
          <SummaryRow label="Nombre" value={name || '—'} />
          <SummaryRow label="Tipo" value={selectedTypeName ?? '—'} />
          <SummaryRow label="Comité" value={committee || '—'} />
          <SummaryRow
            label="Fecha inicio"
            value={
              start_date
                ? new Date(`${start_date}T${start_time || '00:00'}`).toLocaleString('es-CR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—'
            }
          />
          <SummaryRow label="Lugar" value={is_virtual ? 'Virtual' : location || '—'} />
          {location_map_url && !is_virtual && (
            <SummaryRow
              label="Mapa"
              value={
                <a
                  href={location_map_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-coral underline"
                >
                  Ver enlace
                </a>
              }
            />
          )}
          <SummaryRow label="Recurrente" value={is_recurring ? 'Sí' : 'No'} />
          <SummaryRow
            label="Sub-eventos"
            value={sub_events.length > 0 ? sub_events.map(s => s.name).join(', ') : 'Ninguno'}
          />
          <SummaryRow
            label="Inscripción"
            value={
              requires_registration
                ? `Sí${max_capacity ? ` · Cap. ${max_capacity}` : ''}`
                : 'No requerida'
            }
          />
          <SummaryRow
            label="Cobro"
            value={
              requires_payment && payment_amount
                ? `₡${Number(payment_amount).toLocaleString('es-CR')}`
                : 'Gratuito'
            }
          />
        </div>
      </div>
    </div>
  )
}
