'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MOCK_FORM_TEMPLATES, type FormTemplate, type FormFieldNew, type FieldType } from '@/data/mock-forms'
import { FormCanvas } from '@/components/forms/FormCanvas'
import { FieldInspector } from '@/components/forms/FieldInspector'
import { FieldTypeIcon } from '@/components/forms/FieldTypeIcon'
import { cn } from '@/lib/utils'
import { ChevronLeft, Eye, Save, Send, Check, GitBranch, X, Zap } from 'lucide-react'

type FormStatus = 'draft' | 'active'

const FIELD_GROUPS: { label: string; types: { type: FieldType; label: string }[] }[] = [
  {
    label: 'BÁSICOS',
    types: [
      { type: 'text',     label: 'Texto corto'  },
      { type: 'textarea', label: 'Párrafo'       },
      { type: 'number',   label: 'Número'        },
      { type: 'date',     label: 'Fecha'         },
    ],
  },
  {
    label: 'SELECCIÓN',
    types: [
      { type: 'select',   label: 'Desplegable'   },
      { type: 'radio',    label: 'Opción única'  },
      { type: 'checkbox', label: 'Casillas'      },
      { type: 'yes_no',   label: 'Sí / No'       },
    ],
  },
  {
    label: 'AVANZADOS',
    types: [
      { type: 'scale',      label: 'Escala'        },
      { type: 'section',    label: 'Separador'     },
    ],
  },
  {
    label: 'ESTRUCTURA',
    types: [
      { type: 'page_break', label: 'Bloque / Página' },
    ],
  },
]

const CATEGORY_OPTIONS: { value: FormTemplate['category']; label: string }[] = [
  { value: 'event_registration',  label: 'Inscripción evento'   },
  { value: 'study_registration',  label: 'Inscripción estudios' },
  { value: 'survey',              label: 'Encuesta'              },
  { value: 'registration',        label: 'Registro'              },
  { value: 'other',               label: 'Otro'                  },
]

