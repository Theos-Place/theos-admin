'use client'

import { useState, useMemo, Fragment, useRef } from 'react'
import Link from 'next/link'
import { ALL_COMMITTEES } from '@/data/mock-committees'
import { RecurrenceSelector } from '@/components/events/RecurrenceSelector'
import { cn } from '@/lib/utils'
import {
  ChevronLeft, ChevronRight, Mic, Tent, Heart, BookOpen, Plus, X,
  Users, Star, MapPin, Music, Coffee, Zap, ExternalLink, Image as ImageIcon,
} from 'lucide-react'
import { EVENT_TYPES, type EventType } from '@/data/mock-events'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  mic: Mic, tent: Tent, users: Users, star: Star, 'book-open': BookOpen,
  heart: Heart, 'map-pin': MapPin, music: Music, coffee: Coffee, zap: Zap,
}

const activeEventTypes = EVENT_TYPES.filter(t => t.is_active)

type SubEventInput = { id: string; name: string; max_capacity: string }

interface FormData {
  name: string
  event_type: EventType | ''
  committee: string
  description: string
  start_date: string
  start_time: string
  end_date: string
  end_time: string
  is_virtual: boolean
  location: string
  location_map_url: string
  is_recurring: boolean
  recurrence_rule: string | null
  sub_events: SubEventInput[]
  requires_registration: boolean
  max_capacity: string
  prerequisite: string
  has_satisfaction_survey: boolean
  requires_payment: boolean
  payment_amount: string
  payment_methods: string[]
  flyer: string | null
}

const STEPS = [
  { num: 1, label: 'Información' },
  { num: 2, label: 'Programación' },
  { num: 3, label: 'Sub-eventos' },
  { num: 4, label: 'Financiero' },
]

function Toggle({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <div className="flex items-center gap-3 cursor-pointer" onClick={onToggle}>
      <div className={cn(
        'relative h-6 w-11 rounded-full transition-all duration-200 cursor-pointer shrink-0',
        checked ? 'bg-coral' : 'bg-navy-light/20'
      )}>
        <div className={cn(
          'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200',
          checked ? 'translate-x-5' : 'translate-x-0'
        )} />
      </div>
      <span className="text-sm text-navy select-none" style={{ fontFamily: 'var(--font-body)' }}>{label}</span>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="flex items-start justify-between gap-4 py-2.5 border-b last:border-0"
      style={{ borderColor: 'var(--outline-variant)' }}
    >
      <span className="text-[11px] tracking-widest uppercase text-navy-light/40 shrink-0 mt-0.5" style={{ fontFamily: 'var(--font-display)' }}>
        {label}
      </span>
      <span className="text-sm text-navy text-right" style={{ fontFamily: 'var(--font-body)' }}>
        {value}
      </span>
    </div>
  )
}

