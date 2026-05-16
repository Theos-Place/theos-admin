'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ALL_COMMITTEES } from '@/data/mock-committees'
import { RecurrenceSelector } from '@/components/events/RecurrenceSelector'
import { cn } from '@/lib/utils'
import {
  ChevronLeft, ChevronDown, ChevronUp, Mic, Tent, Heart, BookOpen, Plus, X,
  Users, Star, MapPin, Music, Coffee, Zap,
} from 'lucide-react'
import { EVENT_TYPES, type EventType } from '@/data/mock-events'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  mic: Mic, tent: Tent, users: Users, star: Star, 'book-open': BookOpen,
  heart: Heart, 'map-pin': MapPin, music: Music, coffee: Coffee, zap: Zap,
}

const activeEventTypes = EVENT_TYPES.filter(t => t.is_active)

type SubEventInput = { id: string; name: string; max_capacity: string }

function Section({
  id, title, open, onToggle, children,
}: {
  id: string; title: string; open: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-low transition-colors"
      >
        <span className="text-sm font-semibold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
          {title}
        </span>
        {open ? <ChevronUp size={16} className="text-navy-light/40" /> : <ChevronDown size={16} className="text-navy-light/40" />}
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-4 border-t" style={{ borderColor: 'var(--outline-variant)' }}>
          <div className="pt-4">{children}</div>
        </div>
      )}
    </div>
  )
}

