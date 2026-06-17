'use client'

import { use, useState, useEffect } from 'react'
import { useToast } from '@/components/shared/Toast'
import { Modal } from '@/components/shared/Modal'
import Link from 'next/link'
import { type EventType } from '@/data/event-config'
import { useEventTypes } from '@/hooks/useEventTypes'
import { useEvent } from '@/hooks/useEvents'
import { useOrg } from '@/lib/org'
import { RecurrenceSelector } from '@/components/events/RecurrenceSelector'
import { DatePicker } from '@/components/events/DatePicker'
import { TimePicker } from '@/components/events/TimePicker'
import { cn } from '@/lib/utils'
import {
  ChevronLeft, ChevronDown, ChevronUp, Mic, Tent, Heart, BookOpen, Plus, X,
  Users, Star, MapPin, Music, Coffee, Zap,
} from 'lucide-react'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  mic: Mic, tent: Tent, users: Users, star: Star, 'book-open': BookOpen,
  heart: Heart, 'map-pin': MapPin, music: Music, coffee: Coffee, zap: Zap,
}

type SubEventInput = { id: string; name: string; max_capacity: string }

type RecurringScope = 'single' | 'future' | 'all'

function Section({ id, title, open, onToggle, children }: {
  id: string; title: string; open: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-low transition-colors">
        <span className="text-sm font-semibold text-navy font-display">{title}</span>
        {open ? <ChevronUp size={16} className="text-navy-light/60" /> : <ChevronDown size={16} className="text-navy-light/60" />}
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-t-[var(--outline-variant)]">
          <div className="pt-4">{children}</div>
        </div>
      )}
    </div>
  )
}