export default function NuevoEventoPage() {
  const [step, setStep] = useState(1)
  const [published, setPublished] = useState(false)
  const [showSubEventForm, setShowSubEventForm] = useState(false)
  const [newSubName, setNewSubName] = useState('')
  const [newSubCap, setNewSubCap] = useState('')
  const [flyer, setFlyer] = useState<string | null>(null)
  const [flyerDragOver, setFlyerDragOver] = useState(false)
  const flyerInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<FormData>({
    name: '',
    event_type: '',
    committee: '',
    description: '',
    start_date: '',
    start_time: '',
    end_date: '',
    end_time: '',
    is_virtual: false,
    location: '',
    location_map_url: '',
    is_recurring: false,
    recurrence_rule: null,
    sub_events: [],
    requires_registration: false,
    max_capacity: '',
    prerequisite: '',
    has_satisfaction_survey: false,
    requires_payment: false,
    payment_amount: '',
    payment_methods: [],
    flyer: null,
  })

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function togglePaymentMethod(m: string) {
    setForm(prev => ({
      ...prev,
      payment_methods: prev.payment_methods.includes(m)
        ? prev.payment_methods.filter(x => x !== m)
        : [...prev.payment_methods, m],
    }))
  }

  function addSubEvent() {
    if (!newSubName.trim()) return
    set('sub_events', [...form.sub_events, {
      id: `sub-${Date.now()}`,
      name: newSubName.trim(),
      max_capacity: newSubCap || '50',
    }])
    setNewSubName('')
    setNewSubCap('')
    setShowSubEventForm(false)
  }

  function removeSubEvent(id: string) {
    set('sub_events', form.sub_events.filter(s => s.id !== id))
  }

  function handleFlyerSelect(file: File) {
    if (file.size > 5 * 1024 * 1024) return // too big, silently skip
    const reader = new FileReader()
    reader.onload = (e) => setFlyer(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  function canProceed(): boolean {
    if (step === 1) return form.name.trim().length > 0 && form.event_type !== ''
    if (step === 2) return form.start_date !== '' && form.start_time !== ''
    return true
  }

  const selectedTypeObj = useMemo(
    () => activeEventTypes.find(t => t.id === form.event_type),
    [form.event_type]
  )

  if (published) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <div className="text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-teal-soft/30 flex items-center justify-center mx-auto">
            <span className="text-2xl">✓</span>
          </div>
          <p className="text-xl font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
            Evento publicado
          </p>
          <p className="text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
            El evento quedó disponible para inscripciones.
          </p>
          <Link
            href="/eventos"
            className="inline-block rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors mt-2"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Ver todos los eventos
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-4">

      {/* Top bar — sticky */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-2xl px-5 py-3"
        style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/eventos"
            className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <ChevronLeft size={16} />
            Volver
          </Link>
          <span className="text-navy-light/20">|</span>
          <span className="text-sm font-semibold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
            Crear evento
          </span>
          {/* Mobile: step indicator */}
          <span
            className="lg:hidden rounded-md bg-navy/10 px-2 py-0.5 text-[10px] font-medium text-navy-light/60"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {step} / {STEPS.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full border px-3.5 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            Guardar borrador
          </button>
          {step < STEPS.length ? (
            <button
              type="button"
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed()}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[12px] text-white transition-colors',
                canProceed() ? 'bg-coral hover:bg-coral-deep' : 'bg-navy-light/20 cursor-not-allowed'
              )}
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Siguiente
              <ChevronRight size={13} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPublished(true)}
              className="rounded-full bg-coral px-3.5 py-1.5 text-[12px] text-white hover:bg-coral-deep transition-colors"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Publicar evento
            </button>
          )}
        </div>
      </div>

      {/* Desktop stepper */}
      <div
        className="hidden lg:flex items-center px-5 py-4 rounded-2xl"
        style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
      >
        {STEPS.map((s, idx) => (
          <Fragment key={s.num}>
            <button
              type="button"
              onClick={() => s.num < step ? setStep(s.num) : undefined}
              className={cn(
                'flex items-center gap-2.5',
                s.num < step ? 'cursor-pointer' : 'cursor-default'
              )}
            >
              <div
                className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors',
                  s.num === step ? 'bg-coral text-white' :
                  s.num < step ? 'bg-teal-deep text-white' :
                  'bg-navy-light/15 text-navy-light/50'
                )}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {s.num < step ? '✓' : s.num}
              </div>
              <span
                className={cn(
                  'text-[12px] font-medium whitespace-nowrap transition-colors',
                  s.num === step ? 'text-navy' :
                  s.num < step ? 'text-teal-deep' :
                  'text-navy-light/40'
                )}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {s.label}
              </span>
            </button>
            {idx < STEPS.length - 1 && (
              <div className="flex-1 h-px mx-4" style={{ background: 'var(--outline-variant)' }} />
            )}
          </Fragment>
        ))}
      </div>

      {/* Paso 1 — Información principal */}
      {step === 1 && (
        <div className="rounded-2xl p-5 space-y-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
          <div>
            <input
              className="w-full border-0 border-b bg-transparent pb-2 text-2xl font-bold text-navy outline-none placeholder:text-navy-light/30 transition-colors"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                borderBottomWidth: '2px',
                borderBottomColor: 'var(--outline-variant)',
              }}
              placeholder="Nombre del evento..."
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
              Tipo de evento
            </label>
            <div className="grid grid-cols-5 gap-2">
              {activeEventTypes.map(t => {
                const Icon = ICON_MAP[t.icon] ?? Mic
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => set('event_type', t.id as EventType)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all duration-150',
                      form.event_type === t.id
                        ? 'border-coral bg-coral/5 text-coral'
                        : 'text-navy-light/60 hover:bg-surface-low'
                    )}
                    style={{ borderColor: form.event_type === t.id ? undefined : 'var(--outline-variant)' }}
                  >
                    <Icon size={18} />
                    <span className="text-[11px] font-medium" style={{ fontFamily: 'var(--font-display)' }}>{t.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
              Comité organizador
            </label>
            <select
              className={inputCls}
              style={{ fontFamily: 'var(--font-body)' }}
              value={form.committee}
              onChange={e => set('committee', e.target.value)}
            >
              <option value="">Seleccionar comité...</option>
              {ALL_COMMITTEES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                Descripción
              </label>
              <span className="text-[10px] text-navy-light/40" style={{ fontFamily: 'var(--font-mono)' }}>
                {form.description.length}/500
              </span>
            </div>
            <textarea
              className={cn(inputCls, 'resize-none')}
              style={{ fontFamily: 'var(--font-body)' }}
              rows={3}
              maxLength={500}
              placeholder="Describe el evento para los participantes..."
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>

          {/* Flyer / Banner */}
          <div className="space-y-2">
            <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
              Flyer o banner del evento
            </label>
            <input
              ref={flyerInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFlyerSelect(f) }}
            />
            {!flyer ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setFlyerDragOver(true) }}
                onDragLeave={() => setFlyerDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setFlyerDragOver(false)
                  const f = e.dataTransfer.files[0]
                  if (f?.type.startsWith('image/')) handleFlyerSelect(f)
                }}
                onClick={() => flyerInputRef.current?.click()}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border-2 border-dashed py-8 cursor-pointer transition-all',
                  flyerDragOver ? 'border-coral bg-coral/5' : 'border-[rgba(22,20,64,0.15)] hover:border-coral/40 hover:bg-surface-low'
                )}
              >
                <ImageIcon size={28} className="text-navy-light/30" />
                <p className="text-[13px] font-medium text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
                  Subí el flyer del evento
                </p>
                <p className="text-[11px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
                  PNG, JPG, WebP — máx 5MB · Recomendado: 1200×630px
                </p>
              </div>
            ) : (
              <div className="relative rounded-xl overflow-hidden border" style={{ borderColor: 'var(--outline-variant)' }}>
                <img src={flyer} alt="Flyer del evento" className="w-full object-cover max-h-48" />
                <div className="absolute bottom-0 inset-x-0 flex gap-2 justify-end p-2" style={{ background: 'rgba(22,20,64,0.6)' }}>
                  <button type="button" onClick={() => flyerInputRef.current?.click()}
                    className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-white bg-white/20 hover:bg-white/30 transition-colors"
                    style={{ fontFamily: 'var(--font-body)' }}>
                    Cambiar
                  </button>
                  <button type="button" onClick={() => setFlyer(null)}
                    className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-coral bg-coral/20 hover:bg-coral/30 transition-colors"
                    style={{ fontFamily: 'var(--font-body)' }}>
                    Eliminar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Paso 2 — Programación y ubicación */}
      {step === 2 && (
        <div className="rounded-2xl p-5 space-y-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Fecha inicio</label>
              <input type="date" className={inputCls} style={{ fontFamily: 'var(--font-body)' }} value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Hora inicio</label>
              <input type="time" className={inputCls} style={{ fontFamily: 'var(--font-body)' }} value={form.start_time} onChange={e => set('start_time', e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Fecha fin</label>
              <input type="date" className={inputCls} style={{ fontFamily: 'var(--font-body)' }} value={form.end_date} onChange={e => set('end_date', e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Hora fin</label>
              <input type="time" className={inputCls} style={{ fontFamily: 'var(--font-body)' }} value={form.end_time} onChange={e => set('end_time', e.target.value)} />
            </div>
          </div>

          <div className="space-y-4 pt-1 border-t" style={{ borderColor: 'var(--outline-variant)' }}>
            <Toggle
              checked={form.is_virtual}
              onToggle={() => set('is_virtual', !form.is_virtual)}
              label="Evento virtual"
            />

            {!form.is_virtual && (
              <div className="space-y-3 pl-14">
                <div className="space-y-1">
                  <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Dirección</label>
                  <input
                    className={inputCls}
                    style={{ fontFamily: 'var(--font-body)' }}
                    placeholder="Dirección exacta del evento..."
                    value={form.location}
                    onChange={e => set('location', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                    Link Waze / Google Maps
                  </label>
                  <div className="flex gap-2">
                    <input
                      className={inputCls}
                      style={{ fontFamily: 'var(--font-body)' }}
                      placeholder="https://maps.google.com/..."
                      value={form.location_map_url}
                      onChange={e => set('location_map_url', e.target.value)}
                    />
                    {form.location_map_url && (
                      <a
                        href={form.location_map_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] text-navy-light hover:bg-surface-low transition-colors"
                        style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                      >
                        <ExternalLink size={13} />
                        Probar
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4 pt-1 border-t" style={{ borderColor: 'var(--outline-variant)' }}>
            <Toggle
              checked={form.is_recurring}
              onToggle={() => set('is_recurring', !form.is_recurring)}
              label="Evento recurrente"
            />
            {form.is_recurring && (
              <div className="pl-14">
                <RecurrenceSelector value={form.recurrence_rule} onChange={v => set('recurrence_rule', v)} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Paso 3 — Sub-eventos e inscripciones */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Sub-eventos */}
          <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <p className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
              Sub-eventos
            </p>

            {form.sub_events.length > 0 && (
              <div className="space-y-2">
                {form.sub_events.map(se => (
                  <div
                    key={se.id}
                    className="flex items-center justify-between rounded-xl px-3 py-2.5"
                    style={{ background: 'var(--surface-low)' }}
                  >
                    <div>
                      <p className="text-sm font-medium text-navy" style={{ fontFamily: 'var(--font-body)' }}>{se.name}</p>
                      <p className="text-[11px] text-navy-light/50">Cap. {se.max_capacity}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSubEvent(se.id)}
                      className="h-7 w-7 rounded-lg flex items-center justify-center text-navy-light/40 hover:text-coral hover:bg-coral/10 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {showSubEventForm ? (
              <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: 'var(--outline-variant)' }}>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className={inputCls}
                    style={{ fontFamily: 'var(--font-body)' }}
                    placeholder="Nombre del sub-evento"
                    value={newSubName}
                    onChange={e => setNewSubName(e.target.value)}
                    autoFocus
                  />
                  <input
                    type="number"
                    className={inputCls}
                    style={{ fontFamily: 'var(--font-body)' }}
                    placeholder="Capacidad"
                    value={newSubCap}
                    onChange={e => setNewSubCap(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addSubEvent}
                    className="rounded-full bg-navy px-3.5 py-1.5 text-[12px] text-white hover:bg-navy/80 transition-colors"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    Agregar
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSubEventForm(false)}
                    className="rounded-full border px-3.5 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors"
                    style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowSubEventForm(true)}
                className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors"
                style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
              >
                <Plus size={13} />
                Añadir sub-evento
              </button>
            )}

            {form.sub_events.length === 0 && !showSubEventForm && (
              <p className="text-[12px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
                Opcional. Agrega divisiones como Kids, Teens o sesiones por día.
              </p>
            )}
          </div>

          {/* Inscripción */}
          <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <Toggle
              checked={form.requires_registration}
              onToggle={() => set('requires_registration', !form.requires_registration)}
              label="Requiere inscripción previa"
            />

            {form.requires_registration && (
              <div className="space-y-3 pl-14">
                <div className="space-y-1">
                  <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                    Capacidad máxima
                  </label>
                  <input
                    type="number"
                    className={inputCls}
                    style={{ fontFamily: 'var(--font-body)' }}
                    placeholder="100"
                    value={form.max_capacity}
                    onChange={e => set('max_capacity', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                    Prerrequisito (opcional)
                  </label>
                  <select
                    className={inputCls}
                    style={{ fontFamily: 'var(--font-body)' }}
                    value={form.prerequisite}
                    onChange={e => set('prerequisite', e.target.value)}
                  >
                    <option value="">Sin prerrequisito</option>
                    <option value="member">Ser miembro activo</option>
                    <option value="server">Ser servidor activo</option>
                    <option value="n1">Haber completado N1</option>
                  </select>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors"
                  style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                >
                  <Plus size={13} />
                  Crear formulario de inscripción
                </button>
              </div>
            )}
          </div>

          {/* Encuesta de satisfacción */}
          <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <Toggle
              checked={form.has_satisfaction_survey}
              onToggle={() => set('has_satisfaction_survey', !form.has_satisfaction_survey)}
              label="Encuesta de satisfacción al finalizar"
            />
            {form.has_satisfaction_survey && (
              <div className="pl-14">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors"
                  style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                >
                  <Plus size={13} />
                  Crear encuesta
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Paso 4 — Financiero + Resumen */}
      {step === 4 && (
        <div className="space-y-4">
          {/* Pago */}
          <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <Toggle
              checked={form.requires_payment}
              onToggle={() => set('requires_payment', !form.requires_payment)}
              label="Evento con cobro"
            />

            {form.requires_payment && (
              <div className="space-y-3 pl-14">
                <div className="space-y-1">
                  <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Monto</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-navy-light/50" style={{ fontFamily: 'var(--font-mono)' }}>₡</span>
                    <input
                      type="number"
                      className={cn(inputCls, 'pl-7')}
                      style={{ fontFamily: 'var(--font-body)' }}
                      placeholder="15000"
                      value={form.payment_amount}
                      onChange={e => set('payment_amount', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Métodos de pago</label>
                  <div className="flex flex-wrap gap-4">
                    {['Tarjeta', 'SINPE Móvil'].map(m => (
                      <label key={m} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="accent-coral"
                          checked={form.payment_methods.includes(m)}
                          onChange={() => togglePaymentMethod(m)}
                        />
                        <span className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>{m}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Resumen */}
          <div className="rounded-2xl p-5 space-y-1" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <p className="text-[11px] tracking-widest uppercase text-navy-light/40 mb-3" style={{ fontFamily: 'var(--font-display)' }}>
              Resumen del evento
            </p>
            <SummaryRow label="Nombre" value={form.name || '—'} />
            <SummaryRow label="Tipo" value={selectedTypeObj?.name ?? '—'} />
            <SummaryRow label="Comité" value={form.committee || '—'} />
            <SummaryRow
              label="Fecha inicio"
              value={
                form.start_date
                  ? new Date(`${form.start_date}T${form.start_time || '00:00'}`).toLocaleString('es-CR', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })
                  : '—'
              }
            />
            <SummaryRow label="Lugar" value={form.is_virtual ? 'Virtual' : form.location || '—'} />
            {form.location_map_url && !form.is_virtual && (
              <SummaryRow
                label="Mapa"
                value={
                  <a
                    href={form.location_map_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-coral underline"
                  >
                    Ver enlace
                  </a>
                }
              />
            )}
            <SummaryRow label="Recurrente" value={form.is_recurring ? 'Sí' : 'No'} />
            <SummaryRow
              label="Sub-eventos"
              value={form.sub_events.length > 0 ? form.sub_events.map(s => s.name).join(', ') : 'Ninguno'}
            />
            <SummaryRow
              label="Inscripción"
              value={form.requires_registration
                ? `Sí${form.max_capacity ? ` · Cap. ${form.max_capacity}` : ''}`
                : 'No requerida'
              }
            />
            <SummaryRow
              label="Cobro"
              value={form.requires_payment && form.payment_amount
                ? `₡${Number(form.payment_amount).toLocaleString('es-CR')}`
                : 'Gratuito'
              }
            />
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex-1 rounded-xl border py-3 text-sm text-navy-light hover:bg-surface-low transition-colors"
              style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
            >
              Guardar como borrador
            </button>
            <button
              type="button"
              onClick={() => setPublished(true)}
              className="flex-1 rounded-xl bg-coral py-3 text-sm text-white hover:bg-coral-deep transition-colors"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Publicar evento
            </button>
          </div>
        </div>
      )}

      {/* Back link */}
      {step > 1 && (
        <button
          type="button"
          onClick={() => setStep(s => s - 1)}
          className="inline-flex items-center gap-1.5 text-sm text-navy-light/50 hover:text-navy transition-colors"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          <ChevronLeft size={14} />
          Paso anterior
        </button>
      )}
    </div>
  )
}