export default function NuevoEventoPage() {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['info']))
  const [name, setName] = useState('')
  const [selectedType, setSelectedType] = useState<EventType | ''>('')
  const [committee, setCommittee] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('')
  const [isVirtual, setIsVirtual] = useState(false)
  const [location, setLocation] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceRule, setRecurrenceRule] = useState<string | null>(null)
  const [subEvents, setSubEvents] = useState<SubEventInput[]>([])
  const [showSubEventForm, setShowSubEventForm] = useState(false)
  const [newSubName, setNewSubName] = useState('')
  const [newSubCap, setNewSubCap] = useState('')
  const [requiresRegistration, setRequiresRegistration] = useState(false)
  const [maxCapacity, setMaxCapacity] = useState('')
  const [requiresPayment, setRequiresPayment] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethods, setPaymentMethods] = useState<string[]>([])
  const [published, setPublished] = useState(false)

  function toggleSection(id: string) {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function addSubEvent() {
    if (!newSubName.trim()) return
    setSubEvents(prev => [...prev, {
      id: `sub-${Date.now()}`,
      name: newSubName.trim(),
      max_capacity: newSubCap || '50',
    }])
    setNewSubName('')
    setNewSubCap('')
    setShowSubEventForm(false)
  }

  function removeSubEvent(id: string) {
    setSubEvents(prev => prev.filter(s => s.id !== id))
  }

  function togglePaymentMethod(m: string) {
    setPaymentMethods(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

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
      {/* Sticky top bar */}
      <div
        className="sticky top-0 z-10 -mx-1 flex items-center justify-between gap-3 rounded-2xl px-5 py-3"
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
          <span
            className="rounded-md bg-navy/10 px-2 py-0.5 text-[10px] font-medium text-navy-light/60"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Borrador
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-full border px-3.5 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            Guardar borrador
          </button>
          <button
            onClick={() => setPublished(true)}
            className="rounded-full bg-coral px-3.5 py-1.5 text-[12px] text-white hover:bg-coral-deep transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Publicar
          </button>
        </div>
      </div>

      {/* Sección 1 — Info principal */}
      <Section id="info" title="① Información principal" open={openSections.has('info')} onToggle={() => toggleSection('info')}>
        <div className="space-y-4">
          <div>
            <input
              className="w-full border-0 border-b bg-transparent pb-2 text-2xl font-bold text-navy outline-none placeholder:text-navy-light/30 focus:border-coral/40 transition-colors"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 700, borderBottomWidth: '2px', borderBottomColor: 'var(--outline-variant)' }}
              placeholder="Nombre del evento..."
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
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
                    onClick={() => setSelectedType(t.id as EventType)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all duration-150',
                      selectedType === t.id
                        ? 'border-coral bg-coral/5 text-coral'
                        : 'text-navy-light/60 hover:bg-surface-low'
                    )}
                    style={{ borderColor: selectedType === t.id ? undefined : 'var(--outline-variant)' }}
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
              value={committee}
              onChange={e => setCommittee(e.target.value)}
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
                {description.length}/500
              </span>
            </div>
            <textarea
              className={cn(inputCls, 'resize-none')}
              style={{ fontFamily: 'var(--font-body)' }}
              rows={3}
              maxLength={500}
              placeholder="Describe el evento para los participantes..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
        </div>
      </Section>

      {/* Sección 2 — Programación */}
      <Section id="schedule" title="② Programación y ubicación" open={openSections.has('schedule')} onToggle={() => toggleSection('schedule')}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                Fecha inicio
              </label>
              <input type="date" className={inputCls} style={{ fontFamily: 'var(--font-body)' }} value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                Hora inicio
              </label>
              <input type="time" className={inputCls} style={{ fontFamily: 'var(--font-body)' }} value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                Fecha fin
              </label>
              <input type="date" className={inputCls} style={{ fontFamily: 'var(--font-body)' }} value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                Hora fin
              </label>
              <input type="time" className={inputCls} style={{ fontFamily: 'var(--font-body)' }} value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setIsVirtual(v => !v)}
              className={cn(
                'relative h-5 w-9 rounded-full transition-all duration-200 cursor-pointer',
                isVirtual ? 'bg-coral' : 'bg-navy-light/20'
              )}
            >
              <div className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200', isVirtual ? 'translate-x-4' : 'translate-x-0.5')} />
            </div>
            <span className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
              Evento virtual
            </span>
          </label>

          {!isVirtual && (
            <div className="space-y-1 transition-all">
              <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                Dirección
              </label>
              <input
                className={inputCls}
                style={{ fontFamily: 'var(--font-body)' }}
                placeholder="Dirección exacta del evento..."
                value={location}
                onChange={e => setLocation(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setIsRecurring(r => !r)}
                className={cn(
                  'relative h-5 w-9 rounded-full transition-all duration-200 cursor-pointer',
                  isRecurring ? 'bg-coral' : 'bg-navy-light/20'
                )}
              >
                <div className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200', isRecurring ? 'translate-x-4' : 'translate-x-0.5')} />
              </div>
              <span className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                Evento recurrente
              </span>
            </label>
            {isRecurring && (
              <div className="pl-12">
                <RecurrenceSelector value={recurrenceRule} onChange={setRecurrenceRule} />
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* Sección 3 — Sub-eventos */}
      <Section id="subevents" title="③ Sub-eventos" open={openSections.has('subevents')} onToggle={() => toggleSection('subevents')}>
        <div className="space-y-3">
          {subEvents.length > 0 && (
            <div className="space-y-2">
              {subEvents.map(se => (
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
            <div className="rounded-xl border p-3 space-y-2 transition-all" style={{ borderColor: 'var(--outline-variant)' }}>
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

          {subEvents.length === 0 && !showSubEventForm && (
            <p className="text-[12px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
              Agrega sub-eventos como Kids, Teens o divisiones por día.
            </p>
          )}
        </div>
      </Section>

      {/* Sección 4 — Inscripciones */}
      <Section id="registration" title="④ Inscripciones" open={openSections.has('registration')} onToggle={() => toggleSection('registration')}>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setRequiresRegistration(r => !r)}
              className={cn(
                'relative h-5 w-9 rounded-full transition-all duration-200 cursor-pointer',
                requiresRegistration ? 'bg-coral' : 'bg-navy-light/20'
              )}
            >
              <div className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200', requiresRegistration ? 'translate-x-4' : 'translate-x-0.5')} />
            </div>
            <span className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
              Requiere inscripción previa
            </span>
          </label>

          {requiresRegistration && (
            <div className="space-y-3 pl-1 transition-all">
              <div className="space-y-1">
                <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                  Capacidad máxima
                </label>
                <input
                  type="number"
                  className={inputCls}
                  style={{ fontFamily: 'var(--font-body)' }}
                  placeholder="100"
                  value={maxCapacity}
                  onChange={e => setMaxCapacity(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                  Prerrequisito (opcional)
                </label>
                <select
                  className={inputCls}
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  <option value="">Sin prerrequisito</option>
                  <option value="member">Ser miembro activo</option>
                  <option value="server">Ser servidor activo</option>
                  <option value="n1">Haber completado N1</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* Sección 5 — Financiero */}
      <Section id="finance" title="⑤ Financiero" open={openSections.has('finance')} onToggle={() => toggleSection('finance')}>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setRequiresPayment(r => !r)}
              className={cn(
                'relative h-5 w-9 rounded-full transition-all duration-200 cursor-pointer',
                requiresPayment ? 'bg-coral' : 'bg-navy-light/20'
              )}
            >
              <div className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200', requiresPayment ? 'translate-x-4' : 'translate-x-0.5')} />
            </div>
            <span className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
              Evento con cobro
            </span>
          </label>

          {requiresPayment && (
            <div className="space-y-3 pl-1 transition-all">
              <div className="space-y-1">
                <label className="text-[11px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                  Monto
                </label>
                <div className="relative">
                  <span
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-navy-light/50"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    ₡
                  </span>
                  <input
                    type="number"
                    className={cn(inputCls, 'pl-7')}
                    style={{ fontFamily: 'var(--font-body)' }}
                    placeholder="15000"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                  Métodos de pago
                </label>
                <div className="flex flex-wrap gap-2">
                  {['Tarjeta', 'SINPE Móvil'].map(m => (
                    <label
                      key={m}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="accent-coral"
                        checked={paymentMethods.includes(m)}
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
      </Section>
    </div>
  )
}
