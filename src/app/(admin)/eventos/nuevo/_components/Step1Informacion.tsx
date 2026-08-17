import { Mic, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type EventType } from '@/data/event-config'
import { useEventTypes } from '@/hooks/useEventTypes'
import { CommitteeMultiSelect } from '@/components/events/CommitteeMultiSelect'
import { inputCls, ICON_MAP, FieldLabel } from './shared'

interface Step1Props {
  name: string
  event_type: EventType | ''
  organizing_committee_ids: string[]
  description: string
  flyer: string | null
  flyerDragOver: boolean
  flyerInputRef: React.RefObject<HTMLInputElement | null>
  onNameChange: (v: string) => void
  onEventTypeChange: (v: EventType) => void
  onCommitteesChange: (ids: string[]) => void
  onDescriptionChange: (v: string) => void
  onFlyerSelect: (file: File) => void
  onFlyerDragOver: (v: boolean) => void
  onFlyerRemove: () => void
}

export function Step1Informacion({
  name,
  event_type,
  organizing_committee_ids,
  description,
  flyer,
  flyerDragOver,
  flyerInputRef,
  onNameChange,
  onEventTypeChange,
  onCommitteesChange,
  onDescriptionChange,
  onFlyerSelect,
  onFlyerDragOver,
  onFlyerRemove,
}: Step1Props) {
  const activeEventTypes = useEventTypes() // catálogo real de la BD (solo activos)
  return (
    <div className="card py-5 px-6 w-full">
      <div className="card-title mb-5">Información principal</div>

      {/* Nombre */}
      <div className="mb-5">
        <input
          className="w-full border-0 border-b border-b-2 border-b-[var(--outline-variant)] bg-transparent pb-2 text-2xl font-bold text-navy outline-none placeholder:text-navy-light/50 transition-colors font-display"
          placeholder="Nombre del evento..."
          value={name}
          onChange={e => onNameChange(e.target.value)}
        />
      </div>

      {/* Tipo de evento */}
      <div className="mb-5">
        <FieldLabel>Tipo de evento</FieldLabel>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {activeEventTypes.map(t => {
            const Icon = ICON_MAP[t.icon] ?? Mic
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onEventTypeChange(t.id as EventType)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all duration-150',
                  event_type === t.id
                    ? 'border-coral bg-coral/5 text-coral'
                    : 'text-navy-light/70 hover:bg-surface-low',
                )}
                style={{ borderColor: event_type === t.id ? undefined : 'var(--outline-variant)' }}
              >
                <Icon size={18} />
                <span
                  className="text-[12px] font-medium font-display"
                >
                  {t.name}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Comité + Descripción en grid */}
      <div className="form-row mb-5">
        <div>
          <FieldLabel>Comités organizadores</FieldLabel>
          <CommitteeMultiSelect
            value={organizing_committee_ids}
            onChange={onCommitteesChange}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <FieldLabel>Descripción</FieldLabel>
            <span
              className="text-[11px] text-navy-light/70 font-mono"
            >
              {description.length}/500
            </span>
          </div>
          <textarea
            className={cn(inputCls, 'resize-none', 'font-body')}
            rows={3}
            maxLength={500}
            placeholder="Describe el evento..."
            value={description}
            onChange={e => onDescriptionChange(e.target.value)}
          />
        </div>
      </div>

      {/* Flyer */}
      <div>
        <FieldLabel>Flyer o banner del evento</FieldLabel>
        <input
          ref={flyerInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) onFlyerSelect(f)
          }}
        />
        {!flyer ? (
          <div
            onDragOver={e => { e.preventDefault(); onFlyerDragOver(true) }}
            onDragLeave={() => onFlyerDragOver(false)}
            onDrop={e => {
              e.preventDefault()
              onFlyerDragOver(false)
              const f = e.dataTransfer.files[0]
              if (f?.type.startsWith('image/')) onFlyerSelect(f)
            }}
            onClick={() => flyerInputRef.current?.click()}
            className={cn(
              'flex flex-col items-center gap-2 rounded-xl border-2 border-dashed py-8 cursor-pointer transition-all',
              flyerDragOver
                ? 'border-coral bg-coral/5'
                : 'border-[rgba(22,20,64,0.15)] hover:border-coral/40 hover:bg-surface-low',
            )}
          >
            <ImageIcon size={28} className="text-navy-light/70" />
            <p
              className="text-[13px] font-medium text-navy-light/70 font-body"
            >
              Subí el flyer del evento
            </p>
            <p
              className="text-[12px] text-navy-light/70 font-body"
            >
              PNG, JPG, WebP — máx 5MB · Recomendado: 1200×630px
            </p>
          </div>
        ) : (
          <div
            className="relative rounded-xl overflow-hidden border border-[var(--outline-variant)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- preview local (blob/dataURL de un archivo recién elegido); next/image no lo optimiza. */}
            <img src={flyer} alt="Flyer del evento" className="w-full object-cover max-h-48" />
            <div
              className="absolute bottom-0 inset-x-0 flex gap-2 justify-end p-2 bg-[rgba(22,20,64,0.6)]"
            >
              <button
                type="button"
                onClick={() => flyerInputRef.current?.click()}
                className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-white bg-white/20 hover:bg-white/30 transition-colors font-body"
              >
                Cambiar
              </button>
              <button
                type="button"
                onClick={onFlyerRemove}
                className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-coral bg-coral/20 hover:bg-coral/30 transition-colors font-body"
              >
                Eliminar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