function RecurringSaveModal({
  registrationCount,
  onConfirm,
  onClose,
}: {
  registrationCount: number
  onConfirm: (scope: RecurringScope, notify: boolean) => void
  onClose: () => void
}) {
  const [scope, setScope] = useState<RecurringScope>('single')
  const [notify, setNotify] = useState(false)

  const SCOPE_OPTIONS: { key: RecurringScope; title: string; desc: string; warn?: boolean }[] = [
    { key: 'single', title: 'Solo esta instancia', desc: 'Modifica solo este evento, el resto de la serie no cambia.' },
    { key: 'future', title: 'Esta y las futuras', desc: 'Aplica los cambios a este evento y a todos los que vienen después.' },
    { key: 'all', title: 'Toda la serie', desc: 'Modifica todos los eventos de esta serie, incluyendo los pasados.', warn: true },
  ]

  return (
    <Modal onClose={onClose} titleId="guardar-cambios-recurrente-titulo" width={448}>
        <div className="px-5 py-4 border-b border-b-[var(--outline-variant)]">
          <h3 id="guardar-cambios-recurrente-titulo" className="text-sm font-semibold text-navy font-display">
            Guardar cambios
          </h3>
          <p className="text-[12px] text-navy-light/60 mt-0.5 font-body">
            Este es un evento recurrente. ¿A cuántas instancias aplicar los cambios?
          </p>
        </div>
        <div className="p-5 space-y-3">
          {SCOPE_OPTIONS.map(opt => (
            <div
              key={opt.key}
              onClick={() => setScope(opt.key)}
              className={cn(
                'rounded-xl border p-3.5 cursor-pointer transition-all',
                scope === opt.key ? 'border-coral bg-coral/5' : 'hover:bg-surface-low'
              )}
              style={{ borderColor: scope === opt.key ? undefined : 'var(--outline-variant)' }}
            >
              <div className="flex items-start gap-2">
                <div className={cn(
                  'mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0',
                  scope === opt.key ? 'border-coral' : 'border-navy-light/30'
                )}>
                  {scope === opt.key && <div className="h-2 w-2 rounded-full bg-coral" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-navy font-body">{opt.title}</p>
                    {opt.warn && (
                      <span className="rounded-md bg-coral/10 px-1.5 py-0.5 text-[9px] font-semibold text-coral uppercase font-display">
                        Atención
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-navy-light/60 mt-0.5 font-body">{opt.desc}</p>
                </div>
              </div>
            </div>
          ))}

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input type="checkbox" className="accent-coral" checked={notify} onChange={e => setNotify(e.target.checked)} />
            <span className="text-sm text-navy-light/70 font-body">
              Notificar a los {registrationCount} inscritos
            </span>
          </label>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onConfirm(scope, notify)}
              className="flex-1 rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body"
            >
              Guardar cambios
            </button>
            <button
              onClick={onClose}
              className="rounded-full border border-[var(--outline-variant)] px-5 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
            >
              Cancelar
            </button>
          </div>
        </div>
    </Modal>
  )
}

export default function EditarEventoPage({ params }: { params: Promise<{ id: string }> }) {
  const toast = useToast()
  const { adminCommittees } = useOrg()
  const { id } = use(params)
  const { event, loading } = useEvent(id)
  const activeEventTypes = useEventTypes() // catálogo real de la BD (solo activos)

  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['info']))
  const [name, setName] = useState(event?.name ?? '')
  const [selectedType, setSelectedType] = useState<EventType | ''>(event?.event_type ?? '')
  const [committee, setCommittee] = useState(event?.committee_id ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [startDate, setStartDate] = useState(event ? event.start_at.split('T')[0] : '')
  const [startTime, setStartTime] = useState(event ? event.start_at.split('T')[1]?.slice(0, 5) : '')
  const [endDate, setEndDate] = useState(event ? event.end_at.split('T')[0] : '')
  const [endTime, setEndTime] = useState(event ? event.end_at.split('T')[1]?.slice(0, 5) : '')
  const [isVirtual, setIsVirtual] = useState(event?.is_virtual ?? false)
  const [virtualLink, setVirtualLink] = useState(event?.virtual_url ?? '')
  const [location, setLocation] = useState(event?.location ?? '')
  const [isRecurring, setIsRecurring] = useState(event?.is_recurring ?? false)
  const [recurrenceRule, setRecurrenceRule] = useState<string | null>(event?.recurrence_rule ?? null)
  const [subEvents, setSubEvents] = useState<SubEventInput[]>(
    event?.sub_events.map(se => ({ id: se.id, name: se.name, max_capacity: String(se.max_capacity) })) ?? []
  )
  const [showSubEventForm, setShowSubEventForm] = useState(false)
  const [newSubName, setNewSubName] = useState('')
  const [newSubCap, setNewSubCap] = useState('')
  const [requiresRegistration, setRequiresRegistration] = useState(event?.requires_registration ?? false)
  const [maxCapacity, setMaxCapacity] = useState(event ? String(event.max_capacity) : '')
  const [requiresPayment, setRequiresPayment] = useState(event?.requires_payment ?? false)
  const [paymentAmount, setPaymentAmount] = useState(event?.payment_amount ? String(event.payment_amount) : '')
  const [paymentMethods, setPaymentMethods] = useState<string[]>(['SINPE Móvil'])
  const [showRecurringModal, setShowRecurringModal] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  // Poblar el formulario cuando carga el evento (fetch async).
  useEffect(() => {
    if (!event) return
    setName(event.name ?? '')
    setSelectedType(event.event_type ?? '')
    setCommittee(event.committee_id ?? '')
    setDescription(event.description ?? '')
    setStartDate(event.start_at.split('T')[0])
    setStartTime(event.start_at.split('T')[1]?.slice(0, 5) ?? '')
    setEndDate(event.end_at ? event.end_at.split('T')[0] : '')
    setEndTime(event.end_at ? (event.end_at.split('T')[1]?.slice(0, 5) ?? '') : '')
    setIsVirtual(event.is_virtual ?? false)
    setVirtualLink(event.virtual_url ?? '')
    setLocation(event.location ?? '')
    setIsRecurring(event.is_recurring ?? false)
    setRecurrenceRule(event.recurrence_rule ?? null)
    setSubEvents(event.sub_events.map(se => ({ id: se.id, name: se.name, max_capacity: String(se.max_capacity) })))
    setRequiresRegistration(event.requires_registration ?? false)
    setMaxCapacity(String(event.max_capacity ?? ''))
    setRequiresPayment(event.requires_payment ?? false)
    setPaymentAmount(event.payment_amount ? String(event.payment_amount) : '')
  }, [event])

  if (!event) {
    return (
      <div className="space-y-4">
        <Link href="/eventos" className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy">
          <ChevronLeft size={16} /> Eventos
        </Link>
        <p className="text-navy-light/60 font-body">{loading ? 'Cargando…' : 'Evento no encontrado.'}</p>
      </div>
    )
  }

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
    setSubEvents(prev => [...prev, { id: `sub-${Date.now()}`, name: newSubName.trim(), max_capacity: newSubCap || '50' }])
    setNewSubName('')
    setNewSubCap('')
    setShowSubEventForm(false)
  }

  function removeSubEvent(subId: string) {
    setSubEvents(prev => prev.filter(s => s.id !== subId))
  }

  function togglePaymentMethod(m: string) {
    setPaymentMethods(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  async function doSave() {
    setSaving(true)
    const body = {
      name, event_type: selectedType, committee, description,
      start_date: startDate, start_time: startTime,
      end_date: endDate, end_time: endTime,
      is_virtual: isVirtual, virtual_link: virtualLink, location,
      is_recurring: isRecurring, recurrence_rule: recurrenceRule,
      requires_registration: requiresRegistration, max_capacity: maxCapacity,
      requires_payment: requiresPayment, payment_amount: paymentAmount,
      sub_events: subEvents,
    }
    try {
      const res = await fetch(`/api/events/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Error guardando cambios')
      setSaved(true)
    } catch (e) {
      console.error(e)
      toast('No se pudieron guardar los cambios. Intentá de nuevo.', 'error')
      setSaving(false)
    }
  }

  function handleSave() {
    if (event!.is_recurring) {
      setShowRecurringModal(true)
    } else {
      doSave()
    }
  }

  function handleRecurringSave() {
    setShowRecurringModal(false)
    doSave()
  }

  if (saved) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <div className="text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-teal-soft/30 flex items-center justify-center mx-auto">
            <span className="text-2xl text-teal-deep">✓</span>
          </div>
          <p className="text-xl font-bold text-navy font-display">
            Cambios guardados
          </p>
          <p className="text-sm text-navy-light/60 font-body">
            El evento fue actualizado correctamente.
          </p>
          <Link
            href={`/eventos/${id}`}
            className="inline-block rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors mt-2 font-body"
          >
            Ver evento
          </Link>
        </div>
      </div>
    )
  }

  // El fin nunca puede ser anterior al inicio (fecha + hora).
  const startTs = startDate ? new Date(`${startDate}T${startTime || '00:00'}`).getTime() : null
  const endTs = endDate ? new Date(`${endDate}T${endTime || '00:00'}`).getTime() : null
  const endBeforeStart = startTs !== null && endTs !== null && endTs < startTs

  return (
    <div className="max-w-2xl space-y-4">
      {showRecurringModal && (
        <RecurringSaveModal
          registrationCount={event.registrations.length}
          onConfirm={handleRecurringSave}
          onClose={() => setShowRecurringModal(false)}
        />
      )}

      {/* Sticky bar */}
      <div
        className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 sm:px-5 bg-surface-card shadow-[var(--shadow-md)]"
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            href={`/eventos/${id}`}
            className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors font-body"
          >
            <ChevronLeft size={16} />
            Volver
          </Link>
          <span className="text-navy-light/60">|</span>
          <span className="text-sm font-semibold text-navy font-display">
            Editar evento
          </span>
          {event.is_recurring && (
            <span className="rounded-md bg-navy/10 px-2 py-0.5 text-[10px] text-navy-light/60 font-display">
              Recurrente
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/eventos/${id}`}
            className="rounded-full border border-[var(--outline-variant)] px-3.5 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors font-body"
          >
            Descartar
          </Link>
          <button
            onClick={handleSave}
            disabled={saving || endBeforeStart}
            className="rounded-full bg-coral px-3.5 py-1.5 text-[12px] text-white hover:bg-coral-deep transition-colors disabled:opacity-50 font-body"
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {/* Sección 1 */}
      <Section id="info" title="① Información principal" open={openSections.has('info')} onToggle={() => toggleSection('info')}>
        <div className="space-y-4">
          <div>
            <input
              className="w-full border-0 border-b border-b-2 border-b-[var(--outline-variant)] bg-transparent pb-2 text-2xl font-bold text-navy outline-none placeholder:text-navy-light/50 transition-colors font-display"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] tracking-widests uppercase text-navy-light/60 font-display">Tipo</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {activeEventTypes.map(t => {
                const Icon = ICON_MAP[t.icon] ?? Mic
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedType(t.id as EventType)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all duration-150',
                      selectedType === t.id ? 'border-coral bg-coral/5 text-coral' : 'text-navy-light/60 hover:bg-surface-low'
                    )}
                    style={{ borderColor: selectedType === t.id ? undefined : 'var(--outline-variant)' }}
                  >
                    <Icon size={18} />
                    <span className="text-[11px] font-medium font-display">{t.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] tracking-widests uppercase text-navy-light/60 font-display">Comité</label>
            <select className={cn(inputCls, 'font-body')} value={committee} onChange={e => setCommittee(e.target.value)}>
              <option value="">Seleccionar comité...</option>
              {adminCommittees.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] tracking-widests uppercase text-navy-light/60 font-display">Descripción</label>
              <span className="text-[10px] text-navy-light/60 font-mono">{description.length}/500</span>
            </div>
            <textarea
              className={cn(inputCls, 'resize-none', 'font-body')}
              rows={3}
              maxLength={500}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
        </div>
      </Section>

      {/* Sección 2 */}
      <Section id="schedule" title="② Programación y ubicación" open={openSections.has('schedule')} onToggle={() => toggleSection('schedule')}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] tracking-widests uppercase text-navy-light/60 font-display">Fecha inicio</label>
              <DatePicker value={startDate} onChange={setStartDate} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] tracking-widests uppercase text-navy-light/60 font-display">Hora inicio</label>
              <TimePicker value={startTime} onChange={setStartTime} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] tracking-widests uppercase text-navy-light/60 font-display">Fecha fin</label>
              <DatePicker value={endDate} onChange={setEndDate} min={startDate || undefined} error={endBeforeStart} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] tracking-widests uppercase text-navy-light/60 font-display">Hora fin</label>
              <TimePicker value={endTime} onChange={setEndTime} error={endBeforeStart} min={endDate && endDate === startDate ? startTime || undefined : undefined} />
            </div>
          </div>
          {endBeforeStart && (
            <p className="text-[12px] text-coral font-body" role="alert">
              La fecha y hora de fin no pueden ser anteriores a las de inicio.
            </p>
          )}
          <label className="flex items-center gap-3 cursor-pointer">
            <button type="button" role="switch" aria-checked={isVirtual} aria-label="Evento virtual" onClick={() => setIsVirtual(v => !v)} className={cn('relative h-5 w-9 rounded-full transition-all duration-200 cursor-pointer', isVirtual ? 'bg-coral' : 'bg-navy-light/20')}><span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200', isVirtual ? 'translate-x-4' : 'translate-x-0.5')} /></button>
            <span className="text-sm text-navy font-body">Virtual</span>
          </label>
          {!isVirtual && (
            <div className="space-y-1">
              <label className="text-[11px] tracking-widests uppercase text-navy-light/60 font-display">Dirección</label>
              <input className={cn(inputCls, 'font-body')} value={location} onChange={e => setLocation(e.target.value)} />
            </div>
          )}
          {isVirtual && (
            <div className="space-y-1">
              <label className="text-[11px] tracking-widests uppercase text-navy-light/60 font-display">Link de la reunión virtual (opcional)</label>
              <input className={cn(inputCls, 'font-body')} placeholder="https://zoom.us/... o https://meet.google.com/..." value={virtualLink} onChange={e => setVirtualLink(e.target.value)} />
            </div>
          )}
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <button type="button" role="switch" aria-checked={isRecurring} aria-label="Evento recurrente" onClick={() => { const next = !isRecurring; setIsRecurring(next); if (!next) setRecurrenceRule(null) }} className={cn('relative h-5 w-9 rounded-full transition-all duration-200 cursor-pointer', isRecurring ? 'bg-coral' : 'bg-navy-light/20')}><span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200', isRecurring ? 'translate-x-4' : 'translate-x-0.5')} /></button>
              <span className="text-sm text-navy font-body">Recurrente</span>
            </label>
            {isRecurring && (
              <div className="pl-12">
                <RecurrenceSelector value={recurrenceRule} onChange={setRecurrenceRule} />
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* Sección 3 */}
      <Section id="subevents" title="③ Sub-eventos" open={openSections.has('subevents')} onToggle={() => toggleSection('subevents')}>
        <div className="space-y-3">
          {subEvents.map(se => (
            <div key={se.id} className="flex items-center justify-between rounded-xl px-3 py-2.5 bg-surface-low">
              <div>
                <p className="text-sm font-medium text-navy font-body">{se.name}</p>
                <p className="text-[11px] text-navy-light/60">Cap. {se.max_capacity}</p>
              </div>
              <button type="button" onClick={() => removeSubEvent(se.id)} className="relative after:absolute after:content-[''] after:-inset-1.5 h-7 w-7 rounded-lg flex items-center justify-center text-navy-light/60 hover:text-coral hover:bg-coral/10 transition-colors" aria-label={`Eliminar sub-evento ${se.name}`}>
                <X size={14} />
              </button>
            </div>
          ))}
          {showSubEventForm ? (
            <div className="rounded-xl border border-[var(--outline-variant)] p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input className={cn(inputCls, 'font-body')} placeholder="Nombre" value={newSubName} onChange={e => setNewSubName(e.target.value)} autoFocus />
                <input type="number" className={cn(inputCls, 'font-body')} placeholder="Capacidad" value={newSubCap} onChange={e => setNewSubCap(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={addSubEvent} className="rounded-full bg-navy px-3.5 py-1.5 text-[12px] text-white hover:bg-navy/80 transition-colors font-body">Agregar</button>
                <button type="button" onClick={() => setShowSubEventForm(false)} className="rounded-full border border-[var(--outline-variant)] px-3.5 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors font-body">Cancelar</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowSubEventForm(true)} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--outline-variant)] px-3.5 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors font-body">
              <Plus size={13} /> Añadir sub-evento
            </button>
          )}
        </div>
      </Section>

      {/* Sección 4 */}
      <Section id="registration" title="④ Inscripciones" open={openSections.has('registration')} onToggle={() => toggleSection('registration')}>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <button type="button" role="switch" aria-checked={requiresRegistration} aria-label="Requiere inscripción" onClick={() => setRequiresRegistration(r => !r)} className={cn('relative h-5 w-9 rounded-full transition-all duration-200 cursor-pointer', requiresRegistration ? 'bg-coral' : 'bg-navy-light/20')}><span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200', requiresRegistration ? 'translate-x-4' : 'translate-x-0.5')} /></button>
            <span className="text-sm text-navy font-body">Requiere inscripción</span>
          </label>
          {requiresRegistration && (
            <div className="space-y-2 pl-1">
              <div className="space-y-1">
                <label className="text-[11px] tracking-widests uppercase text-navy-light/60 font-display">Capacidad máxima</label>
                <input type="number" className={cn(inputCls, 'font-body')} value={maxCapacity} onChange={e => setMaxCapacity(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] tracking-widests uppercase text-navy-light/60 font-display">Prerrequisito</label>
                <select className={cn(inputCls, 'font-body')}>
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

      {/* Sección 5 */}
      <Section id="finance" title="⑤ Financiero" open={openSections.has('finance')} onToggle={() => toggleSection('finance')}>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <button type="button" role="switch" aria-checked={requiresPayment} aria-label="Requiere pago" onClick={() => setRequiresPayment(r => !r)} className={cn('relative h-5 w-9 rounded-full transition-all duration-200 cursor-pointer', requiresPayment ? 'bg-coral' : 'bg-navy-light/20')}><span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200', requiresPayment ? 'translate-x-4' : 'translate-x-0.5')} /></button>
            <span className="text-sm text-navy font-body">Evento con cobro</span>
          </label>
          {requiresPayment && (
            <div className="space-y-3 pl-1">
              <div className="space-y-1">
                <label className="text-[11px] tracking-widests uppercase text-navy-light/60 font-display">Monto</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-navy-light/60 font-mono">₡</span>
                  <input type="number" className={cn(inputCls, 'pl-7', 'font-body')} value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] tracking-widests uppercase text-navy-light/60 font-display">Métodos de pago</label>
                <div className="flex gap-4">
                  {['Tarjeta', 'SINPE Móvil'].map(m => (
                    <label key={m} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="accent-coral" checked={paymentMethods.includes(m)} onChange={() => togglePaymentMethod(m)} />
                      <span className="text-sm text-navy font-body">{m}</span>
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
