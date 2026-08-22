'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type FormTemplate, type FormFieldNew, type FieldType } from '@/types/forms'
import { HeroEditor } from '@/components/forms/HeroEditor'
import { fieldProblems, saveBlockedMessage } from '@/lib/forms/field-validation'
import { type FormHeroData } from '@/components/forms/FormHero'
import { toDomainFormTemplate } from '@/lib/forms/adapter'
import { isoToWindowYmd } from '@/lib/forms/active-window'
import { FormCanvas } from '@/components/forms/FormCanvas'
import { FieldInspector } from '@/components/forms/FieldInspector'
import { FieldTypeIcon } from '@/components/forms/FieldTypeIcon'
import { cn } from '@/lib/utils'
import { ChevronLeft, Eye, Save, Send, Check, GitBranch, Zap, Loader2, ShieldCheck } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { FormAccessPanel } from './FormAccessPanel'
import { useToast } from '@/components/shared/Toast'

// Tipos estructurales que no exigen label (el separador de página es un divisor).
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
      { type: 'info',       label: 'Texto informativo' },
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
  const toast = useToast()

  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory]       = useState<FormTemplate['category']>('event_registration')
  const [status, setStatus]           = useState<FormStatus>('draft')
  const [fields, setFields]           = useState<FormFieldNew[]>([])
  // FRM-2 · Encabezado del formulario (flyer + título + bienvenida).
  const [hero, setHero]               = useState<FormHeroData>({})
  // Quién puede LLENARLO (2026-08-06). Por defecto NO: si el formulario no
  // cuelga de un evento ni de un grupo y no se manda por correo, no hay a quién
  // ofrecérselo, así que queda cerrado hasta que alguien lo abra a propósito.
  const [isPublic, setIsPublic]       = useState(false)
  // Ventana de vigencia (YYYY-MM-DD, '' = sin límite). Pasada la fecha de fin
  // el estado cambia solo (derivado, sin cron) y deja de aceptar respuestas.
  const [windowStart, setWindowStart] = useState('')
  const [windowEnd, setWindowEnd]     = useState('')
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null)
  const [focusLogic, setFocusLogic]   = useState(false)
  const [showLogicPanel, setShowLogicPanel] = useState(false)
  const [showAccessPanel, setShowAccessPanel] = useState(false)
  const [saved, setSaved]             = useState(false)
  const [saving, setSaving]           = useState(false)
  const [nameError, setNameError]     = useState(false)

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
        setIsPublic(f.is_public)
        setWindowStart(isoToWindowYmd(f.starts_at))
        setWindowEnd(isoToWindowYmd(f.ends_at))
        setFields(f.fields)
        setHero({
          hero_image_url: f.hero_image_url,
          hero_title: f.hero_title,
          hero_subtitle: f.hero_subtitle,
        })
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
    if (!name.trim()) {
      setNameError(true)
      toast('El formulario necesita un nombre', 'error')
      return
    }
    // Campos incompletos: un formulario con campos en blanco es inservible. La
    // regla vive en lib/forms/field-validation (el bloque informativo pide
    // TEXTO, no etiqueta — su título es opcional y así lo dice el inspector).
    const problemas = fieldProblems(fields)
    if (problemas.length > 0) {
      setActiveFieldId(problemas[0].fieldId)
      toast(saveBlockedMessage(fields) ?? 'Hay campos incompletos', 'error')
      return
    }
    setSaving(true)
    const isActive = (nextStatus ?? status) === 'active'
    const payload = {
      name, description, category, is_active: isActive, is_public: isPublic, fields,
      starts_at: windowStart || null,
      ends_at: windowEnd || null,
      hero_image_url: hero.hero_image_url ?? null,
      hero_title: hero.hero_title ?? null,
      hero_subtitle: hero.hero_subtitle ?? null,
    }
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
      toast('No se pudo guardar el formulario. Intentá de nuevo.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col md:h-[calc(100vh-4rem)] -mx-6 -mt-6">
      {/* Top bar */}
      <div
        className="sticky top-0 z-20 flex items-center gap-3 flex-wrap px-4 md:px-6 py-3 border-b shrink-0 bg-surface-card border-[var(--outline-variant)]"
      >
        <Link
          href="/formularios"
          className="flex items-center gap-1 text-sm text-navy-light/80 hover:text-navy transition-colors shrink-0 font-body"
        >
          <ChevronLeft size={16} />
          Formularios
        </Link>
        <span className="text-navy-light/80">|</span>

        {/* Editable name */}
        <div className="flex-1 basis-full md:basis-auto min-w-0">
          <input
            className={cn(
              'w-full bg-transparent text-base font-bold text-navy outline-none min-w-0 placeholder-navy-light/50 font-display tracking-[-0.01em]',
              nameError && 'border-b border-coral'
            )}
            placeholder="Nombre del formulario"
            aria-label="Nombre del formulario"
            aria-invalid={nameError}
            aria-describedby={nameError ? 'form-name-error' : undefined}
            value={name}
            onChange={e => { setName(e.target.value); if (nameError && e.target.value.trim()) setNameError(false) }}
          />
          {nameError && (
            <p id="form-name-error" className="text-[13px] text-coral font-body mt-0.5">
              Escribí un nombre antes de guardar
            </p>
          )}
        </div>

        {/* Category */}
        <select
          className="rounded-xl bg-surface-low px-2.5 py-1.5 text-[13px] text-navy outline-none shrink-0 font-body"
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
            'rounded-full px-2.5 py-1 text-[13px] font-semibold transition-colors shrink-0 font-display',
            status === 'active' ? 'bg-teal-soft/30 text-teal-deep' : 'bg-navy/10 text-navy-light/80'
          )}
        >
          {status === 'active' ? 'Activo' : 'Borrador'}
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowLogicPanel(true)}
            className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
          >
            <GitBranch size={12} />
            Lógica
          </button>
          {formId && (
            <button
              type="button"
              onClick={() => setShowAccessPanel(true)}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
            >
              <ShieldCheck size={12} />
              Accesos
            </button>
          )}
          <Link
            href={formId ? `/formularios/${formId}/preview` : '#'}
            className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
          >
            <Eye size={12} />
            Vista previa
          </Link>
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={saving}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] text-white transition-colors disabled:opacity-50 font-body',
              saved ? 'bg-teal-deep' : 'bg-coral hover:bg-coral-deep'
            )}
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <Check size={12} /> : <Save size={12} />}
            {saving ? 'Guardando…' : saved ? 'Guardado' : 'Guardar'}
          </button>
          {status === 'draft' && (
            <button
              type="button"
              onClick={() => {
                if (!name.trim()) { setNameError(true); return }
                setStatus('active'); handleSave('active')
              }}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-full bg-navy px-3 py-1.5 text-[13px] text-white hover:bg-navy-light transition-colors disabled:opacity-50 font-body"
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
                <p className="text-[11px] uppercase tracking-widest font-semibold text-navy-light/80 px-1 mb-2 font-display">
                  {group.label}
                </p>
                <div className="grid grid-cols-2 gap-1 md:grid-cols-1">
                {group.types.map(({ type, label }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => addField(type)}
                    className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] text-navy-light hover:bg-white hover:text-navy hover:shadow-sm transition-all text-left font-body"
                    draggable
                    onDragStart={e => e.dataTransfer.setData('fieldType', type)}
                  >
                    <FieldTypeIcon type={type} size={13} className="text-navy-light/80 shrink-0" />
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
          {/* Quién puede llenarlo. */}
          <div className="max-w-2xl mx-auto mb-4 rounded-2xl bg-surface-card shadow-[var(--shadow-md)] px-4 py-3">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 accent-coral"
                checked={isPublic}
                onChange={e => setIsPublic(e.target.checked)}
              />
              <span>
                <span className="block text-sm text-navy font-body">Abierto a cualquiera con el link</span>
                <span className="block text-[13px] text-navy-light/80 font-body mt-0.5">
                  {isPublic
                    ? 'Cualquier persona con sesión que tenga el link puede llenarlo. Usalo para los que se comparten por WhatsApp.'
                    : 'Solo lo llena a quien se lo mandes por correo. Si el formulario es de un evento o de un grupo, sus inscritos ya entran sin marcar esto.'}
                </span>
              </span>
            </label>

            {/* Ventana de vigencia: pasada la fecha de fin, el formulario se
                cierra solo (estado derivado; no acepta más respuestas). */}
            <div className="mt-3 pt-3 border-t border-[var(--outline-variant)]">
              <p className="text-sm text-navy font-body">Vigencia (opcional)</p>
              <p className="text-[13px] text-navy-light/80 font-body mt-0.5 mb-2">
                El formulario acepta respuestas solo dentro de estas fechas; al pasar la fecha de fin se cierra automáticamente.
              </p>
              <div className="flex flex-wrap gap-3">
                <label className="text-[13px] text-navy-light/80 font-body">
                  Activo desde
                  <input
                    type="date"
                    value={windowStart}
                    onChange={e => setWindowStart(e.target.value)}
                    className="block mt-1 rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
                  />
                </label>
                <label className="text-[13px] text-navy-light/80 font-body">
                  Hasta (inclusive)
                  <input
                    type="date"
                    value={windowEnd}
                    min={windowStart || undefined}
                    onChange={e => setWindowEnd(e.target.value)}
                    className="block mt-1 rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* FRM-2 · Encabezado, arriba del constructor de campos. */}
          <div className="max-w-2xl mx-auto mb-4">
            <HeroEditor
              value={hero}
              onChange={patch => setHero(prev => ({ ...prev, ...patch }))}
              formName={name}
            />
          </div>

          {/* Description input */}
          <div className="max-w-2xl mx-auto mb-4">
            <input
              className="w-full bg-transparent text-sm text-navy-light/80 outline-none placeholder-navy-light/50 font-body"
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
              <p className="text-center text-[13px] text-navy-light/80 font-body">
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
                <FieldTypeIcon type={activeField.type} size={13} className="text-navy-light/80" />
                <p className="text-[13px] font-semibold text-navy font-display">
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
                  className="ml-auto text-navy-light/80 hover:text-navy transition-colors"
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
                <FieldTypeIcon type="text" size={20} className="text-navy-light/80" />
              </div>
              <p className="text-[13px] text-navy-light/80 font-body">
                Seleccioná un campo para editarlo
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Accesos puntuales a ESTE formulario (ver/exportar respuestas) */}
      {showAccessPanel && formId && (
        <Modal onClose={() => setShowAccessPanel(false)} titleId="accesos-formulario-title" width={520}>
          <div className="flex flex-col">
            <div className="sticky top-0 flex items-center gap-2 px-5 py-4 border-b shrink-0 border-[var(--outline-variant)] bg-surface-card">
              <ShieldCheck size={16} className="text-navy-light/80" />
              <p id="accesos-formulario-title" className="text-sm font-bold text-navy font-display">
                Personas con acceso a este formulario
              </p>
            </div>
            <div className="p-5">
              <FormAccessPanel formId={formId} />
            </div>
          </div>
        </Modal>
      )}

      {/* Logic overview modal */}
      {showLogicPanel && (
        <Modal onClose={() => setShowLogicPanel(false)} titleId="logica-formulario-title" width={448}>
          <div className="flex flex-col">
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b shrink-0 border-[var(--outline-variant)] bg-surface-card">
              <div className="flex items-center gap-2">
                <GitBranch size={16} className="text-navy-light/80" />
                <p id="logica-formulario-title" className="text-sm font-bold text-navy font-display">Lógica del formulario</p>
              </div>
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
                    <p className="text-[13px] font-bold text-navy-light/80 uppercase tracking-widest font-display">
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
                            <span className="text-[13px] text-navy-light/80 group-hover:text-navy truncate font-body">
                              {f.label || <span className="italic text-navy-light/80">Sin etiqueta</span>}
                            </span>
                            {rc > 0 && (
                              <span className="shrink-0 flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5">
                                <Zap size={9} className="text-amber-600" />
                                <span className="text-[11px] font-bold text-amber-600">{rc}</span>
                              </span>
                            )}
                          </button>
                        )
                      })}
                      {section.fields.length === 0 && (
                        <p className="text-[13px] text-navy-light/80 italic py-1 font-body">Sin campos</p>
                      )}
                    </div>
                  </div>
                ))
              })()}
            </div>

            <div className="px-5 py-3 border-t text-center border-[var(--outline-variant)]">
              <p className="text-[13px] text-navy-light/80 font-body">
                {fields.filter(f => (f.logic_rules?.length ?? 0) > 0).length} campos con lógica · {fields.filter(f => f.type === 'page_break').length} bloque{fields.filter(f => f.type === 'page_break').length !== 1 ? 's' : ''} · {fields.filter(f => f.type !== 'page_break' && f.type !== 'section').length} campos total
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
