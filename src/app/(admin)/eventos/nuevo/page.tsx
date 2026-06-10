'use client'

import { useState, useMemo, useRef } from 'react'
import { useToast } from '@/components/shared/Toast'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { EVENT_TYPES, type EventType } from '@/data/mock-events'
import { StepSidebar } from './_components/StepSidebar'
import { Step1Informacion } from './_components/Step1Informacion'
import { Step2Programacion } from './_components/Step2Programacion'
import { Step3SubEventos } from './_components/Step3SubEventos'
import { Step4Financiero } from './_components/Step4Financiero'

// ─── Types ────────────────────────────────────────────────────────────────────

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

const STEPS_COUNT = 4

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NuevoEventoPage() {
  const toast = useToast()
  const [step, setStep]                         = useState(1)
  const [published, setPublished]               = useState(false)
  const [showSubEventForm, setShowSubEventForm] = useState(false)
  const [newSubName, setNewSubName]             = useState('')
  const [newSubCap, setNewSubCap]               = useState('')
  const [flyer, setFlyer]                       = useState<string | null>(null)
  const [flyerDragOver, setFlyerDragOver]       = useState(false)
  const flyerInputRef                           = useRef<HTMLInputElement>(null)

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
    if (file.size > 5 * 1024 * 1024) return
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
    () => EVENT_TYPES.filter(t => t.is_active).find(t => t.id === form.event_type),
    [form.event_type],
  )

  const [submitting, setSubmitting] = useState(false)

  async function handlePublish() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, flyer }),
      })
      if (!res.ok) throw new Error('Error creando el evento')
      setPublished(true)
    } catch (e) {
      console.error(e)
      toast('No se pudo crear el evento. Revisá los datos e intentá de nuevo.', 'error')
      setSubmitting(false)
    }
  }

  // ── Estado: publicado ──────────────────────────────────────────────────────

  if (published) {
    return (
      <div className="page">
        <div className="ph">
          <div className="ptitle">Crear evento</div>
        </div>
        <div className="card p-10 text-center">
          <div className="h-14 w-14 rounded-full bg-teal-soft/30 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✓</span>
          </div>
          <p
            className="text-xl font-bold text-navy mb-2 font-display"
          >
            Evento publicado
          </p>
          <p
            className="text-sm text-navy-light/60 mb-6 font-body"
          >
            El evento quedó disponible para inscripciones.
          </p>
          <Link
            href="/eventos"
            className="btn btn-primary inline-flex mx-auto"
          >
            Ver todos los eventos
          </Link>
        </div>
      </div>
    )
  }

  // ── Layout principal ───────────────────────────────────────────────────────

  return (
    <div className="page">

      {/* ── Header ── */}
      <div className="ph">
        <div className="ph-row">
          <div>
            <div className="ptitle">Crear evento</div>
            <div className="psub">Completá los pasos para publicar un nuevo evento</div>
          </div>
          <div className="ph-actions">
            <button type="button" className="btn btn-ghost btn-sm">
              Guardar borrador
            </button>
            {step < STEPS_COUNT ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setStep(s => s + 1)}
                disabled={!canProceed()}
              >
                Siguiente <ChevronRight size={13} />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handlePublish}
                disabled={submitting}
              >
                {submitting ? 'Publicando…' : 'Publicar evento'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Grid: stepper sidebar + contenido ── */}
      <div
        className="sidebar-content-grid grid grid-cols-[clamp(180px,20%,240px)_1fr] gap-6 w-full items-start"
      >
        {/* Sidebar de pasos */}
        <StepSidebar step={step} onStepClick={setStep} />

        {/* Contenido del paso activo */}
        <div className="w-full min-w-0">

          {step === 1 && (
            <Step1Informacion
              name={form.name}
              event_type={form.event_type}
              committee={form.committee}
              description={form.description}
              flyer={flyer}
              flyerDragOver={flyerDragOver}
              flyerInputRef={flyerInputRef}
              onNameChange={v => set('name', v)}
              onEventTypeChange={v => set('event_type', v)}
              onCommitteeChange={v => set('committee', v)}
              onDescriptionChange={v => set('description', v)}
              onFlyerSelect={handleFlyerSelect}
              onFlyerDragOver={setFlyerDragOver}
              onFlyerRemove={() => setFlyer(null)}
            />
          )}

          {step === 2 && (
            <Step2Programacion
              start_date={form.start_date}
              start_time={form.start_time}
              end_date={form.end_date}
              end_time={form.end_time}
              is_virtual={form.is_virtual}
              location={form.location}
              location_map_url={form.location_map_url}
              is_recurring={form.is_recurring}
              recurrence_rule={form.recurrence_rule}
              onStartDateChange={v => set('start_date', v)}
              onStartTimeChange={v => set('start_time', v)}
              onEndDateChange={v => set('end_date', v)}
              onEndTimeChange={v => set('end_time', v)}
              onToggleVirtual={() => set('is_virtual', !form.is_virtual)}
              onLocationChange={v => set('location', v)}
              onLocationMapUrlChange={v => set('location_map_url', v)}
              onToggleRecurring={() => set('is_recurring', !form.is_recurring)}
              onRecurrenceRuleChange={v => set('recurrence_rule', v)}
            />
          )}

          {step === 3 && (
            <Step3SubEventos
              sub_events={form.sub_events}
              showSubEventForm={showSubEventForm}
              newSubName={newSubName}
              newSubCap={newSubCap}
              requires_registration={form.requires_registration}
              max_capacity={form.max_capacity}
              prerequisite={form.prerequisite}
              has_satisfaction_survey={form.has_satisfaction_survey}
              onSetShowSubEventForm={setShowSubEventForm}
              onNewSubNameChange={setNewSubName}
              onNewSubCapChange={setNewSubCap}
              onAddSubEvent={addSubEvent}
              onRemoveSubEvent={removeSubEvent}
              onToggleRegistration={() => set('requires_registration', !form.requires_registration)}
              onMaxCapacityChange={v => set('max_capacity', v)}
              onPrerequisiteChange={v => set('prerequisite', v)}
              onToggleSatisfactionSurvey={() => set('has_satisfaction_survey', !form.has_satisfaction_survey)}
            />
          )}

          {step === 4 && (
            <Step4Financiero
              requires_payment={form.requires_payment}
              payment_amount={form.payment_amount}
              payment_methods={form.payment_methods}
              name={form.name}
              event_type={form.event_type}
              selectedTypeName={selectedTypeObj?.name}
              committee={form.committee}
              start_date={form.start_date}
              start_time={form.start_time}
              is_virtual={form.is_virtual}
              location={form.location}
              location_map_url={form.location_map_url}
              is_recurring={form.is_recurring}
              sub_events={form.sub_events}
              requires_registration={form.requires_registration}
              max_capacity={form.max_capacity}
              onTogglePayment={() => set('requires_payment', !form.requires_payment)}
              onPaymentAmountChange={v => set('payment_amount', v)}
              onTogglePaymentMethod={togglePaymentMethod}
            />
          )}

          {/* Navegación inferior */}
          {step > 1 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                className="btn btn-ghost btn-sm"
              >
                ← Paso anterior
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
