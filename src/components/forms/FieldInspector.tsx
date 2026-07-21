'use client'

import { useState } from 'react'
import { Plus, X, GripVertical, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FormFieldNew, LogicRule, LogicCondition, ConditionOperator } from '@/data/form-config'
import { PERSONAL_DATA_FIELDS } from '@/data/form-config'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

// Operators available per field type
function getOperatorsForType(type: FormFieldNew['type']): { value: ConditionOperator; label: string }[] {
  const base: { value: ConditionOperator; label: string }[] = [
    { value: 'is_empty',     label: 'está vacío' },
    { value: 'is_not_empty', label: 'no está vacío' },
  ]
  if (type === 'text' || type === 'textarea') {
    return [
      { value: 'eq',          label: 'es igual a' },
      { value: 'neq',         label: 'es distinto de' },
      { value: 'contains',    label: 'contiene' },
      { value: 'not_contains',label: 'no contiene' },
      ...base,
    ]
  }
  if (type === 'number' || type === 'scale') {
    return [
      { value: 'eq',  label: 'es igual a' },
      { value: 'neq', label: 'es distinto de' },
      { value: 'gt',  label: 'mayor que' },
      { value: 'lt',  label: 'menor que' },
      ...base,
    ]
  }
  if (type === 'checkbox') {
    return [
      { value: 'contains',    label: 'incluye' },
      { value: 'not_contains',label: 'no incluye' },
      ...base,
    ]
  }
  // select, radio, yes_no, date
  return [
    { value: 'eq',  label: 'es igual a' },
    { value: 'neq', label: 'es distinto de' },
    ...base,
  ]
}

const VALUE_REQUIRED_OPS: ConditionOperator[] = ['eq', 'neq', 'contains', 'not_contains', 'gt', 'lt']

interface FieldInspectorProps {
  field: FormFieldNew
  allFields: FormFieldNew[]
  onChange: (updated: FormFieldNew) => void
  onFocusLogic?: boolean
}

