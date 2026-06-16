import { cn } from '@/lib/utils'
import type { FormFieldNew } from '@/data/form-config'

interface FieldPreviewProps {
  field: FormFieldNew
  compact?: boolean
}

export function FieldPreview({ field, compact }: FieldPreviewProps) {
  const inputBase = 'w-full rounded-xl bg-white/60 border px-3 py-2 text-sm text-navy-light/60 cursor-not-allowed border-[var(--outline-variant)]'

  if (field.type === 'section') {
    return (
      <div className="flex items-center gap-3 py-1">
        <div className="flex-1 h-px bg-[var(--outline-variant)]" />
        <span className="text-[11px] uppercase tracking-widest font-semibold text-navy-light/60 font-display">
          {field.label || 'Sección'}
        </span>
        <div className="flex-1 h-px bg-[var(--outline-variant)]" />
      </div>
    )
  }

  if (field.type === 'page_break') {
    return (
      <div className="flex items-center gap-3 py-1">
        <div className="flex-1 h-px border-dashed border-t-2 border-[var(--outline-variant)]" />
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--outline-variant)]">
          <span className="text-[10px] uppercase tracking-widest font-semibold text-blue-500 font-display">
            📄 {field.label || 'Nueva página'}
          </span>
        </div>
        <div className="flex-1 h-px border-dashed border-t-2 border-[var(--outline-variant)]" />
      </div>
    )
  }

  if (field.type === 'text' || field.type === 'number') {
    return (
      <input
        disabled
        type={field.type === 'number' ? 'number' : 'text'}
        placeholder={field.placeholder || field.label}
        className={inputBase}
      />
    )
  }

  if (field.type === 'date') {
    return (
      <input
        disabled
        type="date"
        className={inputBase}
      />
    )
  }

  if (field.type === 'textarea') {
    return (
      <textarea
        disabled
        rows={compact ? 2 : 3}
        placeholder={field.placeholder || field.label}
        className={cn(inputBase, 'resize-none')}
      />
    )
  }

  if (field.type === 'select') {
    return (
      <select disabled className={inputBase}>
        <option>Seleccionar...</option>
        {field.options?.map(o => <option key={o}>{o}</option>)}
      </select>
    )
  }

  if (field.type === 'radio') {
    const opts = field.options ?? []
    return (
      <div className="space-y-1.5">
        {opts.slice(0, compact ? 3 : opts.length).map(o => (
          <label key={o} className="flex items-center gap-2 cursor-not-allowed opacity-60">
            <input type="radio" disabled className="accent-coral" />
            <span className="text-sm text-navy-light/60 font-body">{o}</span>
          </label>
        ))}
        {compact && opts.length > 3 && (
          <span className="text-[11px] text-navy-light/60 font-body">
            +{opts.length - 3} más...
          </span>
        )}
      </div>
    )
  }

  if (field.type === 'checkbox') {
    const opts = field.options ?? []
    return (
      <div className="space-y-1.5">
        {opts.slice(0, compact ? 3 : opts.length).map(o => (
          <label key={o} className="flex items-center gap-2 cursor-not-allowed opacity-60">
            <input type="checkbox" disabled className="accent-coral" />
            <span className="text-sm text-navy-light/60 font-body">{o}</span>
          </label>
        ))}
        {compact && opts.length > 3 && (
          <span className="text-[11px] text-navy-light/60 font-body">
            +{opts.length - 3} más...
          </span>
        )}
      </div>
    )
  }

  if (field.type === 'scale') {
    const min = field.scale_min ?? 1
    const max = field.scale_max ?? 5
    const nums = Array.from({ length: max - min + 1 }, (_, i) => min + i)
    return (
      <div className="space-y-1">
        <div className="flex gap-1 flex-wrap">
          {nums.map(n => (
            <div
              key={n}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-[13px] font-medium text-navy-light/60 border cursor-not-allowed border-[var(--outline-variant)] font-mono"
            >
              {n}
            </div>
          ))}
        </div>
        {(field.scale_min_label || field.scale_max_label) && (
          <div className="flex justify-between">
            <span className="text-[10px] text-navy-light/60 font-body">{field.scale_min_label}</span>
            <span className="text-[10px] text-navy-light/60 font-body">{field.scale_max_label}</span>
          </div>
        )}
      </div>
    )
  }

  if (field.type === 'yes_no') {
    return (
      <div className="flex gap-2">
        {['Sí', 'No'].map(v => (
          <div
            key={v}
            className="flex-1 rounded-xl border py-2 text-center text-sm text-navy-light/60 cursor-not-allowed border-[var(--outline-variant)] font-body"
          >
            {v}
          </div>
        ))}
      </div>
    )
  }

  return null
}
