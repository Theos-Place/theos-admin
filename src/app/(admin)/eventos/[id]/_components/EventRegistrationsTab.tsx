'use client'

import { useEffect, useState } from 'react'
import { Download, Send, UserPlus, Search, Trash2 } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { cn } from '@/lib/utils'
import type { MockEvent } from '@/data/event-config'
import { getInitials } from '@/lib/format'

type Event = MockEvent
type PaymentStatus = 'pending' | 'paid' | 'exempted'

const PAYMENT_LABEL: Record<string, string> = {
  paid: 'Pagado', pending: 'Pendiente', exempted: 'Exento',
}
const PAYMENT_OPTIONS: PaymentStatus[] = ['pending', 'paid', 'exempted']

const AVATAR_COLORS: Record<string, string> = {
  A: 'bg-coral', B: 'bg-teal-deep', C: 'bg-navy', D: 'bg-purple-700', E: 'bg-amber-500',
  F: 'bg-coral', G: 'bg-teal-deep', H: 'bg-navy', I: 'bg-purple-700', J: 'bg-amber-500',
  K: 'bg-coral', L: 'bg-teal-deep', M: 'bg-navy', N: 'bg-purple-700', O: 'bg-amber-500',
  P: 'bg-coral', Q: 'bg-teal-deep', R: 'bg-navy', S: 'bg-purple-700', T: 'bg-amber-500',
  U: 'bg-coral', V: 'bg-teal-deep', W: 'bg-navy', X: 'bg-purple-700', Y: 'bg-amber-500', Z: 'bg-coral',
}

function avatarColor(name: string) {
  return AVATAR_COLORS[name.charAt(0).toUpperCase()] ?? 'bg-navy'
}

type MemberResult = { id: string; first_name: string; last_name: string; cedula?: string | null }

type Props = {
  event: Event
  eventId: string
  registrationCount: number
  circumference: number
  onSendMessage: () => void
  onChanged: () => void
}

