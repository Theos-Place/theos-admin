'use client'

import { useState } from 'react'
import { Plus, X, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FormFieldNew } from '@/data/mock-forms'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'

interface FieldInspectorProps {
  field: FormFieldNew
  allFields: FormFieldNew[]
  onChange: (updated: FormFieldNew) => void
}

export function FieldInspector({ field, allFields, onChange }: FieldInspectorProps) {
  const [condActive, setCondActive] = useState(!!field.conditional)

  function set<K extends keyof FormFieldNew>(key: K, value: FormFieldNew[K]) {
    onChange({ ...field, [key]: value })
  }

  function addOption() {
    set('options', [...(field.options ?? []), ''])
  }

  function updateOption(i: number, val: string) {
    const opts = [...(field.options ?? [])]
    opts[i] = val
    set('options', opts)
  }

  function removeOption(i: number) {
    set('options', (field.options ?? []).filter((_, idx) => idx !== i))
  }

  function toggleConditional(active: boolean) {
    setCondActive(active)
    if (!active) set('conditional', undefined)
    else set('conditional', { field_id: '', operator: 'eq', value: '' })
  }

  const otherFields = allFields.filter(f => f.id !== field.id && f.type !== 'section')

  if (field.type === 'section') {
    return (
      <div className="space-y-4 p-4">
        <p className="text-[10px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
          Separador de sección
        </p>
        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Título</label>
          <input className={inputCls} style={{ fontFamily: 'var(--font-body)' }} value={field.label} onChange={e => set('label', e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Texto de ayuda</label>
          <input className={inputCls} style={{ fontFamily: 'var(--font-body)' }} value={field.helper_text ?? ''} onChange={e => set('helper_text', e.target.value || undefined)} />
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto">
      {/* General */}
      <div className="p-4 space-y-3 border-b" style={{ borderColor: 'var(--outline-variant)' }}>
        <p className="text-[10px] uppercase tracking-widests font-semibold text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>General</p>

        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
            Etiqueta / Pregunta <span className="text-coral">*</span>
          </label>
          <textarea
            rows={2}
            className={cn(inputCls, 'resize-none')}
            style={{ fontFamily: 'var(--font-body)' }}
            value={field.label}
            onChange={e => set('label', e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Texto de ayuda</label>
          <input
            className={inputCls}
            style={{ fontFamily: 'var(--font-body)' }}
            placeholder="Aparece debajo del campo"
            value={field.helper_text ?? ''}
            onChange={e => set('helper_text', e.target.value || undefined)}
          />
        </div>

        {(field.type === 'text' || field.type === 'textarea' || field.type === 'number') && (
          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Placeholder</label>
            <input
              className={inputCls}
              style={{ fontFamily: 'var(--font-body)' }}
              value={field.placeholder ?? ''}
              onChange={e => set('placeholder', e.target.value || undefined)}
            />
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-[13px] font-medium text-navy" style={{ fontFamily: 'var(--font-body)' }}>Obligatorio</p>
            <p className="text-[11px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>Marcado con asterisco</p>
          </div>
          <div
            onClick={() => set('is_required', !field.is_required)}
            className={cn(
              'relative h-5 w-9 rounded-full transition-all cursor-pointer shrink-0',
              field.is_required ? 'bg-coral' : 'bg-navy-light/20'
            )}
          >
            <div className={cn(
              'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
              field.is_required ? 'translate-x-4' : 'translate-x-0'
            )} />
          </div>
        </div>
      </div>

      {/* Options */}
      {(field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && (
        <div className="p-4 space-y-3 border-b" style={{ borderColor: 'var(--outline-variant)' }}>
          <p className="text-[10px] uppercase tracking-widests font-semibold text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Opciones</p>
          <div className="space-y-2">
            {(field.options ?? []).map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <GripVertical size={14} className="text-navy-light/30 shrink-0 cursor-grab" />
                <input
                  className={cn(inputCls, 'flex-1')}
                  style={{ fontFamily: 'var(--font-body)' }}
                  value={opt}
                  onChange={e => updateOption(i, e.target.value)}
                  placeholder={`Opción ${i + 1}`}
                />
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  className="shrink-0 h-7 w-7 rounded-full hover:bg-coral/10 flex items-center justify-center transition-colors"
                >
                  <X size={13} className="text-coral" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addOption}
            className="flex items-center gap-1.5 text-[12px] text-coral hover:text-coral-deep transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <Plus size={13} />
            Agregar opción
          </button>
        </div>
      )}

      {/* Scale */}
      {field.type === 'scale' && (
        <div className="p-4 space-y-3 border-b" style={{ borderColor: 'var(--outline-variant)' }}>
          <p className="text-[10px] uppercase tracking-widests font-semibold text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Escala</p>
          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Rango</label>
            <div className="flex gap-2">
              {([[1, 5], [1, 10]] as const).map(([min, max]) => (
                <button
                  key={`${min}-${max}`}
                  type="button"
                  onClick={() => onChange({ ...field, scale_min: min, scale_max: max })}
                  className={cn(
                    'flex-1 rounded-xl border py-2 text-[12px] font-medium transition-colors',
                    field.scale_min === min && field.scale_max === max
                      ? 'bg-coral text-white border-coral'
                      : 'text-navy-light/60 hover:bg-surface-low'
                  )}
                  style={{
                    borderColor: (field.scale_min === min && field.scale_max === max) ? undefined : 'var(--outline-variant)',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  {min}–{max}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Etiq. mínimo</label>
              <input
                className={inputCls}
                style={{ fontFamily: 'var(--font-body)' }}
                placeholder="Ej: Muy malo"
                value={field.scale_min_label ?? ''}
                onChange={e => set('scale_min_label', e.target.value || undefined)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Etiq. máximo</label>
              <input
                className={inputCls}
                style={{ fontFamily: 'var(--font-body)' }}
                placeholder="Ej: Excelente"
                value={field.scale_max_label ?? ''}
                onChange={e => set('scale_max_label', e.target.value || undefined)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Conditional logic */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-navy" style={{ fontFamily: 'var(--font-body)' }}>Lógica condicional</p>
            <p className="text-[11px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>Mostrar según otra respuesta</p>
          </div>
          <div
            onClick={() => toggleConditional(!condActive)}
            className={cn(
              'relative h-5 w-9 rounded-full transition-all cursor-pointer shrink-0',
              condActive ? 'bg-coral' : 'bg-navy-light/20'
            )}
          >
            <div className={cn(
              'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
              condActive ? 'translate-x-4' : 'translate-x-0'
            )} />
          </div>
        </div>

        {condActive && (
          <div className="space-y-2">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Mostrar cuando el campo</label>
              <select
                className={inputCls}
                style={{ fontFamily: 'var(--font-body)' }}
                value={field.conditional?.field_id ?? ''}
                onChange={e => onChange({ ...field, conditional: { ...(field.conditional ?? { operator: 'eq', value: '' }), field_id: e.target.value } })}
              >
                <option value="">Seleccionar campo...</option>
                {otherFields.map(f => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Operador</label>
                <select
                  className={inputCls}
                  style={{ fontFamily: 'var(--font-body)' }}
                  value={field.conditional?.operator ?? 'eq'}
                  onChange={e => onChange({ ...field, conditional: { ...(field.conditional ?? { field_id: '', value: '' }), operator: e.target.value as 'eq' | 'neq' } })}
                >
                  <option value="eq">sea igual a</option>
                  <option value="neq">sea distinto de</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Valor</label>
                <input
                  className={inputCls}
                  style={{ fontFamily: 'var(--font-body)' }}
                  placeholder="Ej: Sí"
                  value={field.conditional?.value ?? ''}
                  onChange={e => onChange({ ...field, conditional: { ...(field.conditional ?? { field_id: '', operator: 'eq' }), value: e.target.value } })}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
