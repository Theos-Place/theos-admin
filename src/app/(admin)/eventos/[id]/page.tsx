'use client'

import { use, useState, useMemo } from 'react'
import { getEvent } from '@/data/mock-events'
import { mockMembers } from '@/data/mock-members'
import { CancellationModal } from '@/components/events/CancellationModal'
import { cn } from '@/lib/utils'
import { Send, Download } from 'lucide-react'
import { TOAST_MS } from '@/lib/constants'
import { useRef } from 'react'
import { EventHeader } from './_components/EventHeader'
import { EventInfoTab } from './_components/EventInfoTab'
import { EventRegistrationsTab } from './_components/EventRegistrationsTab'
import { EventCheckinTab } from './_components/EventCheckinTab'
import { EventServersTab } from './_components/EventServersTab'
import type { VolunteerBooking } from './_components/EventServersTab'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

const FAKE_MESSAGES = [
  { date: '2026-05-10', channel: 'WhatsApp', content: 'Recordatorio: el evento se acerca. ¡Confirmá tu asistencia antes del viernes!' },
  { date: '2026-05-05', channel: 'Correo', content: 'Detalles del evento adjuntos. Revisá el horario y la dirección con anticipación.' },
  { date: '2026-04-28', channel: 'WhatsApp', content: 'Las inscripciones están abiertas. Compartí con quien querés que venga.' },
]

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
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

  const registrationCount = event.registrations.length
  const checkinCount = event.checkins.length
  const attendanceRate = registrationCount > 0 ? Math.round((checkinCount / registrationCount) * 100) : 0

  const activeTabIndex = TABS.indexOf(activeTab)
  const tabWidthPct = 100 / TABS.length

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
    setTimeout(() => setServerToast(null), TOAST_MS)
    resetModal()
  }

  function removeBooking(bookingId: string) {
    setLocalBookings(prev => prev.filter(b => b.id !== bookingId))
    setOpenServerMenu(null)
  }

  function handleFlyerSelect(file: File) {
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

      {/* Header */}
      <EventHeader
        event={event}
        id={id}
        cancelled={cancelled}
        registrationCount={registrationCount}
        showMenu={showMenu}
        onMenuToggle={() => setShowMenu(m => !m)}
        onCancelClick={() => { setShowMenu(false); setShowCancelModal(true) }}
        showCalendarPopover={showCalendarPopover}
        onCalendarPopoverToggle={() => setShowCalendarPopover(p => !p)}
        onCalendarPopoverClose={() => setShowCalendarPopover(false)}
        icsWithRRule={icsWithRRule}
        onIcsWithRRuleChange={setIcsWithRRule}
      />

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
        <EventInfoTab
          event={event}
          flyerPreview={flyerPreview}
          flyerDragOver={flyerDragOver}
          flyerInputRef={flyerInputRef}
          onFlyerSelect={handleFlyerSelect}
          onFlyerDragOver={setFlyerDragOver}
          onFlyerClear={() => setFlyerPreview(null)}
        />
      )}

      {/* Tab: Inscripciones */}
      {activeTab === 'inscripciones' && (
        <EventRegistrationsTab
          event={event}
          registrationCount={registrationCount}
          circumference={circumference}
          onSendMessage={() => setShowMessageModal(true)}
        />
      )}

      {/* Tab: Check-in */}
      {activeTab === 'checkin' && (
        <EventCheckinTab
          event={event}
          checkinCount={checkinCount}
        />
      )}

      {/* Tab: Servidores */}
      {activeTab === 'servidores' && (
        <EventServersTab
          allBookings={allBookings}
          groupedBookings={groupedBookings}
          confirmedCount={confirmedCount}
          pendingCount={pendingCount}
          declinedCount={declinedCount}
          isRecurring={event.is_recurring}
          recurringGlobal={recurringGlobal}
          onRecurringGlobalToggle={() => setRecurringGlobal(v => !v)}
          openServerMenu={openServerMenu}
          onServerMenuToggle={(bid) => setOpenServerMenu(openServerMenu === bid ? null : bid)}
          onRemoveBooking={removeBooking}
          showAssignModal={showAssignModal}
          onShowAssignModal={() => setShowAssignModal(true)}
          modalStep={modalStep}
          setModalStep={setModalStep}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          filterCommittee={filterCommittee}
          onFilterCommitteeChange={setFilterCommittee}
          filteredMembers={filteredMembers}
          selectedMemberId={selectedMemberId}
          onSelectMemberId={setSelectedMemberId}
          selectedMember={selectedMember}
          assignRole={assignRole}
          onAssignRoleChange={setAssignRole}
          customRole={customRole}
          onCustomRoleChange={setCustomRole}
          assignRecurring={assignRecurring}
          onAssignRecurringToggle={() => setAssignRecurring(v => !v)}
          onResetModal={resetModal}
          onConfirmAssignment={confirmAssignment}
          serverToast={serverToast}
        />
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
