import { useRef } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import { CapacityBar } from '@/components/events/CapacityBar'
import { cn } from '@/lib/utils'
import { useOrg } from '@/lib/org'
import type { MockEvent } from '@/data/event-config'
import { MAX_FILE_SIZE_BYTES } from '@/lib/constants'

type Event = MockEvent

type Props = {
  event: Event
  flyerPreview: string | null
  flyerDragOver: boolean
  flyerInputRef: React.RefObject<HTMLInputElement | null>
  onFlyerSelect: (file: File) => void
  onFlyerDragOver: (val: boolean) => void
  onFlyerClear: () => void
}

export function EventInfoTab({
  event,
  flyerPreview,
  flyerDragOver,
  flyerInputRef,
  onFlyerSelect,
  onFlyerDragOver,
  onFlyerClear,
}: Props) {
  const { adminCommittees } = useOrg()
  const committeeName = adminCommittees.find(c => c.id === event.committee_id)?.name ?? event.committee_id
  const startDate = new Date(event.start_at)
  const endDate = new Date(event.end_at)

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="rounded-2xl p-5 space-y-4 bg-surface-card shadow-[var(--shadow-md)]">
        <h3 className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display">Descripción</h3>
        <p className="text-sm text-navy-light/70 leading-relaxed font-body">{event.description}</p>
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-t-[var(--outline-variant)]">
          {[
            { label: 'Tipo', value: event.event_type },
            { label: 'Comité', value: committeeName },
            { label: 'Inicio', value: startDate.toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
            { label: 'Fin', value: endDate.toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
            { label: 'Ubicación', value: event.location },
            { label: 'Virtual', value: event.is_virtual ? 'Sí' : 'No' },
            { label: 'Inscripción', value: event.requires_registration ? 'Requerida' : 'Libre' },
            { label: 'Capacidad', value: `${event.max_capacity} personas` },
          ].map(({ label, value }) => (
            <div key={label} className="space-y-0.5">
              <p className="text-[10px] tracking-widests uppercase text-navy-light/60 font-display">{label}</p>
              <p className="text-sm text-navy font-body">{value}</p>
            </div>
          ))}
        </div>
        {event.is_virtual && event.virtual_url && (
          <div className="space-y-0.5 pt-2 border-t border-t-[var(--outline-variant)]">
            <p className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display">Link de la reunión</p>
            <a
              href={event.virtual_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-coral hover:underline break-all font-body"
            >
              {event.virtual_url}
            </a>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {event.sub_events.length > 0 && (
          <div className="rounded-2xl p-4 bg-surface-card shadow-[var(--shadow-md)]">
            <h3 className="text-[10px] tracking-widests uppercase text-navy-light/60 mb-3 font-display">Sub-eventos</h3>
            <div className="space-y-2">
              {event.sub_events.map(se => {
                const seCheckins = event.checkins.filter(c => c.sub_event_id === se.id).length
                return (
                  <div key={se.id} className="rounded-xl px-3 py-2.5 bg-surface-low">
                    <p className="text-sm font-medium text-navy font-body">{se.name}</p>
                    <CapacityBar current={seCheckins} max={se.max_capacity} />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="rounded-2xl p-4 space-y-3 bg-surface-card shadow-[var(--shadow-md)]">
          <h3 className="text-[10px] tracking-widests uppercase text-navy-light/60 font-display">Configuración</h3>
          {[
            { label: 'Recurrente', value: event.is_recurring ? event.recurrence_rule ?? 'Sí' : 'No' },
            { label: 'Encuesta', value: event.requires_survey ? 'Requerida' : 'No' },
            { label: 'Pago', value: event.requires_payment ? `₡${event.payment_amount?.toLocaleString()}` : 'Gratuito' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <span className="text-navy-light/60 font-body">{label}</span>
              <span className="text-navy font-medium font-body">{value}</span>
            </div>
          ))}
        </div>

        {/* Flyer */}
        <div className="rounded-2xl p-4 space-y-3 bg-surface-card shadow-[var(--shadow-md)]">
          <h3 className="text-[10px] tracking-widests uppercase text-navy-light/60 font-display">Flyer / Banner</h3>
          <input
            ref={flyerInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f && f.size <= MAX_FILE_SIZE_BYTES) onFlyerSelect(f)
            }}
          />
          {!flyerPreview ? (
            <div
              onDragOver={(e) => { e.preventDefault(); onFlyerDragOver(true) }}
              onDragLeave={() => onFlyerDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                onFlyerDragOver(false)
                const f = e.dataTransfer.files[0]
                if (f?.type.startsWith('image/')) onFlyerSelect(f)
              }}
              onClick={() => flyerInputRef.current?.click()}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border-2 border-dashed py-6 cursor-pointer transition-all',
                flyerDragOver ? 'border-coral bg-coral/5' : 'border-[rgba(22,20,64,0.15)] hover:border-coral/40 hover:bg-surface-low'
              )}
            >
              <ImageIcon size={24} className="text-navy-light/60" />
              <p className="text-[12px] font-medium text-navy-light/60 font-body">
                Subir flyer
              </p>
              <p className="text-[10px] text-navy-light/60 font-body">
                PNG, JPG, WebP — máx 5MB
              </p>
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden border border-[var(--outline-variant)]">
              <img src={flyerPreview} alt="Flyer del evento" className="w-full object-cover max-h-40" />
              <div className="absolute bottom-0 inset-x-0 flex gap-2 justify-end p-2 bg-[rgba(22,20,64,0.6)]">
                <button type="button" onClick={() => flyerInputRef.current?.click()}
                  className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-white bg-white/20 hover:bg-white/30 transition-colors font-body">
                  Cambiar
                </button>
                <button type="button" onClick={onFlyerClear}
                  className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-coral bg-coral/20 hover:bg-coral/30 transition-colors font-body">
                  Eliminar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
