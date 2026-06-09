'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type FormTemplate, type FormFieldNew, type FieldType } from '@/types/forms'
import { toDomainFormTemplate } from '@/lib/forms/adapter'
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
      { type: 'page_break',    label: 'Bloque / Página'  },
      { type: 'personal_data', label: 'Datos personales' },
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
  if (type === 'personal_data') {
    base.label = 'Datos personales del miembro'
    base.options = ['full_name', 'cedula', 'phone', 'email']
  }
  return base
}

interface FormBuilderProps {
  formId?: string
}

export function FormBuilder({ formId }: FormBuilderProps) {
  const router = useRouter()

  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory]       = useState<FormTemplate['category']>('event_registration')
  const [status, setStatus]           = useState<FormStatus>('draft')
  const [fields, setFields]           = useState<FormFieldNew[]>([])
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null)
  const [focusLogic, setFocusLogic]   = useState(false)
  const [showLogicPanel, setShowLogicPanel] = useState(false)
  const [saved, setSaved]             = useState(false)
  const [saving, setSaving]           = useState(false)

  // Edición: carga el formulario de la BD (async).
  useEffect(() => {
    if (!formId) return
    fetch(`/api/forms/${formId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(db => {
        if (!db) return
        const f = toDomainFormTemplate(db)
        setName(f.name)
        setDescription(f.description)
        setCategory(f.category)
        setStatus(f.is_active ? 'active' : 'draft')
        setFields(f.fields)
      })
      .catch(() => {})
  }, [formId])

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

  async function handleSave(nextStatus?: FormStatus) {
    if (saving) return
    setSaving(true)
    const isActive = (nextStatus ?? status) === 'active'
    const payload = { name, description, category, is_active: isActive, fields }
    try {
      if (formId) {
        const res = await fetch(`/api/forms/${formId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error()
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } else {
        const res = await fetch('/api/forms', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error()
        const { id } = await res.json()
        router.push(`/formularios/${id}`)
      }
    } catch {
      // queda en el editor para reintentar
    } finally {
      setSaving(false)
    }
  }

  const backHref = formId ? `/formularios/${formId}` : '/formularios'

  return (
    <div className="flex flex-col md:h-[calc(100vh-4rem)] -mx-6 -mt-6">
      {/* Top bar */}
      <div
        className="sticky top-0 z-20 flex items-center gap-3 flex-wrap px-4 md:px-6 py-3 border-b shrink-0 bg-surface-card border-[var(--outline-variant)]"
      >
        <Link
          href="/formularios"
          className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors shrink-0 font-body"
        >
          <ChevronLeft size={16} />
          Formularios
        </Link>
        <span className="text-navy-light/20">|</span>

        {/* Editable name */}
        <input
          className="flex-1 basis-full md:basis-auto bg-transparent text-base font-bold text-navy outline-none min-w-0 placeholder-navy-light/30 font-display tracking-[-0.01em]"
          placeholder="Nombre del formulario"
          value={name}
          onChange={e => setName(e.target.value)}
        />

        {/* Category */}
        <select
          className="rounded-xl bg-surface-low px-2.5 py-1.5 text-[12px] text-navy outline-none shrink-0 font-body"
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
            'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors shrink-0 font-display',
            status === 'active' ? 'bg-teal-soft/30 text-teal-deep' : 'bg-navy/10 text-navy-light/50'
          )}
        >
          {status === 'active' ? 'Activo' : 'Borrador'}
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowLogicPanel(true)}
            className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
          >
            <GitBranch size={12} />
            Lógica
          </button>
          <Link
            href={formId ? `/formularios/${formId}/preview` : '#'}
            className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
          >
            <Eye size={12} />
            Vista previa
          </Link>
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={saving}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] text-white transition-colors disabled:opacity-50 font-body',
              saved ? 'bg-teal-deep' : 'bg-coral hover:bg-coral-deep'
            )}
          >
            {saved ? <Check size={12} /> : <Save size={12} />}
            {saving ? 'Guardando…' : saved ? 'Guardado' : 'Guardar'}
          </button>
          {status === 'draft' && (
            <button
              type="button"
              onClick={() => { setStatus('active'); handleSave('active') }}
              className="flex items-center gap-1.5 rounded-full bg-navy px-3 py-1.5 text-[12px] text-white hover:bg-navy-light transition-colors font-body"
            >
              <Send size={12} />
              Publicar
            </button>
          )}
        </div>
      </div>

      {/* Three-column layout */}
      <div className="flex flex-col md:flex-row flex-1 md:overflow-hidden">
        {/* Left: Field types */}
        <div
          className="w-full md:w-48 shrink-0 flex flex-col border-b md:border-b-0 md:border-r md:overflow-y-auto bg-surface-low border-[var(--outline-variant)]"
        >
          <div className="p-3 space-y-4">
            {FIELD_GROUPS.map(group => (
              <div key={group.label} className="space-y-1">
                <p className="text-[9px] uppercase tracking-widests font-semibold text-navy-light/40 px-1 mb-2 font-display">
                  {group.label}
                </p>
                <div className="grid grid-cols-2 gap-1 md:grid-cols-1">
                {group.types.map(({ type, label }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => addField(type)}
                    className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] text-navy-light hover:bg-white hover:text-navy hover:shadow-sm transition-all text-left font-body"
                    draggable
                    onDragStart={e => e.dataTransfer.setData('fieldType', type)}
                  >
                    <FieldTypeIcon type={type} size={13} className="text-navy-light/50 shrink-0" />
                    {label}
                  </button>
                ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 md:overflow-y-auto px-4 md:px-6 py-5">
          {/* Description input */}
          <div className="max-w-2xl mx-auto mb-4">
            <input
              className="w-full bg-transparent text-sm text-navy-light/60 outline-none placeholder-navy-light/30 font-body"
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
              <p className="text-center text-[11px] text-navy-light/30 font-body">
                {fields.length} campo{fields.length !== 1 ? 's' : ''}
                {' · '}
                {fields.filter(f => f.is_required).length} obligatorio{fields.filter(f => f.is_required).length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>

        {/* Right: Inspector */}
        <div
          className={cn(
            'w-full md:w-72 shrink-0 border-t md:border-t-0 md:border-l md:overflow-hidden flex flex-col border-[var(--outline-variant)]',
            !activeField && 'hidden md:flex'
          )}
        >
          {activeField ? (
            <>
              <div className="px-4 py-3 border-b flex items-center gap-2 shrink-0 border-[var(--outline-variant)]">
                <FieldTypeIcon type={activeField.type} size={13} className="text-navy-light/50" />
                <p className="text-[12px] font-semibold text-navy font-display">
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
                  activeField.type === 'page_break' ? 'Bloque / Página' :
                  activeField.type === 'personal_data' ? 'Datos personales' : activeField.type}
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
              <p className="text-[12px] text-navy-light/40 font-body">
                Seleccioná un campo para editarlo
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Logic overview modal */}
      {showLogicPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-navy-ink/40 backdrop-blur-sm">
          <div className="h-full w-full max-w-md overflow-y-auto flex flex-col bg-surface-card shadow-[var(--shadow-md)]">
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b shrink-0 border-[var(--outline-variant)] bg-surface-card">
              <div className="flex items-center gap-2">
                <GitBranch size={16} className="text-navy-light/50" />
                <p className="text-sm font-bold text-navy font-display">Lógica del formulario</p>
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
                    <p className="text-[11px] font-bold text-navy-light/50 uppercase tracking-widests font-display">
                      📄 {section.pageLabel}
                    </p>
                    <div className="ml-3 border-l space-y-0.5 pl-3 border-[var(--outline-variant)]">
                      {section.fields.map(f => {
                        const rc = f.logic_rules?.length ?? 0
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => { setActiveFieldId(f.id); setFocusLogic(true); setShowLogicPanel(false) }}
                            className="w-full flex items-center justify-between gap-2 py-1.5 text-left hover:text-coral transition-colors group"
                          >
                            <span className="text-[12px] text-navy-light/60 group-hover:text-navy truncate font-body">
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
                        <p className="text-[11px] text-navy-light/30 italic py-1 font-body">Sin campos</p>
                      )}
                    </div>
                  </div>
                ))
              })()}
            </div>

            <div className="px-5 py-3 border-t text-center border-[var(--outline-variant)]">
              <p className="text-[11px] text-navy-light/40 font-body">
                {fields.filter(f => (f.logic_rules?.length ?? 0) > 0).length} campos con lógica · {fields.filter(f => f.type === 'page_break').length} bloque{fields.filter(f => f.type === 'page_break').length !== 1 ? 's' : ''} · {fields.filter(f => f.type !== 'page_break' && f.type !== 'section').length} campos total
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