function generateId() {
  return `field-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function defaultField(type: FieldType, order: number): FormFieldNew {
  const base: FormFieldNew = {
    id: generateId(),
    type,
    label: '',
    is_required: false,
    sort_order: order,
    logic_rules: [],
  }
  if (type === 'select' || type === 'radio' || type === 'checkbox') {
    base.options = ['Opción 1', 'Opción 2']
  }
  if (type === 'scale') {
    base.scale_min = 1
    base.scale_max = 5
    base.scale_min_label = 'Muy malo'
    base.scale_max_label = 'Excelente'
  }
  return base
}

interface FormBuilderProps {
  formId?: string
}

export function FormBuilder({ formId }: FormBuilderProps) {
  const router = useRouter()

  const existing = formId ? MOCK_FORM_TEMPLATES.find(f => f.id === formId) : null

  const [name, setName]               = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [category, setCategory]       = useState<FormTemplate['category']>(existing?.category ?? 'event_registration')
  const [status, setStatus]           = useState<FormStatus>(existing?.is_active ? 'active' : 'draft')
  const [fields, setFields]           = useState<FormFieldNew[]>(existing?.fields ?? [])
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null)
  const [focusLogic, setFocusLogic]   = useState(false)
  const [showLogicPanel, setShowLogicPanel] = useState(false)
  const [saved, setSaved]             = useState(false)

  const activeField = fields.find(f => f.id === activeFieldId) ?? null

  function addField(type: FieldType) {
    const field = defaultField(type, fields.length)
    setFields(prev => [...prev, field])
    setActiveFieldId(field.id)
  }

  const updateField = useCallback((updated: FormFieldNew) => {
    setFields(prev => prev.map(f => f.id === updated.id ? updated : f))
  }, [])

  function duplicateField(id: string) {
    const idx = fields.findIndex(f => f.id === id)
    if (idx === -1) return
    const clone = { ...fields[idx], id: generateId(), sort_order: idx + 1 }
    const newFields = [...fields]
    newFields.splice(idx + 1, 0, clone)
    setFields(newFields.map((f, i) => ({ ...f, sort_order: i })))
    setActiveFieldId(clone.id)
  }

  function deleteField(id: string) {
    setFields(prev => prev.filter(f => f.id !== id).map((f, i) => ({ ...f, sort_order: i })))
    if (activeFieldId === id) setActiveFieldId(null)
  }

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const backHref = formId ? `/formularios/${formId}` : '/formularios'

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -mx-6 -mt-6">
      {/* Top bar */}
      <div
        className="sticky top-0 z-20 flex items-center gap-3 px-6 py-3 border-b shrink-0"
        style={{ background: 'var(--surface-card)', borderColor: 'var(--outline-variant)' }}
      >
        <Link
          href="/formularios"
          className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors shrink-0"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          <ChevronLeft size={16} />
          Formularios
        </Link>
        <span className="text-navy-light/20">|</span>

        {/* Editable name */}
        <input
          className="flex-1 bg-transparent text-base font-bold text-navy outline-none min-w-0 placeholder-navy-light/30"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}
          placeholder="Nombre del formulario"
          value={name}
          onChange={e => setName(e.target.value)}
        />

        {/* Category */}
        <select
          className="rounded-xl bg-surface-low px-2.5 py-1.5 text-[12px] text-navy outline-none shrink-0"
          style={{ fontFamily: 'var(--font-body)' }}
          value={category}
          onChange={e => setCategory(e.target.value as FormTemplate['category'])}
        >
          {CATEGORY_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Status badge */}
        <button
          type="button"
          onClick={() => setStatus(s => s === 'draft' ? 'active' : 'draft')}
          className={cn(
            'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors shrink-0',
            status === 'active' ? 'bg-teal-soft/30 text-teal-deep' : 'bg-navy/10 text-navy-light/50'
          )}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {status === 'active' ? 'Activo' : 'Borrador'}
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowLogicPanel(true)}
            className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            <GitBranch size={12} />
            Lógica
          </button>
          <Link
            href={formId ? `/formularios/${formId}/preview` : '#'}
            className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            <Eye size={12} />
            Vista previa
          </Link>
          <button
            type="button"
            onClick={handleSave}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] text-white transition-colors',
              saved ? 'bg-teal-deep' : 'bg-coral hover:bg-coral-deep'
            )}
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {saved ? <Check size={12} /> : <Save size={12} />}
            {saved ? 'Guardado' : 'Guardar'}
          </button>
          {status === 'draft' && (
            <button
              type="button"
              onClick={() => { setStatus('active'); handleSave() }}
              className="flex items-center gap-1.5 rounded-full bg-navy px-3 py-1.5 text-[12px] text-white hover:bg-navy-light transition-colors"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <Send size={12} />
              Publicar
            </button>
          )}
        </div>
      </div>

      {/* Three-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Field types */}
        <div
          className="w-48 shrink-0 flex flex-col border-r overflow-y-auto"
          style={{ background: 'var(--surface-low)', borderColor: 'var(--outline-variant)' }}
        >
          <div className="p-3 space-y-4">
            {FIELD_GROUPS.map(group => (
              <div key={group.label} className="space-y-1">
                <p className="text-[9px] uppercase tracking-widests font-semibold text-navy-light/40 px-1 mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                  {group.label}
                </p>
                {group.types.map(({ type, label }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => addField(type)}
                    className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] text-navy-light hover:bg-white hover:text-navy hover:shadow-sm transition-all text-left"
                    style={{ fontFamily: 'var(--font-body)' }}
                    draggable
                    onDragStart={e => e.dataTransfer.setData('fieldType', type)}
                  >
                    <FieldTypeIcon type={type} size={13} className="text-navy-light/50 shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Description input */}
          <div className="max-w-2xl mx-auto mb-4">
            <input
              className="w-full bg-transparent text-sm text-navy-light/60 outline-none placeholder-navy-light/30"
              style={{ fontFamily: 'var(--font-body)' }}
              placeholder="Descripción del formulario (opcional)"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          <div className="max-w-2xl mx-auto">
            <FormCanvas
              fields={fields}
              activeFieldId={activeFieldId}
              onFieldsChange={setFields}
              onSelectField={id => { setActiveFieldId(id); setFocusLogic(false) }}
              onDuplicateField={duplicateField}
              onDeleteField={deleteField}
              onFocusLogic={id => { setActiveFieldId(id); setFocusLogic(true) }}
            />
          </div>
          {fields.length > 0 && (
            <div className="max-w-2xl mx-auto mt-4">
              <p className="text-center text-[11px] text-navy-light/30" style={{ fontFamily: 'var(--font-body)' }}>
                {fields.length} campo{fields.length !== 1 ? 's' : ''}
                {' · '}
                {fields.filter(f => f.is_required).length} obligatorio{fields.filter(f => f.is_required).length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>

        {/* Right: Inspector */}
        <div
          className="w-72 shrink-0 border-l overflow-hidden flex flex-col"
          style={{ borderColor: 'var(--outline-variant)' }}
        >
          {activeField ? (
            <>
              <div className="px-4 py-3 border-b flex items-center gap-2 shrink-0" style={{ borderColor: 'var(--outline-variant)' }}>
                <FieldTypeIcon type={activeField.type} size={13} className="text-navy-light/50" />
                <p className="text-[12px] font-semibold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
                  {activeField.type === 'section' ? 'Separador' :
                    activeField.type === 'text' ? 'Texto corto' :
                    activeField.type === 'textarea' ? 'Párrafo' :
                    activeField.type === 'select' ? 'Desplegable' :
                    activeField.type === 'radio' ? 'Opción única' :
                    activeField.type === 'checkbox' ? 'Casillas' :
                    activeField.type === 'yes_no' ? 'Sí / No' :
                    activeField.type === 'scale' ? 'Escala' :
                    activeField.type === 'number' ? 'Número' :
                    activeField.type === 'date' ? 'Fecha' :
                  activeField.type === 'page_break' ? 'Bloque / Página' : activeField.type}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveFieldId(null)}
                  className="ml-auto text-navy-light/30 hover:text-navy transition-colors"
                >
                  ×
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <FieldInspector
                  field={activeField}
                  allFields={fields}
                  onChange={f => { updateField(f); setFocusLogic(false) }}
                  onFocusLogic={focusLogic}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
              <div className="h-12 w-12 rounded-xl bg-navy/5 flex items-center justify-center">
                <FieldTypeIcon type="text" size={20} className="text-navy-light/20" />
              </div>
              <p className="text-[12px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
                Seleccioná un campo para editarlo
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Logic overview modal */}
      {showLogicPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-navy-ink/40 backdrop-blur-sm">
          <div className="h-full w-full max-w-md overflow-y-auto flex flex-col" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: 'var(--outline-variant)', background: 'var(--surface-card)' }}>
              <div className="flex items-center gap-2">
                <GitBranch size={16} className="text-navy-light/50" />
                <p className="text-sm font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>Lógica del formulario</p>
              </div>
              <button type="button" onClick={() => setShowLogicPanel(false)}>
                <X size={18} className="text-navy-light/40" />
              </button>
            </div>

            <div className="p-5 space-y-2 flex-1">
              {(() => {
                let pageNum = 1
                let pageLabel = 'Página 1'
                const sections: { pageLabel: string; fields: typeof fields }[] = [{ pageLabel, fields: [] }]
                fields.forEach(f => {
                  if (f.type === 'page_break') {
                    pageNum++
                    pageLabel = `Página ${pageNum}${f.label ? ` — ${f.label}` : ''}`
                    sections.push({ pageLabel, fields: [] })
                  } else {
                    sections[sections.length - 1].fields.push(f)
                  }
                })
                return sections.map((section, si) => (
                  <div key={si} className="space-y-1">
                    <p className="text-[11px] font-bold text-navy-light/50 uppercase tracking-widests" style={{ fontFamily: 'var(--font-display)' }}>
                      📄 {section.pageLabel}
                    </p>
                    <div className="ml-3 border-l space-y-0.5 pl-3" style={{ borderColor: 'var(--outline-variant)' }}>
                      {section.fields.map(f => {
                        const rc = f.logic_rules?.length ?? 0
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => { setActiveFieldId(f.id); setFocusLogic(true); setShowLogicPanel(false) }}
                            className="w-full flex items-center justify-between gap-2 py-1.5 text-left hover:text-coral transition-colors group"
                          >
                            <span className="text-[12px] text-navy-light/60 group-hover:text-navy truncate" style={{ fontFamily: 'var(--font-body)' }}>
                              {f.label || <span className="italic text-navy-light/30">Sin etiqueta</span>}
                            </span>
                            {rc > 0 && (
                              <span className="shrink-0 flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5">
                                <Zap size={9} className="text-amber-600" />
                                <span className="text-[9px] font-bold text-amber-600">{rc}</span>
                              </span>
                            )}
                          </button>
                        )
                      })}
                      {section.fields.length === 0 && (
                        <p className="text-[11px] text-navy-light/30 italic py-1" style={{ fontFamily: 'var(--font-body)' }}>Sin campos</p>
                      )}
                    </div>
                  </div>
                ))
              })()}
            </div>

            <div className="px-5 py-3 border-t text-center" style={{ borderColor: 'var(--outline-variant)' }}>
              <p className="text-[11px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
                {fields.filter(f => (f.logic_rules?.length ?? 0) > 0).length} campos con lógica · {fields.filter(f => f.type === 'page_break').length} bloque{fields.filter(f => f.type === 'page_break').length !== 1 ? 's' : ''} · {fields.filter(f => f.type !== 'page_break' && f.type !== 'section').length} campos total
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