export function EventRegistrationsTab({ event, eventId, registrationCount, circumference, onSendMessage, onChanged }: Props) {
  const [showInscribir, setShowInscribir] = useState(false)
  const [busyMember, setBusyMember] = useState<string | null>(null)

  async function changePayment(memberId: string, status: PaymentStatus) {
    setBusyMember(memberId)
    try {
      const res = await fetch(`/api/events/${eventId}/registrations/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_status: status }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onChanged()
    } catch (err) {
      console.error('No se pudo cambiar el estado de pago:', err)
    } finally {
      setBusyMember(null)
    }
  }

  async function removeRegistration(memberId: string) {
    setBusyMember(memberId)
    try {
      const res = await fetch(`/api/events/${eventId}/registrations/${memberId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onChanged()
    } catch (err) {
      console.error('No se pudo quitar la inscripción:', err)
    } finally {
      setBusyMember(null)
    }
  }

  const cap = event.max_capacity ?? 0 // 0 = sin límite (no se calcula ocupación)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl p-4 flex flex-col items-center bg-surface-card shadow-[var(--shadow-md)]">
          <svg viewBox="0 0 100 100" className="w-20 h-20">
            <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8" stroke="var(--surface-low)" />
            <circle
              cx="50" cy="50" r="40" fill="none" strokeWidth="8" stroke="#70BDC2"
              strokeDasharray={circumference}
              strokeDashoffset={registrationCount > 0 && cap > 0 ? circumference * (1 - registrationCount / cap) : circumference}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
            />
            <text x="50" y="54" textAnchor="middle" fontSize="18" fontWeight="bold" fill="#161440" fontFamily="var(--font-display)">
              {cap > 0 ? Math.round((registrationCount / cap) * 100) : 0}%
            </text>
          </svg>
          <p className="text-[11px] text-navy-light/60 mt-1 font-body">Ocupación</p>
          <p className="text-sm font-medium text-navy font-display">
            {registrationCount}/{cap || '∞'}
          </p>
        </div>
        {[
          { label: 'Pagados', value: event.registrations.filter(r => r.payment_status === 'paid').length, color: 'text-teal-deep' },
          { label: 'Pendientes', value: event.registrations.filter(r => r.payment_status === 'pending').length, color: 'text-amber-600' },
          { label: 'Exentos', value: event.registrations.filter(r => r.payment_status === 'exempted').length, color: 'text-navy/60' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl p-4 bg-surface-card shadow-[var(--shadow-md)]">
            <p className="text-[10px] tracking-widests uppercase text-navy-light/60 font-display">{label}</p>
            <p className={cn('mt-2 text-4xl font-extrabold tabular-nums font-display', color)}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-navy-light/60 font-body">
          {registrationCount} inscritos
        </p>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowInscribir(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--outline-variant)] px-3.5 py-2 text-[12px] text-navy-light hover:bg-surface-low transition-colors font-body"
          >
            <UserPlus size={13} /> Inscribir
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-full border border-[var(--outline-variant)] px-3.5 py-2 text-[12px] text-navy-light hover:bg-surface-low transition-colors font-body">
            <Download size={13} /> Exportar
          </button>
          <button
            onClick={onSendMessage}
            className="inline-flex items-center gap-1.5 rounded-full bg-coral px-3.5 py-2 text-[12px] text-white hover:bg-coral-deep transition-colors font-body"
          >
            <Send size={13} /> Enviar recordatorio
          </button>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['Nombre', 'Fecha inscripción', 'Pago', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] tracking-widests uppercase text-navy-light/60 font-display">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {event.registrations.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[13px] text-navy-light/60 font-body">
                    Nadie inscrito todavía. Usá «Inscribir» para agregar miembros.
                  </td>
                </tr>
              )}
              {event.registrations.map((reg, idx) => (
                <tr key={reg.member_id} className={cn('hover:bg-surface-low transition-colors', idx % 2 === 1 ? 'bg-surface-low/40' : '', busyMember === reg.member_id && 'opacity-50')}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={cn('h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0', avatarColor(reg.member_name))}>
                        {getInitials(reg.member_name)}
                      </div>
                      <span className="text-sm text-navy font-body">{reg.member_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-navy-light/60 font-body">
                    {new Date(reg.registered_at).toLocaleDateString('es-CR')}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={reg.payment_status}
                      disabled={busyMember === reg.member_id}
                      onChange={e => changePayment(reg.member_id, e.target.value as PaymentStatus)}
                      className="rounded-md border border-[var(--outline-variant)] px-2 py-1 text-[12px] text-navy bg-white focus:outline-none focus:ring-2 focus:ring-coral/30 font-body"
                    >
                      {PAYMENT_OPTIONS.map(o => <option key={o} value={o}>{PAYMENT_LABEL[o]}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => removeRegistration(reg.member_id)}
                      disabled={busyMember === reg.member_id}
                      className="inline-flex items-center gap-1 text-[11px] text-navy-light/60 hover:text-coral transition-colors font-body"
                    >
                      <Trash2 size={13} /> Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: tarjetas */}
        <div className="md:hidden">
          {event.registrations.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-navy-light/60 font-body">
              Nadie inscrito todavía. Usá «Inscribir» para agregar miembros.
            </div>
          ) : (
            <ul>
              {event.registrations.map((reg, idx) => (
                <li
                  key={reg.member_id}
                  className={cn('flex items-center gap-3 px-4 py-3', idx % 2 === 1 ? 'bg-surface-low/40' : '', busyMember === reg.member_id && 'opacity-50')}
                >
                  <div className={cn('h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0', avatarColor(reg.member_name))}>
                    {getInitials(reg.member_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-navy font-body">{reg.member_name}</p>
                    <p className="text-[11px] text-navy-light/60 font-body">
                      {new Date(reg.registered_at).toLocaleDateString('es-CR')}
                    </p>
                  </div>
                  <select
                    value={reg.payment_status}
                    disabled={busyMember === reg.member_id}
                    onChange={e => changePayment(reg.member_id, e.target.value as PaymentStatus)}
                    className="rounded-md border border-[var(--outline-variant)] px-2 py-1 text-[12px] text-navy bg-white focus:outline-none focus:ring-2 focus:ring-coral/30 font-body shrink-0"
                  >
                    {PAYMENT_OPTIONS.map(o => <option key={o} value={o}>{PAYMENT_LABEL[o]}</option>)}
                  </select>
                  <button
                    onClick={() => removeRegistration(reg.member_id)}
                    disabled={busyMember === reg.member_id}
                    className="text-navy-light/60 hover:text-coral transition-colors shrink-0"
                    aria-label="Quitar inscripción"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {showInscribir && (
        <InscribirModal
          eventId={eventId}
          alreadyRegistered={new Set(event.registrations.map(r => r.member_id))}
          onClose={() => setShowInscribir(false)}
          onInscrito={() => { onChanged() }}
        />
      )}
    </div>
  )
}

// ─── Modal para inscribir miembros ──────────────────────────────────────────────

function InscribirModal({ eventId, alreadyRegistered, onClose, onInscrito }: {
  eventId: string
  alreadyRegistered: Set<string>
  onClose: () => void
  onInscrito: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MemberResult[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults([]); return }
    let alive = true
    setLoading(true)
    const t = setTimeout(() => {
      fetch(`/api/members?search=${encodeURIComponent(q)}&pageSize=10`)
        .then(r => (r.ok ? r.json() : { members: [] }))
        .then(d => { if (alive) setResults(d.members ?? []) })
        .catch(() => { if (alive) setResults([]) })
        .finally(() => { if (alive) setLoading(false) })
    }, 300)
    return () => { alive = false; clearTimeout(t) }
  }, [query])

  async function inscribir(memberId: string) {
    setAdding(memberId)
    try {
      const res = await fetch(`/api/events/${eventId}/registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onInscrito()
      setResults(prev => prev.filter(m => m.id !== memberId))
    } catch (err) {
      console.error('No se pudo inscribir al miembro:', err)
    } finally {
      setAdding(null)
    }
  }

  return (
    <Modal onClose={onClose} titleId="inscribir-miembro-titulo" width={448}>
      <div className="p-6 space-y-4">
        <h3 id="inscribir-miembro-titulo" className="text-lg font-extrabold text-navy font-display">Inscribir miembro</h3>

        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-light/60" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nombre o cédula…"
            aria-label="Buscar por nombre o cédula"
            className="w-full rounded-2xl border border-[var(--outline-variant)] pl-9 pr-4 py-3 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-coral/30 font-body"
          />
        </div>

        <div className="max-h-72 overflow-y-auto space-y-1">
          {loading && <p className="text-[12px] text-navy-light/60 py-2 text-center font-body">Buscando…</p>}
          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <p className="text-[12px] text-navy-light/60 py-2 text-center font-body">Sin resultados.</p>
          )}
          {results.map(m => {
            const name = `${m.first_name} ${m.last_name}`
            const already = alreadyRegistered.has(m.id)
            return (
              <div key={m.id} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface-low transition-colors">
                <div className={cn('h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0', avatarColor(name))}>
                  {getInitials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-navy truncate font-body">{name}</p>
                  {m.cedula && <p className="text-[11px] text-navy-light/60">{m.cedula}</p>}
                </div>
                {already ? (
                  <span className="text-[11px] text-navy-light/60 font-body">Ya inscrito</span>
                ) : (
                  <button
                    onClick={() => inscribir(m.id)}
                    disabled={adding === m.id}
                    className="rounded-full bg-coral px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-coral-deep transition-colors disabled:opacity-50 font-body"
                  >
                    {adding === m.id ? '…' : 'Inscribir'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
