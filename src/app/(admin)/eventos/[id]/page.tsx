'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { getEvent } from '@/data/mock-events'
import { EventTypeBadge } from '@/components/events/EventTypeBadge'
import { EventStatusBadge } from '@/components/events/EventStatusBadge'
import { CapacityBar } from '@/components/events/CapacityBar'
import { CancellationModal } from '@/components/events/CancellationModal'
import { cn } from '@/lib/utils'
import {
  ChevronLeft, Calendar, MapPin, Users, Edit2, MoreHorizontal,
  Send, Download, QrCode, UserPlus,
} from 'lucide-react'

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
  const [cancelled, setCancelled] = useState(false)

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
            <Link
              href={`/eventos/${id}/checkin`}
              className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <QrCode size={14} />
              Ir a Check-in en vivo →
            </Link>
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
          <div className="flex justify-end">
            <button className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12px] text-navy-light hover:bg-surface-low transition-colors" style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}>
              <UserPlus size={13} /> Asignar servidor
            </button>
          </div>

          {Object.keys(groupedVolunteers).length === 0 ? (
            <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
              <p className="text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>No hay servidores asignados aún.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(groupedVolunteers).map(([role, volunteers]) => (
                <div key={role} className="rounded-2xl p-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
                  <p className="text-[10px] tracking-widests uppercase text-navy-light/40 mb-3" style={{ fontFamily: 'var(--font-display)' }}>{role}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {volunteers.map(v => (
                      <div key={v.member_id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: 'var(--surface-low)' }}>
                        <div className={cn('h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0', avatarColor(v.member_name))}>
                          {getInitials(v.member_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-navy truncate" style={{ fontFamily: 'var(--font-body)' }}>{v.member_name}</p>
                          <p className="text-[11px] text-navy-light/50 truncate" style={{ fontFamily: 'var(--font-body)' }}>{v.role}</p>
                        </div>
                        <span className={cn(
                          'rounded-md px-2 py-0.5 text-[10px] font-medium shrink-0',
                          v.status === 'confirmed' ? 'bg-teal-soft/30 text-teal-deep' :
                          v.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          'bg-navy/10 text-navy/50'
                        )}>
                          {v.status === 'confirmed' ? 'Confirmado' : v.status === 'pending' ? 'Pendiente' : 'Cancelado'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
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