export function FieldInspector({ field, allFields, onChange, onFocusLogic }: FieldInspectorProps) {
  const [activeSection, setActiveSection] = useState<'general' | 'options' | 'scale' | 'logic'>(
    onFocusLogic ? 'logic' : 'general'
  )

  function set<K extends keyof FormFieldNew>(key: K, value: FormFieldNew[K]) {
    onChange({ ...field, [key]: value })
  }

  function setRules(rules: LogicRule[]) {
    onChange({ ...field, logic_rules: rules })
  }

  function addRule() {
    const rule: LogicRule = {
      id: generateId(),
      condition_operator: 'AND',
      conditions: [{ id: generateId(), field_id: '', operator: 'eq', value: '' }],
      action: 'show',
    }
    setRules([...(field.logic_rules ?? []), rule])
  }

  function updateRule(ruleId: string, patch: Partial<LogicRule>) {
    setRules((field.logic_rules ?? []).map(r => r.id === ruleId ? { ...r, ...patch } : r))
  }

  function deleteRule(ruleId: string) {
    setRules((field.logic_rules ?? []).filter(r => r.id !== ruleId))
  }

  function addCondition(ruleId: string) {
    setRules((field.logic_rules ?? []).map(r => {
      if (r.id !== ruleId) return r
      return {
        ...r,
        conditions: [...r.conditions, { id: generateId(), field_id: '', operator: 'eq', value: '' }],
      }
    }))
  }

  function updateCondition(ruleId: string, condId: string, patch: Partial<LogicCondition>) {
    setRules((field.logic_rules ?? []).map(r => {
      if (r.id !== ruleId) return r
      return {
        ...r,
        conditions: r.conditions.map(c => c.id === condId ? { ...c, ...patch } : c),
      }
    }))
  }

  function deleteCondition(ruleId: string, condId: string) {
    setRules((field.logic_rules ?? []).map(r => {
      if (r.id !== ruleId) return r
      return { ...r, conditions: r.conditions.filter(c => c.id !== condId) }
    }))
  }

  // personal_data inspector (early return — no tabs)
  if (field.type === 'personal_data') {
    const selectedKeys = field.options ?? []
    const GROUPS = ['Identificación', 'Contacto', 'Emergencia', 'Trabajo', 'Salud'] as const
    return (
      <div className="p-4 space-y-4">
        <p className="text-[10px] uppercase tracking-widest text-navy-light/60 font-display">
          Datos personales del miembro
        </p>

        {/* Select all / none */}
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-xl border py-1.5 text-[11px] text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
            onClick={() => set('options', PERSONAL_DATA_FIELDS.map(f => f.key))}
          >
            Seleccionar todos
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl border py-1.5 text-[11px] text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
            onClick={() => set('options', [])}
          >
            Ninguno
          </button>
        </div>

        {/* Fields grouped */}
        {GROUPS.map(group => (
          <div key={group}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-navy-light/60 mb-2 font-display">
              {group}
            </p>
            <div className="space-y-0.5">
              {PERSONAL_DATA_FIELDS.filter(f => f.group === group).map(pf => (
                <label key={pf.key} className="flex items-center gap-2.5 py-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-coral"
                    checked={selectedKeys.includes(pf.key)}
                    onChange={e => {
                      const updated = e.target.checked
                        ? [...selectedKeys, pf.key]
                        : selectedKeys.filter(k => k !== pf.key)
                      set('options', updated)
                    }}
                  />
                  <span className="text-[12px] text-navy font-body">{pf.label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Candidate fields for conditions: only fields that appear BEFORE this one
  const fieldIndex = allFields.findIndex(f => f.id === field.id)
  const priorFields = allFields.slice(0, fieldIndex).filter(f => f.type !== 'section' && f.type !== 'page_break' && f.type !== 'personal_data')

  function getOptionsForField(fieldId: string): string[] {
    const f = allFields.find(x => x.id === fieldId)
    if (!f) return []
    if (f.type === 'yes_no') return ['Sí', 'No']
    return f.options ?? []
  }

  function getFieldType(fieldId: string): FormFieldNew['type'] | null {
    return allFields.find(f => f.id === fieldId)?.type ?? null
  }

  // page_break inspector
  if (field.type === 'page_break') {
    return (
      <div className="space-y-4 p-4">
        <p className="text-[10px] uppercase tracking-widest text-navy-light/60 font-display">
          Bloque / Página
        </p>
        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-widest text-navy-light/60 font-display">
            Título de la página
          </label>
          <input className={inputCls} placeholder="ej. Información de emergencia" value={field.label} onChange={e => set('label', e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-widest text-navy-light/60 font-display">
            Descripción (opcional)
          </label>
          <textarea
            rows={2}
            className={cn(inputCls, 'resize-none')}
            placeholder="Aparece al inicio de esta página"
            value={field.description ?? ''}
            onChange={e => set('description', e.target.value || undefined)}
          />
        </div>
      </div>
    )
  }

  // section inspector
  if (field.type === 'section') {
    return (
      <div className="space-y-4 p-4">
        <p className="text-[10px] uppercase tracking-widest text-navy-light/60 font-display">
          Separador de sección
        </p>
        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-widest text-navy-light/60 font-display">Título</label>
          <input className={inputCls} value={field.label} onChange={e => set('label', e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-widest text-navy-light/60 font-display">Texto de ayuda</label>
          <input className={inputCls} value={field.helper_text ?? ''} onChange={e => set('helper_text', e.target.value || undefined)} />
        </div>
      </div>
    )
  }

  const sectionBtn = (key: typeof activeSection, label: string) => (
    <button
      key={key}
      type="button"
      onClick={() => setActiveSection(key)}
      className={cn(
        'flex-1 py-2 text-[11px] font-medium transition-all border-b-2 -mb-px font-display',
        activeSection === key ? 'border-coral text-navy' : 'border-transparent text-navy-light/60 hover:text-navy'
      )}
    >
      {label}
    </button>
  )

  const showOptions = field.type === 'select' || field.type === 'radio' || field.type === 'checkbox'
  const showScale = field.type === 'scale'
  const logicCount = field.logic_rules?.length ?? 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Section tabs */}
      <div className="flex border-b px-2 shrink-0 border-[var(--outline-variant)]">
        {sectionBtn('general', 'General')}
        {showOptions && sectionBtn('options', 'Opciones')}
        {showScale && sectionBtn('scale', 'Escala')}
        <button
          type="button"
          onClick={() => setActiveSection('logic')}
          className={cn(
            'flex-1 py-2 text-[11px] font-medium transition-all border-b-2 -mb-px flex items-center justify-center gap-1 font-display',
            activeSection === 'logic' ? 'border-coral text-navy' : 'border-transparent text-navy-light/60 hover:text-navy'
          )}
        >
          Lógica
          {logicCount > 0 && (
            <span className="rounded-full bg-coral/20 text-coral text-[9px] px-1.5 py-0.5 font-bold">{logicCount}</span>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* GENERAL */}
        {activeSection === 'general' && (
          <div className="p-4 space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-widest text-navy-light/60 font-display">
                Etiqueta / Pregunta <span className="text-coral">*</span>
              </label>
              <textarea
                rows={2}
                className={cn(inputCls, 'resize-none')}
                value={field.label}
                onChange={e => set('label', e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-widest text-navy-light/60 font-display">Texto de ayuda</label>
              <input className={inputCls} placeholder="Aparece debajo del campo" value={field.helper_text ?? ''} onChange={e => set('helper_text', e.target.value || undefined)} />
            </div>

            {(field.type === 'text' || field.type === 'textarea' || field.type === 'number') && (
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-widest text-navy-light/60 font-display">Placeholder</label>
                <input className={inputCls} value={field.placeholder ?? ''} onChange={e => set('placeholder', e.target.value || undefined)} />
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-[13px] font-medium text-navy font-body">Obligatorio</p>
                <p className="text-[11px] text-navy-light/60 font-body">Marcado con asterisco</p>
              </div>
              <div
                onClick={() => set('is_required', !field.is_required)}
                className={cn('relative h-5 w-9 rounded-full transition-all cursor-pointer shrink-0', field.is_required ? 'bg-coral' : 'bg-navy-light/20')}
              >
                <div className={cn('absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', field.is_required ? 'translate-x-4' : 'translate-x-0')} />
              </div>
            </div>
          </div>
        )}

        {/* OPTIONS */}
        {activeSection === 'options' && showOptions && (
          <div className="p-4 space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-navy-light/60 font-display">Opciones</p>
            <div className="space-y-2">
              {(field.options ?? []).map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <GripVertical size={14} className="text-navy-light/60 shrink-0 cursor-grab" />
                  <input
                    className={cn(inputCls, 'flex-1')}
                    value={opt}
                    onChange={e => {
                      const opts = [...(field.options ?? [])]; opts[i] = e.target.value
                      set('options', opts)
                    }}
                    placeholder={`Opción ${i + 1}`}
                  />
                  <button type="button" onClick={() => set('options', (field.options ?? []).filter((_, idx) => idx !== i))} className="relative after:absolute after:content-[''] after:-inset-1.5 shrink-0 h-7 w-7 rounded-full hover:bg-coral/10 flex items-center justify-center transition-colors" aria-label={`Eliminar opción ${i + 1}`}>
                    <X size={13} className="text-coral" />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => set('options', [...(field.options ?? []), ''])} className="flex items-center gap-1.5 text-[12px] text-coral hover:text-coral-deep transition-colors font-body">
              <Plus size={13} />
              Agregar opción
            </button>
          </div>
        )}

        {/* SCALE */}
        {activeSection === 'scale' && showScale && (
          <div className="p-4 space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-navy-light/60 font-display">Escala</p>
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-widest text-navy-light/60 font-display">Rango</label>
              <div className="flex gap-2">
                {([[1, 5], [1, 10]] as const).map(([min, max]) => (
                  <button
                    key={`${min}-${max}`}
                    type="button"
                    onClick={() => onChange({ ...field, scale_min: min, scale_max: max })}
                    className={cn('flex-1 rounded-xl border py-2 text-[12px] font-medium transition-colors font-display', field.scale_min === min && field.scale_max === max ? 'bg-coral text-white border-coral' : 'text-navy-light/60 hover:bg-surface-low')}
                    style={{ borderColor: (field.scale_min === min && field.scale_max === max) ? undefined : 'var(--outline-variant)' }}
                  >
                    {min}–{max}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest text-navy-light/60 font-display">Etiq. mínimo</label>
                <input className={inputCls} placeholder="Ej: Muy malo" value={field.scale_min_label ?? ''} onChange={e => set('scale_min_label', e.target.value || undefined)} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest text-navy-light/60 font-display">Etiq. máximo</label>
                <input className={inputCls} placeholder="Ej: Excelente" value={field.scale_max_label ?? ''} onChange={e => set('scale_max_label', e.target.value || undefined)} />
              </div>
            </div>
          </div>
        )}

        {/* LOGIC */}
        {activeSection === 'logic' && (
          <div className="p-4 space-y-4">
            <p className="text-[10px] uppercase tracking-widest text-navy-light/60 font-display">
              Lógica condicional
            </p>

            {(field.logic_rules ?? []).length === 0 && (
              <div className="rounded-xl border-2 border-dashed py-6 flex flex-col items-center gap-2 border-[var(--outline-variant)]">
                <p className="text-[12px] text-navy-light/60 font-body">Sin reglas aún</p>
              </div>
            )}

            {(field.logic_rules ?? []).map((rule, ruleIdx) => (
              <div key={rule.id} className="rounded-xl border space-y-3 p-3 border-[var(--outline-variant)]">
                {/* Rule header */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-navy-light/60 font-display">
                    Regla {ruleIdx + 1}
                  </span>
                  <button type="button" onClick={() => deleteRule(rule.id)} className="relative after:absolute after:content-[''] after:-inset-2 h-6 w-6 flex items-center justify-center rounded-full hover:bg-coral/10 transition-colors" aria-label={`Eliminar regla ${ruleIdx + 1}`}>
                    <X size={12} className="text-coral" />
                  </button>
                </div>

                {/* Action */}
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-navy-light/60 shrink-0 font-body">Acción</span>
                  <select
                    className={cn(inputCls, 'flex-1')}
                    value={rule.action}
                    onChange={e => updateRule(rule.id, { action: e.target.value as 'show' | 'hide' })}
                  >
                    <option value="show">Mostrar este campo</option>
                    <option value="hide">Ocultar este campo</option>
                  </select>
                </div>

                {/* Combinator */}
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-navy-light/60 shrink-0 font-body">Combinar</span>
                  <div className="flex gap-1">
                    {(['AND', 'OR'] as const).map(op => (
                      <button
                        key={op}
                        type="button"
                        onClick={() => updateRule(rule.id, { condition_operator: op })}
                        className={cn('rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all font-display', rule.condition_operator === op ? 'bg-navy text-white' : 'text-navy-light/60 hover:text-navy')}
                      >
                        {op}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Conditions */}
                <div className="space-y-2">
                  {rule.conditions.map((cond, ci) => {
                    const refFieldType = getFieldType(cond.field_id)
                    const operators = refFieldType ? getOperatorsForType(refFieldType) : [{ value: 'eq' as ConditionOperator, label: 'es igual a' }]
                    const needsValue = VALUE_REQUIRED_OPS.includes(cond.operator)
                    const valueOptions = getOptionsForField(cond.field_id)

                    return (
                      <div key={cond.id} className="rounded-lg p-2.5 space-y-2 bg-surface-low">
                        {ci > 0 && (
                          <p className="text-[10px] font-bold text-navy-light/60 text-center font-display">
                            {rule.condition_operator}
                          </p>
                        )}
                        <select
                          className={inputCls}
                          value={cond.field_id}
                          onChange={e => updateCondition(rule.id, cond.id, { field_id: e.target.value, value: '' })}
                        >
                          <option value="">Seleccionar campo...</option>
                          {priorFields.map(f => (
                            <option key={f.id} value={f.id}>{f.label || f.id}</option>
                          ))}
                        </select>
                        <select
                          className={inputCls}
                          value={cond.operator}
                          onChange={e => updateCondition(rule.id, cond.id, { operator: e.target.value as ConditionOperator })}
                        >
                          {operators.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                        </select>
                        {needsValue && (
                          valueOptions.length > 0 ? (
                            <select
                              className={inputCls}
                              value={cond.value}
                              onChange={e => updateCondition(rule.id, cond.id, { value: e.target.value })}
                            >
                              <option value="">Seleccionar valor...</option>
                              {valueOptions.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          ) : (
                            <input
                              className={inputCls}
                              placeholder="Valor..."
                              value={cond.value}
                              onChange={e => updateCondition(rule.id, cond.id, { value: e.target.value })}
                            />
                          )
                        )}
                        <div className="flex items-center justify-between">
                          <button type="button" onClick={() => addCondition(rule.id)} className="text-[11px] text-coral hover:text-coral-deep transition-colors flex items-center gap-1 font-body">
                            <Plus size={11} /> Agregar condición
                          </button>
                          {rule.conditions.length > 1 && (
                            <button type="button" onClick={() => deleteCondition(rule.id, cond.id)} className="h-5 w-5 flex items-center justify-center rounded hover:bg-coral/10 transition-colors">
                              <Trash2 size={11} className="text-coral" />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addRule}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed py-2.5 text-[12px] text-coral hover:bg-coral/5 transition-colors border-[rgb(255_107_74_/_0.3)] font-body"
            >
              <Plus size={13} />
              Agregar regla
            </button>

            {priorFields.length === 0 && (
              <p className="text-[11px] text-navy-light/60 text-center font-body">
                No hay campos anteriores para referenciar.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
