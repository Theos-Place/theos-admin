'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MOCK_FORM_TEMPLATES, type FormTemplate, type FormFieldNew, type FieldType } from '@/data/mock-forms'
import { FormCanvas } from '@/components/forms/FormCanvas'
import { FieldInspector } from '@/components/forms/FieldInspector'
import { FieldTypeIcon } from '@/components/forms/FieldTypeIcon'
import { cn } from '@/lib/utils'
import { ChevronLeft, Eye, Save, Send, Check } from 'lucide-react'

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
      { type: 'scale',    label: 'Escala'        },
      { type: 'section',  label: 'Separador'     },
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
              onSelectField={setActiveFieldId}
              onDuplicateField={duplicateField}
              onDeleteField={deleteField}
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
                    activeField.type === 'date' ? 'Fecha' : activeField.type}
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
                  onChange={updateField}
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
    </div>
  )
}
