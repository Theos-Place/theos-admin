'use client'

import { use, useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import { getEvent } from '@/data/mock-events'
import { mockMembers } from '@/data/mock-members'
import { EventTypeBadge } from '@/components/events/EventTypeBadge'
import { EventStatusBadge } from '@/components/events/EventStatusBadge'
import { CapacityBar } from '@/components/events/CapacityBar'
import { CancellationModal } from '@/components/events/CancellationModal'
import { cn } from '@/lib/utils'
import {
  ChevronLeft, Calendar, MapPin, Users, Edit2, MoreHorizontal,
  Send, Download, QrCode, UserPlus, CalendarPlus, ExternalLink, X as XIcon,
  Check, Clock, MoreVertical, Search, Link2, Image as ImageIcon,
} from 'lucide-react'

function getGoogleCalendarUrl(event: NonNullable<ReturnType<typeof getEvent>>) {
  const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
  const title = encodeURIComponent(event.name)
  const start = event.start_at.replace(/[-:]/g, '').replace(/\.\d{3}/, '').replace('+', '%2B')
  const end   = event.end_at.replace(/[-:]/g, '').replace(/\.\d{3}/, '').replace('+', '%2B')
  const details  = encodeURIComponent(event.description || '')
  const location = encodeURIComponent(event.location || '')
  return `${base}&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`
}

function downloadICS(event: NonNullable<ReturnType<typeof getEvent>>, withRRule: boolean) {
  const fmt = (d: string) => new Date(d).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Theos Place//Sistema Admin//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@theosplace.org`,
    `DTSTAMP:${fmt(new Date().toISOString())}`,
    `DTSTART:${fmt(event.start_at)}`,
    `DTEND:${fmt(event.end_at)}`,
    `SUMMARY:${event.name}`,
    `DESCRIPTION:${event.description || ''}`,
    `LOCATION:${event.location || ''}`,
    ...(event.location_map_url ? [`URL:${event.location_map_url}`] : []),
    ...(withRRule && event.recurrence_rule ? [`RRULE:${event.recurrence_rule}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${event.name.replace(/\s+/g, '-')}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

const FAKE_MESSAGES = [
  { date: '2026-05-10', channel: 'WhatsApp', content: 'Recordatorio: el evento se acerca. ¡Confirmá tu asistencia antes del viernes!' },
  { date: '2026-05-05', channel: 'Correo', content: 'Detalles del evento adjuntos. Revisá el horario y la dirección con anticipación.' },
  { date: '2026-04-28', channel: 'WhatsApp', content: 'Las inscripciones están abiertas. Compartí con quien querés que venga.' },
]

const PAYMENT_BADGE: Record<string, string> = {
  paid:     'bg-teal-soft/30 text-teal-deep',
  pending:  'bg-amber-100 text-amber-700',
  exempted: 'bg-navy/10 text-navy/60',
}
const PAYMENT_LABEL: Record<string, string> = {
  paid: 'Pagado', pending: 'Pendiente', exempted: 'Exento',
}

const AVATAR_COLORS: Record<string, string> = {
  A: 'bg-coral', B: 'bg-teal-deep', C: 'bg-navy', D: 'bg-purple-700', E: 'bg-amber-500',
  F: 'bg-coral', G: 'bg-teal-deep', H: 'bg-navy', I: 'bg-purple-700', J: 'bg-amber-500',
  K: 'bg-coral', L: 'bg-teal-deep', M: 'bg-navy', N: 'bg-purple-700', O: 'bg-amber-500',
  P: 'bg-coral', Q: 'bg-teal-deep', R: 'bg-navy', S: 'bg-purple-700', T: 'bg-amber-500',
  U: 'bg-coral', V: 'bg-teal-deep', W: 'bg-navy', X: 'bg-purple-700', Y: 'bg-amber-500', Z: 'bg-coral',
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}
function avatarColor(name: string) {
  return AVATAR_COLORS[name.charAt(0).toUpperCase()] ?? 'bg-navy'
}

function SendMessageModal({ onClose }: { onClose: () => void }) {
  const [msg, setMsg] = useState('')
  const [sent, setSent] = useState(false)
  if (sent) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-navy-ink/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative rounded-2xl p-6 max-w-sm w-full mx-4 text-center space-y-3" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-lg)' }}>
          <Send size={32} className="text-teal-deep mx-auto" />
          <p className="font-semibold text-navy" style={{ fontFamily: 'var(--font-display)' }}>Mensaje enviado</p>
          <button onClick={onClose} className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors" style={{ fontFamily: 'var(--font-body)' }}>Cerrar</button>
        </div>
      </div>
    )
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-navy-ink/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-lg)' }}>
        <h3 className="font-semibold text-navy" style={{ fontFamily: 'var(--font-display)' }}>Enviar mensaje</h3>
        <textarea
          className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 resize-none"
          style={{ fontFamily: 'var(--font-body)' }}
          rows={4}
          placeholder="Escribe el mensaje para los inscritos..."
          value={msg}
          onChange={e => setMsg(e.target.value)}
        />
        <div className="flex gap-2">
          <button onClick={() => setSent(true)} disabled={!msg.trim()} className="flex-1 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40" style={{ fontFamily: 'var(--font-body)' }}>Enviar</button>
          <button onClick={onClose} className="rounded-full border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors" style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

const SERVER_ROLES = [
  'Anfitrión', 'Sonidista', 'Proyección', 'Coordinador de Kids',
  'Coordinador de Teens', 'Logística', 'Seguridad', 'Otro',
]

type VolunteerBooking = {
  id: string
  member_id: string
  member_name: string
  member_initials: string
  role: string
  status: 'confirmed' | 'pending' | 'declined'
  is_recurring: boolean
}

const TABS = ['informacion', 'inscripciones', 'checkin', 'servidores', 'comunicaciones', 'reportes'] as const
type Tab = typeof TABS[number]
const TAB_LABELS: Record<Tab, string> = {
  informacion: 'Información',
  inscripciones: 'Inscripciones',
  checkin: 'Check-in',
  servidores: 'Servidores',
  comunicaciones: 'Comunicaciones',
  reportes: 'Reportes',
}

export default function EventoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const event = getEvent(id)
  const [activeTab, setActiveTab] = useState<Tab>('informacion')
  const [showMenu, setShowMenu] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [showCalendarPopover, setShowCalendarPopover] = useState(false)
  const [icsWithRRule, setIcsWithRRule] = useState(false)
  const [cancelled, setCancelled] = useState(false)

  // Servidores tab state
  const [localBookings, setLocalBookings] = useState<VolunteerBooking[]>([])
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [modalStep, setModalStep] = useState<1 | 2>(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCommittee, setFilterCommittee] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [assignRole, setAssignRole] = useState('')
  const [customRole, setCustomRole] = useState('')
  const [assignRecurring, setAssignRecurring] = useState(false)
  const [recurringGlobal, setRecurringGlobal] = useState(false)
  const [serverToast, setServerToast] = useState<string | null>(null)
  const [openServerMenu, setOpenServerMenu] = useState<string | null>(null)
  const [flyerPreview, setFlyerPreview] = useState<string | null>(event?.flyer_url ?? null)
  const [flyerDragOver, setFlyerDragOver] = useState(false)
  const flyerInputRef = useRef<HTMLInputElement>(null)

  if (!event) {
    return (
      <div className="space-y-4">
        <Link href="/eventos" className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy">
          <ChevronLeft size={16} /> Eventos
        </Link>
        <p className="text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>Evento no encontrado.</p>
      </div>
    )
  }

  const startDate = new Date(event.start_at)
  const endDate = new Date(event.end_at)
  const registrationCount = event.registrations.length
  const checkinCount = event.checkins.length
  const attendanceRate = registrationCount > 0 ? Math.round((checkinCount / registrationCount) * 100) : 0

  const activeTabIndex = TABS.indexOf(activeTab)
  const tabWidthPct = 100 / TABS.length

  const groupedVolunteers = event.volunteer_bookings.reduce<Record<string, typeof event.volunteer_bookings>>((acc, vb) => {
    if (!acc[vb.role]) acc[vb.role] = []
    acc[vb.role].push(vb)
    return acc
  }, {})

  const incomeEstimate = event.requires_payment && event.payment_amount
    ? checkinCount * event.payment_amount
    : 0

  // Servidores derived
  const allBookings: VolunteerBooking[] = useMemo(() => [
    ...event.volunteer_bookings.map(vb => ({
      id: vb.member_id,
      member_id: vb.member_id,
      member_name: vb.member_name,
      member_initials: getInitials(vb.member_name),
      role: vb.role,
      status: vb.status as 'confirmed' | 'pending' | 'declined',
      is_recurring: false,
    })),
    ...localBookings,
  ], [event.volunteer_bookings, localBookings])

  const groupedBookings = allBookings.reduce<Record<string, VolunteerBooking[]>>((acc, b) => {
    if (!acc[b.role]) acc[b.role] = []
    acc[b.role].push(b)
    return acc
  }, {})

  const confirmedCount = allBookings.filter(b => b.status === 'confirmed').length
  const pendingCount   = allBookings.filter(b => b.status === 'pending').length
  const declinedCount  = allBookings.filter(b => b.status === 'declined').length

  const selectedMember = selectedMemberId ? mockMembers.find(m => m.id === selectedMemberId) : null

  const filteredMembers = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return mockMembers.filter(m => {
      const nameMatch = `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
        (m.cedula ?? '').includes(q)
      const committeeMatch = !filterCommittee ||
        m.service_history.some(s => s.committee === event.committee_id && s.status === 'activo')
      return nameMatch && committeeMatch
    }).slice(0, 8)
  }, [searchQuery, filterCommittee, event.committee_id])

  function resetModal() {
    setModalStep(1)
    setSearchQuery('')
    setFilterCommittee(false)
    setSelectedMemberId(null)
    setAssignRole('')
    setCustomRole('')
    setAssignRecurring(false)
    setShowAssignModal(false)
  }

  function confirmAssignment() {
    if (!selectedMember) return
    const role = assignRole === 'Otro' ? customRole.trim() || 'Otro' : assignRole
    if (!role) return
    const newBooking: VolunteerBooking = {
      id: `booking-${Date.now()}`,
      member_id: selectedMember.id,
      member_name: `${selectedMember.first_name} ${selectedMember.last_name}`,
      member_initials: getInitials(`${selectedMember.first_name} ${selectedMember.last_name}`),
      role,
      status: 'pending',
      is_recurring: assignRecurring,
    }
    setLocalBookings(prev => [...prev, newBooking])
    const name = `${selectedMember.first_name} ${selectedMember.last_name}`
    setServerToast(`Recordatorio enviado a ${name} por WhatsApp y correo`)
    setTimeout(() => setServerToast(null), 3500)
    resetModal()
  }

  function removeBooking(bookingId: string) {
    setLocalBookings(prev => prev.filter(b => b.id !== bookingId))
    setOpenServerMenu(null)
  }

  function handleFlyerSelect(file: File) {
    if (file.size > 5 * 1024 * 1024) return
    const reader = new FileReader()
    reader.onload = (e) => setFlyerPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const arcPct = attendanceRate / 100
  const circumference = 2 * Math.PI * 40
  const dashOffset = circumference * (1 - arcPct * 0.75)
  const dashArray = circumference * 0.75

  return (
    <div className="space-y-5">
      {showCancelModal && (
        <CancellationModal
          eventName={event.name}
          registrationCount={registrationCount}
          onConfirm={() => { setCancelled(true); setShowCancelModal(false) }}
          onClose={() => setShowCancelModal(false)}
        />
      )}
      {showMessageModal && <SendMessageModal onClose={() => setShowMessageModal(false)} />}

      {/* Back */}
      <Link href="/eventos" className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors" style={{ fontFamily: 'var(--font-body)' }}>
        <ChevronLeft size={16} /> Eventos
      </Link>

      {/* Header card */}
      <div className="rounded-2xl bg-navy px-6 py-5" style={{ boxShadow: 'var(--shadow-md)' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-3 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <EventTypeBadge type={cancelled ? 'charla' : event.event_type} size="sm" />
              <EventStatusBadge status={cancelled ? 'cancelled' : event.status} size="sm" />
            </div>
            <h1
              className="text-2xl text-white font-bold leading-tight"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}
            >
              {event.name}
            </h1>
            <div className="flex flex-wrap gap-4 text-sm text-white/60" style={{ fontFamily: 'var(--font-body)' }}>
              <span className="flex items-center gap-1.5">
                <Calendar size={13} className="text-white/40" />
                {startDate.toLocaleDateString('es-CR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                {' · '}
                {startDate.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
                {' — '}
                {endDate.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin size={13} className="text-white/40" />
                {event.location}
              </span>
              <span className="flex items-center gap-1.5">
                <Users size={13} className="text-white/40" />
                {registrationCount} inscritos
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Calendar export popover */}
            <div className="relative">
              <button
                onClick={() => setShowCalendarPopover(p => !p)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3.5 py-2 text-sm text-white/80 hover:bg-white/10 transition-all duration-150"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <CalendarPlus size={13} />
                Agregar a mi calendario
              </button>
              {showCalendarPopover && (
                <div
                  className="absolute right-0 top-full mt-2 rounded-2xl p-4 w-72 z-30 space-y-3"
                  style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--outline-variant)' }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                      Exportar evento
                    </p>
                    <button onClick={() => setShowCalendarPopover(false)} className="text-navy-light/40 hover:text-navy transition-colors">
                      <XIcon size={14} />
                    </button>
                  </div>
                  <a
                    href={getGoogleCalendarUrl(event)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowCalendarPopover(false)}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 hover:bg-surface-low transition-colors"
                  >
                    <div className="h-8 w-8 rounded-lg bg-navy/10 flex items-center justify-center shrink-0">
                      <ExternalLink size={14} className="text-navy" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-navy" style={{ fontFamily: 'var(--font-body)' }}>Google Calendar</p>
                      <p className="text-[11px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>Abre en una nueva pestaña</p>
                    </div>
                  </a>
                  <div>
                    <button
                      onClick={() => { downloadICS(event, icsWithRRule); setShowCalendarPopover(false) }}
                      className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 hover:bg-surface-low transition-colors text-left"
                    >
                      <div className="h-8 w-8 rounded-lg bg-navy/10 flex items-center justify-center shrink-0">
                        <Download size={14} className="text-navy" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-navy" style={{ fontFamily: 'var(--font-body)' }}>Apple / Outlook (.ics)</p>
                        <p className="text-[11px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>Descargar archivo de calendario</p>
                      </div>
                    </button>
                    {event.is_recurring && (
                      <label className="flex items-center gap-2 px-3 pt-1 pb-1 cursor-pointer">
                        <input
                          type="checkbox"
                          className="accent-coral"
                          checked={icsWithRRule}
                          onChange={e => setIcsWithRRule(e.target.checked)}
                        />
                        <span className="text-[11px] text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
                          Incluir toda la serie de recurrencia
                        </span>
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>
            <Link
              href={`/eventos/${id}/editar`}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3.5 py-2 text-sm text-white/80 hover:bg-white/10 transition-all duration-150"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <Edit2 size={13} />
              Editar
            </Link>
            <Link
              href={`/eventos/${id}/checkin`}
              className="inline-flex items-center gap-1.5 rounded-full bg-coral px-3.5 py-2 text-sm text-white hover:bg-coral-deep transition-all duration-150"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <QrCode size={13} />
              Check-in →
            </Link>
            <div className="relative">
              <button
                onClick={() => setShowMenu(m => !m)}
                className="h-9 w-9 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:bg-white/10 transition-all"
              >
                <MoreHorizontal size={16} />
              </button>
              {showMenu && (
                <div
                  className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden w-44 z-20"
                  style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-lg)' }}
                >
                  <button
                    onClick={() => { setShowMenu(false); setShowCancelModal(true) }}
                    className="w-full text-left px-4 py-2.5 text-sm text-coral hover:bg-coral/5 transition-colors"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    Cancelar evento
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="relative border-b" style={{ borderColor: 'var(--outline-variant)' }}>
        <div className="flex">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={cn(
                'flex-1 px-2 py-2.5 text-[12px] transition-colors',
                activeTab === t ? 'text-coral font-semibold' : 'text-navy-light/50 hover:text-navy'
              )}
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
        <div
          className="absolute bottom-0 h-0.5 bg-coral transition-transform duration-200 ease-out"
          style={{
            width: `${tabWidthPct}%`,
            transform: `translateX(${activeTabIndex * 100}%)`,
          }}
        />
      </div>

      {/* Tab: Información */}
      {activeTab === 'informacion' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <h3 className="text-[10px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Descripción</h3>
            <p className="text-sm text-navy-light/70 leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>{event.description}</p>
            <div className="grid grid-cols-2 gap-4 pt-2 border-t" style={{ borderColor: 'var(--outline-variant)' }}>
              {[
                { label: 'Tipo', value: event.event_type },
                { label: 'Comité', value: event.committee_id },
                { label: 'Inicio', value: startDate.toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
                { label: 'Fin', value: endDate.toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
                { label: 'Ubicación', value: event.location },
                { label: 'Virtual', value: event.is_virtual ? 'Sí' : 'No' },
                { label: 'Inscripción', value: event.requires_registration ? 'Requerida' : 'Libre' },
                { label: 'Capacidad', value: `${event.max_capacity} personas` },
              ].map(({ label, value }) => (
                <div key={label} className="space-y-0.5">
                  <p className="text-[10px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>{label}</p>
                  <p className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {event.sub_events.length > 0 && (
              <div className="rounded-2xl p-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
                <h3 className="text-[10px] tracking-widests uppercase text-navy-light/40 mb-3" style={{ fontFamily: 'var(--font-display)' }}>Sub-eventos</h3>
                <div className="space-y-2">
                  {event.sub_events.map(se => {
                    const seCheckins = event.checkins.filter(c => c.sub_event_id === se.id).length
                    return (
                      <div key={se.id} className="rounded-xl px-3 py-2.5" style={{ background: 'var(--surface-low)' }}>
                        <p className="text-sm font-medium text-navy" style={{ fontFamily: 'var(--font-body)' }}>{se.name}</p>
                        <CapacityBar current={seCheckins} max={se.max_capacity} />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
              <h3 className="text-[10px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Configuración</h3>
              {[
                { label: 'Recurrente', value: event.is_recurring ? event.recurrence_rule ?? 'Sí' : 'No' },
                { label: 'Encuesta', value: event.requires_survey ? 'Requerida' : 'No' },
                { label: 'Pago', value: event.requires_payment ? `₡${event.payment_amount?.toLocaleString()}` : 'Gratuito' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>{label}</span>
                  <span className="text-navy font-medium" style={{ fontFamily: 'var(--font-body)' }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Flyer */}
            <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
              <h3 className="text-[10px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Flyer / Banner</h3>
              <input
                ref={flyerInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFlyerSelect(f) }}
              />
              {!flyerPreview ? (
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
                    'flex flex-col items-center gap-2 rounded-xl border-2 border-dashed py-6 cursor-pointer transition-all',
                    flyerDragOver ? 'border-coral bg-coral/5' : 'border-[rgba(22,20,64,0.15)] hover:border-coral/40 hover:bg-surface-low'
                  )}
                >
                  <ImageIcon size={24} className="text-navy-light/30" />
                  <p className="text-[12px] font-medium text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
                    Subir flyer
                  </p>
                  <p className="text-[10px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
                    PNG, JPG, WebP — máx 5MB
                  </p>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden border" style={{ borderColor: 'var(--outline-variant)' }}>
                  <img src={flyerPreview} alt="Flyer del evento" className="w-full object-cover max-h-40" />
                  <div className="absolute bottom-0 inset-x-0 flex gap-2 justify-end p-2" style={{ background: 'rgba(22,20,64,0.6)' }}>
                    <button type="button" onClick={() => flyerInputRef.current?.click()}
                      className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-white bg-white/20 hover:bg-white/30 transition-colors"
                      style={{ fontFamily: 'var(--font-body)' }}>
                      Cambiar
                    </button>
                    <button type="button" onClick={() => setFlyerPreview(null)}
                      className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-coral bg-coral/20 hover:bg-coral/30 transition-colors"
                      style={{ fontFamily: 'var(--font-body)' }}>
                      Eliminar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Inscripciones */}
      {activeTab === 'inscripciones' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-2xl p-4 flex flex-col items-center" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
              <svg viewBox="0 0 100 100" className="w-20 h-20">
                <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8" stroke="var(--surface-low)" />
                <circle
                  cx="50" cy="50" r="40" fill="none" strokeWidth="8" stroke="#70BDC2"
                  strokeDasharray={circumference}
                  strokeDashoffset={registrationCount > 0 ? circumference * (1 - registrationCount / event.max_capacity) : circumference}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                />
                <text x="50" y="54" textAnchor="middle" fontSize="18" fontWeight="bold" fill="#161440" fontFamily="var(--font-display)">
                  {Math.round((registrationCount / event.max_capacity) * 100)}%
                </text>
              </svg>
              <p className="text-[11px] text-navy-light/50 mt-1" style={{ fontFamily: 'var(--font-body)' }}>Ocupación</p>
              <p className="text-sm font-medium text-navy" style={{ fontFamily: 'var(--font-display)' }}>
                {registrationCount}/{event.max_capacity}
              </p>
            </div>
            {[
              { label: 'Pagados', value: event.registrations.filter(r => r.payment_status === 'paid').length, color: 'text-teal-deep' },
              { label: 'Pendientes', value: event.registrations.filter(r => r.payment_status === 'pending').length, color: 'text-amber-600' },
              { label: 'Exentos', value: event.registrations.filter(r => r.payment_status === 'exempted').length, color: 'text-navy/60' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-2xl p-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
                <p className="text-[10px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>{label}</p>
                <p className={cn('mt-2 text-4xl font-extrabold tabular-nums', color)} style={{ fontFamily: 'var(--font-display)' }}>{value}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
              {registrationCount} inscritos
            </p>
            <div className="flex gap-2">
              <button className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12px] text-navy-light hover:bg-surface-low transition-colors" style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}>
                <Download size={13} /> Exportar
              </button>
              <button
                onClick={() => setShowMessageModal(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-coral px-3.5 py-2 text-[12px] text-white hover:bg-coral-deep transition-colors"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <Send size={13} /> Enviar recordatorio
              </button>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {['Nombre', 'Fecha inscripción', 'Pago', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] tracking-widests uppercase text-navy-light/50" style={{ fontFamily: 'var(--font-display)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {event.registrations.slice(0, 20).map((reg, idx) => (
                    <tr key={reg.member_id} className={cn('hover:bg-surface-low transition-colors', idx % 2 === 1 ? 'bg-surface-low/40' : '')}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={cn('h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0', avatarColor(reg.member_name))}>
                            {getInitials(reg.member_name)}
                          </div>
                          <span className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>{reg.member_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
                        {new Date(reg.registered_at).toLocaleDateString('es-CR')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-medium', PAYMENT_BADGE[reg.payment_status])}>
                          {PAYMENT_LABEL[reg.payment_status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-[11px] text-navy-light hover:text-coral transition-colors" style={{ fontFamily: 'var(--font-body)' }}>Ver perfil</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {registrationCount > 20 && (
              <div className="px-4 py-3 border-t text-center" style={{ borderColor: 'var(--outline-variant)' }}>
                <p className="text-[12px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
                  Mostrando 20 de {registrationCount} inscritos
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Check-in */}
      {activeTab === 'checkin' && (
        <div className="space-y-4">
          {event.sub_events.length > 0 && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {event.sub_events.map(se => {
                const seCheckins = event.checkins.filter(c => c.sub_event_id === se.id).length
                return (
                  <div key={se.id} className="rounded-2xl p-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
                    <p className="text-[10px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>{se.name}</p>
                    <p className="mt-1 text-3xl font-extrabold text-navy tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>{seCheckins}</p>
                    <CapacityBar current={seCheckins} max={se.max_capacity} />
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
              {checkinCount} check-ins registrados
            </p>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--outline-variant)' }}>
              <p className="text-[10px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Últimos check-ins</p>
            </div>
            {event.checkins.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>Aún no hay check-ins registrados.</p>
              </div>
            ) : (
              <div>
                {event.checkins.slice(0, 10).map((ci, idx) => (
                  <div
                    key={`${ci.member_id}-${idx}`}
                    className={cn('flex items-center gap-3 px-4 py-3', idx % 2 === 1 ? 'bg-surface-low/40' : '')}
                  >
                    <div className={cn('h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0', avatarColor(ci.member_name))}>
                      {getInitials(ci.member_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-navy truncate" style={{ fontFamily: 'var(--font-body)' }}>{ci.member_name}</p>
                      <p className="text-[11px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
                        {new Date(ci.checked_at).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
                        {ci.sub_event_id && ` · ${ci.sub_event_id}`}
                      </p>
                    </div>
                    <span className={cn(
                      'rounded-md px-2 py-0.5 text-[10px] font-medium',
                      ci.attendance_type === 'server' ? 'bg-coral/10 text-coral' : 'bg-teal-soft/30 text-teal-deep'
                    )}>
                      {ci.attendance_type === 'server' ? 'Servidor' : 'Participante'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Servidores */}
      {activeTab === 'servidores' && (
        <div className="space-y-4">
          {/* Header row */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Stats pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-soft/30 px-3 py-1.5 text-[12px] text-teal-deep" style={{ fontFamily: 'var(--font-body)' }}>
                <Check size={12} strokeWidth={2.5} /> {confirmedCount} confirmados
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-[12px] text-amber-700" style={{ fontFamily: 'var(--font-body)' }}>
                <Clock size={12} strokeWidth={2} className="animate-pulse" /> {pendingCount} pendientes
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-navy/10 px-3 py-1.5 text-[12px] text-navy/50" style={{ fontFamily: 'var(--font-body)' }}>
                <XIcon size={12} strokeWidth={2} /> {declinedCount} declinaron
              </span>
            </div>

            <div className="flex items-center gap-2">
              {event.is_recurring && (
                <label className="flex items-center gap-2 cursor-pointer" title="Los servidores asignados se repetirán automáticamente en cada fecha de la serie">
                  <div
                    onClick={() => setRecurringGlobal(v => !v)}
                    className={cn('relative h-5 w-9 rounded-full transition-colors cursor-pointer', recurringGlobal ? 'bg-coral' : 'bg-navy-light/20')}
                  >
                    <div className={cn('absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', recurringGlobal ? 'translate-x-4' : 'translate-x-0')} />
                  </div>
                  <span className="text-[12px] text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>Aplicar a toda la serie</span>
                </label>
              )}
              <button
                onClick={() => { setShowAssignModal(true); setModalStep(1) }}
                className="inline-flex items-center gap-1.5 rounded-full bg-coral px-3.5 py-2 text-[12px] text-white hover:bg-coral-deep transition-colors"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <UserPlus size={13} /> Asignar servidor
              </button>
            </div>
          </div>

          {/* Bookings grouped by role */}
          {Object.keys(groupedBookings).length === 0 ? (
            <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
              <UserPlus size={28} className="text-navy-light/20 mx-auto mb-3" strokeWidth={1.25} />
              <p className="text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>No hay servidores asignados aún.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(groupedBookings).map(([role, bookings]) => (
                <div key={role} className="rounded-2xl p-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
                  <p className="text-[10px] tracking-widest uppercase text-navy-light/40 mb-3" style={{ fontFamily: 'var(--font-display)' }}>{role}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {bookings.map(b => (
                      <div key={b.id} className="relative flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: 'var(--surface-low)' }}>
                        <div className={cn('h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0', avatarColor(b.member_name))}>
                          {b.member_initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-navy truncate" style={{ fontFamily: 'var(--font-body)' }}>{b.member_name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={cn(
                              'rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                              b.status === 'confirmed' ? 'bg-teal-soft/30 text-teal-deep' :
                              b.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                              'bg-navy/10 text-navy/50'
                            )}>
                              {b.status === 'confirmed' ? '✓ Confirmado' : b.status === 'pending' ? '⏳ Pendiente' : '✗ Declinó'}
                            </span>
                            {b.is_recurring && (
                              <span className="text-[10px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
                                <Link2 size={10} className="inline" /> Serie
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="relative shrink-0">
                          <button
                            onClick={() => setOpenServerMenu(openServerMenu === b.id ? null : b.id)}
                            className="h-7 w-7 rounded-lg flex items-center justify-center text-navy-light/30 hover:bg-surface-card hover:text-navy transition-all"
                          >
                            <MoreVertical size={14} />
                          </button>
                          {openServerMenu === b.id && (
                            <div
                              className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden w-36 z-20"
                              style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--outline-variant)' }}
                            >
                              <button
                                onClick={() => setOpenServerMenu(null)}
                                className="w-full text-left px-3 py-2 text-[12px] text-navy-light hover:bg-surface-low transition-colors"
                                style={{ fontFamily: 'var(--font-body)' }}
                              >
                                Cambiar rol
                              </button>
                              <button
                                onClick={() => removeBooking(b.id)}
                                className="w-full text-left px-3 py-2 text-[12px] text-coral hover:bg-coral/5 transition-colors"
                                style={{ fontFamily: 'var(--font-body)' }}
                              >
                                Quitar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Assignment Modal */}
          {showAssignModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-navy-ink/60 backdrop-blur-sm" onClick={resetModal} />
              <div
                className="relative rounded-2xl w-full max-w-md mx-4 overflow-hidden"
                style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-lg)' }}
              >
                {/* Modal header */}
                <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--outline-variant)' }}>
                  <div className="flex items-center gap-3">
                    <span className={cn('h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white', modalStep === 1 ? 'bg-coral' : 'bg-teal-deep')}>
                      {modalStep}
                    </span>
                    <span className="text-sm font-semibold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
                      {modalStep === 1 ? 'Buscar miembro' : 'Definir rol'}
                    </span>
                  </div>
                  <button onClick={resetModal} className="text-navy-light/40 hover:text-navy transition-colors">
                    <XIcon size={16} />
                  </button>
                </div>

                <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                  {/* Step 1 — search */}
                  {modalStep === 1 && (
                    <>
                      <div className="flex items-center gap-2 rounded-xl bg-surface-low px-3 py-2 focus-within:ring-1 focus-within:ring-coral/30">
                        <Search size={14} className="text-navy-light/40 shrink-0" />
                        <input
                          type="search"
                          autoFocus
                          placeholder="Nombre o cédula..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="flex-1 bg-transparent text-sm text-navy outline-none placeholder-navy-light/40"
                          style={{ fontFamily: 'var(--font-body)' }}
                        />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="accent-coral h-4 w-4"
                          checked={filterCommittee}
                          onChange={e => setFilterCommittee(e.target.checked)}
                        />
                        <span className="text-[12px] text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
                          Solo miembros del comité organizador
                        </span>
                      </label>
                      <div className="space-y-1.5 max-h-60 overflow-y-auto">
                        {filteredMembers.map(m => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setSelectedMemberId(m.id)}
                            className={cn(
                              'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all',
                              selectedMemberId === m.id
                                ? 'bg-coral/10 ring-1 ring-coral/30'
                                : 'hover:bg-surface-low'
                            )}
                          >
                            <div className={cn('h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0', avatarColor(m.first_name))}>
                              {(m.first_name[0] + m.last_name[0]).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-navy truncate" style={{ fontFamily: 'var(--font-body)' }}>
                                {m.first_name} {m.last_name}
                              </p>
                              <p className="text-[11px] text-navy-light/40 truncate" style={{ fontFamily: 'var(--font-mono)' }}>
                                {m.cedula ?? 'Sin cédula'}
                                {m.service_history.filter(s => s.status === 'activo').map(s => ` · ${s.committee}`).join('')}
                              </p>
                            </div>
                            {selectedMemberId === m.id && <Check size={14} className="text-coral shrink-0" />}
                          </button>
                        ))}
                        {filteredMembers.length === 0 && (
                          <p className="text-sm text-navy-light/40 text-center py-4" style={{ fontFamily: 'var(--font-body)' }}>Sin resultados</p>
                        )}
                      </div>
                    </>
                  )}

                  {/* Step 2 — role & config */}
                  {modalStep === 2 && selectedMember && (
                    <>
                      <div className="flex items-center gap-3 rounded-xl bg-teal-soft/10 px-3 py-2.5">
                        <div className={cn('h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0', avatarColor(selectedMember.first_name))}>
                          {(selectedMember.first_name[0] + selectedMember.last_name[0]).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                            {selectedMember.first_name} {selectedMember.last_name}
                          </p>
                          <p className="text-[11px] text-navy-light/50" style={{ fontFamily: 'var(--font-mono)' }}>
                            {selectedMember.cedula ?? 'Sin cédula'}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                          Rol en este evento
                        </label>
                        <select
                          className="w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30"
                          style={{ fontFamily: 'var(--font-body)' }}
                          value={assignRole}
                          onChange={e => setAssignRole(e.target.value)}
                        >
                          <option value="">Seleccionar rol...</option>
                          {SERVER_ROLES.map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                        {assignRole === 'Otro' && (
                          <input
                            type="text"
                            autoFocus
                            placeholder="Especificá el rol..."
                            value={customRole}
                            onChange={e => setCustomRole(e.target.value)}
                            className="mt-2 w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30"
                            style={{ fontFamily: 'var(--font-body)' }}
                          />
                        )}
                      </div>

                      {event.is_recurring && (
                        <label className="flex items-start gap-3 cursor-pointer rounded-xl bg-surface-low px-3 py-2.5">
                          <div
                            onClick={() => setAssignRecurring(v => !v)}
                            className={cn('relative h-5 w-9 rounded-full transition-colors cursor-pointer mt-0.5 shrink-0', assignRecurring ? 'bg-coral' : 'bg-navy-light/20')}
                          >
                            <div className={cn('absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', assignRecurring ? 'translate-x-4' : 'translate-x-0')} />
                          </div>
                          <div>
                            <p className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>Booking recurrente</p>
                            {assignRecurring && (
                              <p className="text-[11px] text-navy-light/50 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
                                Esta persona quedará asignada a todas las instancias futuras de esta serie
                              </p>
                            )}
                          </div>
                        </label>
                      )}
                    </>
                  )}
                </div>

                {/* Modal footer */}
                <div className="flex items-center justify-between gap-2 px-5 py-4 border-t" style={{ borderColor: 'var(--outline-variant)' }}>
                  <button
                    onClick={() => modalStep === 1 ? resetModal() : setModalStep(1)}
                    className="rounded-xl border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
                    style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                  >
                    {modalStep === 1 ? 'Cancelar' : '← Atrás'}
                  </button>
                  {modalStep === 1 ? (
                    <button
                      onClick={() => { if (selectedMemberId) setModalStep(2) }}
                      disabled={!selectedMemberId}
                      className="rounded-xl bg-navy px-4 py-2 text-sm text-white hover:bg-navy/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ fontFamily: 'var(--font-body)' }}
                    >
                      Continuar →
                    </button>
                  ) : (
                    <button
                      onClick={confirmAssignment}
                      disabled={!assignRole || (assignRole === 'Otro' && !customRole.trim())}
                      className="rounded-xl bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ fontFamily: 'var(--font-body)' }}
                    >
                      Asignar servidor
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Toast */}
          {serverToast && (
            <div
              className="fixed bottom-6 right-6 flex items-center gap-3 rounded-2xl bg-navy px-5 py-3.5 text-white z-50"
              style={{ boxShadow: 'var(--shadow-lg)' }}
            >
              <Send size={14} className="text-teal-soft shrink-0" />
              <span className="text-sm" style={{ fontFamily: 'var(--font-body)' }}>{serverToast}</span>
            </div>
          )}
        </div>
      )}

      {/* Tab: Comunicaciones */}
      {activeTab === 'comunicaciones' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowMessageModal(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <Send size={14} /> Enviar mensaje
            </button>
          </div>

          <div className="space-y-3">
            {FAKE_MESSAGES.map((msg, i) => (
              <div key={i} className="rounded-2xl p-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-medium', msg.channel === 'WhatsApp' ? 'bg-teal-soft/30 text-teal-deep' : 'bg-navy/10 text-navy')}>
                    {msg.channel}
                  </span>
                  <span className="text-[11px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>{msg.date}</span>
                </div>
                <p className="text-sm text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>{msg.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Reportes */}
      {activeTab === 'reportes' && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Gauge tasa de asistencia */}
            <div className="rounded-2xl p-5 flex flex-col items-center" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
              <p className="text-[10px] tracking-widests uppercase text-navy-light/40 mb-4 self-start" style={{ fontFamily: 'var(--font-display)' }}>
                Tasa de asistencia
              </p>
              <svg viewBox="0 0 100 60" className="w-40 h-24">
                <path
                  d="M 10 55 A 40 40 0 0 1 90 55"
                  fill="none" stroke="var(--surface-low)" strokeWidth="8" strokeLinecap="round"
                />
                {checkinCount > 0 && (
                  <path
                    d="M 10 55 A 40 40 0 0 1 90 55"
                    fill="none" stroke="#EF5554" strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${arcPct * 125.6} 125.6`}
                  />
                )}
                <text x="50" y="52" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#161440" fontFamily="var(--font-display)">
                  {attendanceRate}%
                </text>
              </svg>
              <p className="text-[12px] text-navy-light/50 mt-2" style={{ fontFamily: 'var(--font-body)' }}>
                {checkinCount} de {registrationCount} inscritos asistieron
              </p>
            </div>

            {/* Ingresos */}
            {event.requires_payment && event.payment_amount && (
              <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
                <p className="text-[10px] tracking-widests uppercase text-navy-light/40 mb-3" style={{ fontFamily: 'var(--font-display)' }}>
                  Ingresos estimados
                </p>
                <p className="text-4xl font-extrabold text-navy tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>
                  ₡{incomeEstimate.toLocaleString()}
                </p>
                <p className="text-[12px] text-navy-light/50 mt-2" style={{ fontFamily: 'var(--font-body)' }}>
                  {checkinCount} asistentes × ₡{event.payment_amount.toLocaleString()}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Pagados</p>
                    <p className="font-semibold text-navy" style={{ fontFamily: 'var(--font-body)' }}>{event.registrations.filter(r => r.payment_status === 'paid').length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>Pendientes</p>
                    <p className="font-semibold text-amber-600" style={{ fontFamily: 'var(--font-body)' }}>{event.registrations.filter(r => r.payment_status === 'pending').length}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors" style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}>
              <Download size={14} /> Exportar asistencia
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors" style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}>
              <Download size={14} /> Exportar inscritos
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
