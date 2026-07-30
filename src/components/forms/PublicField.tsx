'use client'

import { cn } from '@/lib/utils'
import type { FormFieldNew } from '@/data/form-config'

interface PublicFieldProps {
  field: FormFieldNew
  value: string | string[] | number | undefined
  onChange: (value: string | string[] | number) => void
}

export function PublicField({ field, value, onChange }: PublicFieldProps) {
  const inputBase = 'w-full rounded-xl border px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 transition-colors border-[var(--outline-variant)] bg-surface-low'

  // EST-10: bloque de TEXTO INFORMATIVO — sin input. El cuerpo va en
  // `description` (el label es el título opcional del bloque).
  if (field.type === 'info') {
    return (
      <div className="rounded-xl bg-surface-low border border-[var(--outline-variant)] px-4 py-3.5 space-y-1.5">
        {field.label && (
          <p className="text-[13px] font-bold text-navy font-display">{field.label}</p>
        )}
        {field.description && (
          <div className="text-[13px] text-navy-light/80 font-body leading-relaxed whitespace-pre-line">
            {field.description}
          </div>
        )}
      </div>
    )
  }

  if (field.type === 'section') {
    return (
      <div className="pt-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[var(--outline-variant)]" />
          <span className="text-[11px] uppercase tracking-widest font-semibold text-navy-light/60 font-display">
            {field.label}
          </span>
          <div className="flex-1 h-px bg-[var(--outline-variant)]" />
        </div>
      </div>
    )
  }

  const stringVal = typeof value === 'string' ? value : ''
  const numVal = typeof value === 'number' ? value : undefined
  const arrayVal = Array.isArray(value) ? value : []

  if (field.type === 'text' || field.type === 'number') {
    return (
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        placeholder={field.placeholder || ''}
        value={field.type === 'number' ? (numVal ?? '') : stringVal}
        onChange={e => onChange(field.type === 'number' ? Number(e.target.value) : e.target.value)}
        className={inputBase}
      />
    )
  }

  if (field.type === 'date') {
    return (
      <input
        type="date"
        value={stringVal}
        onChange={e => onChange(e.target.value)}
        className={inputBase}
      />
    )
  }

  if (field.type === 'textarea') {
    return (
      <textarea
        rows={4}
        placeholder={field.placeholder || ''}
        value={stringVal}
        onChange={e => onChange(e.target.value)}
        className={cn(inputBase, 'resize-none')}
      />
    )
  }

  if (field.type === 'select') {
    return (
      <select
        value={stringVal}
        onChange={e => onChange(e.target.value)}
        className={inputBase}
      >
        <option value="">Seleccionar...</option>
        {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }

  if (field.type === 'radio') {
    return (
      <div className="space-y-2">
        {field.options?.map(o => (
          <label
            key={o}
            className={cn(
              'flex items-center gap-3 rounded-xl border px-4 py-2.5 cursor-pointer transition-all',
              stringVal === o
                ? 'border-coral bg-coral/5'
                : 'hover:bg-surface-low'
            )}
            style={{ borderColor: stringVal === o ? undefined : 'var(--outline-variant)' }}
          >
            <input
              type="radio"
              className="accent-coral"
              checked={stringVal === o}
              onChange={() => onChange(o)}
            />
            <span className="text-sm text-navy font-body">{o}</span>
          </label>
        ))}
      </div>
    )
  }

  if (field.type === 'checkbox') {
    return (
      <div className="space-y-2">
        {field.options?.map(o => {
          const checked = arrayVal.includes(o)
          return (
            <label
              key={o}
              className={cn(
                'flex items-center gap-3 rounded-xl border px-4 py-2.5 cursor-pointer transition-all',
                checked ? 'border-coral bg-coral/5' : 'hover:bg-surface-low'
              )}
              style={{ borderColor: checked ? undefined : 'var(--outline-variant)' }}
            >
              <input
                type="checkbox"
                className="accent-coral"
                checked={checked}
                onChange={() => {
                  onChange(checked ? arrayVal.filter(v => v !== o) : [...arrayVal, o])
                }}
              />
              <span className="text-sm text-navy font-body">{o}</span>
            </label>
          )
        })}
      </div>
    )
  }

  if (field.type === 'scale') {
    const min = field.scale_min ?? 1
    const max = field.scale_max ?? 5
    const nums = Array.from({ length: max - min + 1 }, (_, i) => min + i)
    return (
      <div className="space-y-2">
        <div className="flex gap-1.5 flex-wrap">
          {nums.map(n => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={cn(
                'h-10 w-10 rounded-xl text-sm font-semibold border transition-all font-mono',
                numVal === n
                  ? 'bg-coral text-white border-coral'
                  : 'hover:bg-surface-low text-navy-light/60 border-outline-variant'
              )}
              style={{
                borderColor: numVal === n ? undefined : 'var(--outline-variant)',
              }}
            >
              {n}
            </button>
          ))}
        </div>
        {(field.scale_min_label || field.scale_max_label) && (
          <div className="flex justify-between px-1">
            <span className="text-[11px] text-navy-light/60 font-body">{field.scale_min_label}</span>
            <span className="text-[11px] text-navy-light/60 font-body">{field.scale_max_label}</span>
          </div>
        )}
      </div>
    )
  }

  if (field.type === 'yes_no') {
    return (
      <div className="flex gap-3">
        {['Sí', 'No'].map(v => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              'flex-1 rounded-xl border py-3 text-sm font-semibold transition-all font-body',
              stringVal === v
                ? v === 'Sí' ? 'bg-teal-deep text-white border-teal-deep' : 'bg-coral text-white border-coral'
                : 'text-navy-light/60 hover:bg-surface-low'
            )}
            style={{
              borderColor: stringVal === v ? undefined : 'var(--outline-variant)',
            }}
          >
            {v}
          </button>
        ))}
      </div>
    )
  }

  return null
}
