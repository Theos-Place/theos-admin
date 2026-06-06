'use client'

import { use, useState, useEffect } from 'react'
import { type AttendanceType, type EventCheckin } from '@/types/event'
import { useEvent } from '@/hooks/useEvents'
import { CheckinCard } from '@/components/events/CheckinCard'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { ChevronLeft, Scan, UserPlus, X } from 'lucide-react'

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
function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

function Clock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }, 1000)
    return () => clearInterval(interval)
  }, [])
  return (
    <span className="tabular-nums text-white/70 text-lg" style={{ fontFamily: 'var(--font-mono)' }}>
      {time}
    </span>
  )
}

export default function CheckinLivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { event } = useEvent(id)
  const [query, setQuery] = useState('')
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string } | null>(null)
  const [checkins, setCheckins] = useState<EventCheckin[]>([])
  const [recentCheckins, setRecentCheckins] = useState<(EventCheckin & { _new?: boolean })[]>([])
  const [memberResults, setMemberResults] = useState<{ id: string; name: string }[]>([])
  const [searching, setSearching] = useState(false)
  const [showNewPerson, setShowNewPerson] = useState(false)

  // Sincroniza los check-ins ya registrados cuando carga el evento.
  useEffect(() => {
    if (event) setCheckins(event.checkins)
  }, [event])

  // Búsqueda real entre TODOS los miembros (debounced).
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setMemberResults([]); return }
    let alive = true
    setSearching(true)
    const t = setTimeout(() => {
      fetch(`/api/members?search=${encodeURIComponent(q)}&pageSize=8`)
        .then(r => (r.ok ? r.json() : { members: [] }))
        .then(d => {
          if (!alive) return
          const list = (d.members ?? []) as Array<{ id: string; first_name: string; last_name: string }>
          setMemberResults(list.map(m => ({ id: m.id, name: `${m.first_name} ${m.last_name}`.trim() })))
        })
        .catch(() => { if (alive) setMemberResults([]) })
        .finally(() => { if (alive) setSearching(false) })
    }, 300)
    return () => { alive = false; clearTimeout(t) }
  }, [query])

  if (!event) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-white/60">Evento no encontrado.</p>
          <Link href="/eventos" className="text-coral hover:text-coral-deep">← Volver</Link>
        </div>
      </div>
    )
  }

  const registeredIds = new Set(event.registrations.map(r => r.member_id))
  const searchResults = memberResults

  async function handleConfirm(type: AttendanceType) {
    if (!selectedMember) return
    const member = selectedMember
    const subEventId = event!.sub_events.length > 0 ? event!.sub_events[0].id : null
    const newCheckin: EventCheckin & { _new?: boolean } = {
      member_id: member.id,
      member_name: member.name,
      attendance_type: type,
      sub_event_id: subEventId,
      checked_at: new Date().toISOString(),
      _new: true,
    }
    // Optimista: mostramos el check-in de una.
    setCheckins(prev => [newCheckin, ...prev])
    setRecentCheckins(prev => [newCheckin, ...prev].slice(0, 8))
    setSelectedMember(null)
    setQuery('')
    setTimeout(() => {
      setRecentCheckins(prev => prev.map(c => ({ ...c, _new: false })))
    }, 50)

    // Persistimos en Supabase. Si falla, revertimos el optimista.
    try {
      const res = await fetch(`/api/events/${id}/checkins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: member.id, sub_event_id: subEventId, method: 'manual' }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (err) {
      console.error('No se pudo registrar el check-in:', err)
      setCheckins(prev => prev.filter(c => c.checked_at !== newCheckin.checked_at))
      setRecentCheckins(prev => prev.filter(c => c.checked_at !== newCheckin.checked_at))
    }
  }

  function handleSimulateQR() {
    const registered = event!.registrations
    if (registered.length === 0) return
    const random = registered[Math.floor(Math.random() * registered.length)]
    setSelectedMember({ id: random.member_id, name: random.member_name })
    setQuery(random.member_name)
  }

  // Crea un miembro nuevo (primera visita) y lo deja seleccionado para el check-in.
  async function handlePersonCreated(member: { id: string; name: string }) {
    setShowNewPerson(false)
    setMemberResults([])
    setSelectedMember(member)
    setQuery(member.name)
  }

  return (
    <div className="min-h-screen bg-navy flex flex-col" style={{ fontFamily: 'var(--font-body)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-4">
          <Link
            href={`/eventos/${id}`}
            className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors text-sm"
          >
            <ChevronLeft size={16} />
            Volver
          </Link>
          <div className="h-5 w-px bg-white/10" />
          <div>
            <p className="text-white font-semibold text-sm" style={{ fontFamily: 'var(--font-display)' }}>
              {event.name}
            </p>
            <p className="text-white/40 text-[11px]">Check-in en vivo</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <Clock />
          <div className="text-right">
            <p
              className="text-4xl font-extrabold text-white tabular-nums"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {checkins.length}
            </p>
            <p className="text-[11px] text-white/40">check-ins</p>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex gap-0 overflow-hidden">
        {/* Panel izquierdo — 60% */}
        <div className="w-3/5 p-6 flex flex-col gap-4 border-r border-white/10">
          {/* Search */}
          <div className="relative">
            <input
              className="w-full rounded-2xl px-5 py-4 text-base text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-coral/40 transition-all"
              style={{ background: 'rgba(255,255,255,0.08)', fontFamily: 'var(--font-body)' }}
              placeholder="Buscar por nombre..."
              value={query}
              onChange={e => { setQuery(e.target.value); setSelectedMember(null) }}
            />
            <button
              onClick={handleSimulateQR}
              className="absolute right-4 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12px] text-white/60 hover:bg-white/20 transition-colors"
            >
              <Scan size={13} />
              Simular QR
            </button>
          </div>

          {/* Results o Checkin card */}
          {selectedMember ? (
            <div className="flex justify-center pt-4">
              <CheckinCard
                member={selectedMember}
                onConfirm={handleConfirm}
                onCancel={() => { setSelectedMember(null); setQuery('') }}
              />
            </div>
          ) : searchResults.length > 0 ? (
            <div className="space-y-2 flex-1 overflow-y-auto">
              {searchResults.map(r => (
                <button
                  key={r.id}
                  onClick={() => setSelectedMember(r)}
                  className="w-full flex items-center gap-4 rounded-2xl px-4 py-3 text-left hover:bg-white/10 transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  <div className={cn('h-10 w-10 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0', avatarColor(r.name))}>
                    {getInitials(r.name)}
                  </div>
                  <div>
                    <p className="text-white font-medium" style={{ fontFamily: 'var(--font-body)' }}>{r.name}</p>
                    <p className="text-white/40 text-[12px]">{registeredIds.has(r.id) ? 'Inscrito' : 'Miembro'}</p>
                  </div>
                </button>
              ))}
              <button
                onClick={() => setShowNewPerson(true)}
                className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-coral hover:bg-coral/10 transition-all border border-dashed border-coral/40"
              >
                <UserPlus size={18} />
                <span className="text-sm font-medium" style={{ fontFamily: 'var(--font-body)' }}>Agregar a «{query.trim()}» como persona nueva</span>
              </button>
            </div>
          ) : query.trim().length >= 2 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <p className="text-white/30 text-sm">{searching ? 'Buscando…' : 'No se encontró nadie con ese nombre.'}</p>
              {!searching && (
                <button
                  onClick={() => setShowNewPerson(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-coral px-4 py-2.5 text-sm font-medium text-white hover:bg-coral-deep transition-colors"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  <UserPlus size={15} /> Agregar persona nueva
                </button>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <p className="text-white/20 text-sm">Escribí un nombre o usá el QR.</p>
              <button
                onClick={() => setShowNewPerson(true)}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 transition-colors"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <UserPlus size={15} /> Agregar persona nueva
              </button>
            </div>
          )}
        </div>

        {/* Panel derecho — 40% */}
        <div className="w-2/5 p-6 flex flex-col gap-5">
          {/* Marco QR */}
          <div className="flex flex-col items-center justify-center py-6">
            <div className="relative w-36 h-36">
              {/* Esquinas del marco */}
              {[
                'top-0 left-0 border-t-2 border-l-2',
                'top-0 right-0 border-t-2 border-r-2',
                'bottom-0 left-0 border-b-2 border-l-2',
                'bottom-0 right-0 border-b-2 border-r-2',
              ].map((cls, i) => (
                <div key={i} className={cn('absolute h-6 w-6 border-coral/60 animate-pulse', cls)} />
              ))}
              <div className="absolute inset-0 flex items-center justify-center">
                <Scan size={40} className="text-white/20" />
              </div>
            </div>
            <p className="text-white/40 text-[12px] mt-3 text-center">Escaneá el pase digital</p>
          </div>

          {/* Feed check-ins recientes */}
          <div className="flex-1 space-y-2 overflow-y-auto">
            <p className="text-[10px] tracking-widest uppercase text-white/30 mb-3" style={{ fontFamily: 'var(--font-display)' }}>
              Recientes
            </p>
            {recentCheckins.length === 0 ? (
              <p className="text-white/20 text-sm text-center pt-4">Los check-ins aparecerán aquí.</p>
            ) : (
              recentCheckins.map((ci, i) => (
                <div
                  key={`${ci.member_id}-${ci.checked_at}`}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-300',
                    ci._new ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0',
                    i === 0 ? 'bg-white/15' : 'bg-white/5'
                  )}
                >
                  <div className={cn('h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0', avatarColor(ci.member_name))}>
                    {getInitials(ci.member_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate" style={{ fontFamily: 'var(--font-body)' }}>{ci.member_name}</p>
                    <p className="text-white/40 text-[11px]">
                      {new Date(ci.checked_at).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={cn(
                    'rounded-md px-2 py-0.5 text-[10px] font-medium shrink-0',
                    ci.attendance_type === 'server' ? 'bg-coral/20 text-coral' : 'bg-teal-deep/20 text-teal-soft'
                  )}>
                    {ci.attendance_type === 'server' ? 'Servidor' : 'Participante'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showNewPerson && (
        <NewPersonModal
          initialName={query.trim()}
          onClose={() => setShowNewPerson(false)}
          onCreated={handlePersonCreated}
        />
      )}
    </div>
  )
}

// ─── Modal: agregar persona nueva (primera visita) ──────────────────────────────

function NewPersonModal({ initialName, onClose, onCreated }: {
  initialName: string
  onClose: () => void
  onCreated: (member: { id: string; name: string }) => void
}) {
  const parts = initialName.split(' ')
  const [firstName, setFirstName] = useState(parts[0] ?? '')
  const [lastName, setLastName] = useState(parts.slice(1).join(' '))
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [cedula, setCedula] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valid = firstName.trim().length > 0 && lastName.trim().length > 0

  async function submit() {
    if (!valid || saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          cedula: cedula.trim() || null,
          birth_date: birthDate || null,
          send_invite: true,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        console.error('No se pudo crear la persona:', res.status, data)
        setError(data?.error === 'duplicate'
          ? 'Ya existe un miembro con esa cédula o correo.'
          : 'No se pudo crear la persona. Revisá los datos e intentá de nuevo.')
        return
      }
      onCreated({ id: data.id, name: `${firstName.trim()} ${lastName.trim()}` })
    } catch (err) {
      console.error('Error de red al crear la persona:', err)
      setError('No se pudo crear la persona. Intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const fieldCls = 'w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-coral/40'
  const fieldStyle = { background: 'rgba(255,255,255,0.08)', fontFamily: 'var(--font-body)' } as const

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-navy-ink/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-3xl p-6 space-y-4 bg-navy border border-white/10"
        style={{ boxShadow: 'var(--shadow-lg)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-white" style={{ fontFamily: 'var(--font-display)' }}>Persona nueva</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] text-white/50" style={fieldStyle}>Nombre *</label>
            <input className={fieldCls} style={fieldStyle} value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Nombre" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-white/50" style={fieldStyle}>Apellidos *</label>
            <input className={fieldCls} style={fieldStyle} value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Apellidos" />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-white/50" style={fieldStyle}>Teléfono</label>
          <input className={fieldCls} style={fieldStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="8888-8888" />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-white/50" style={fieldStyle}>Correo</label>
          <input type="email" className={fieldCls} style={fieldStyle} value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] text-white/50" style={fieldStyle}>Cédula</label>
            <input className={fieldCls} style={fieldStyle} value={cedula} onChange={e => setCedula(e.target.value)} placeholder="1-2345-6789" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-white/50" style={fieldStyle}>Fecha de nacimiento</label>
            <input type="date" className={fieldCls} style={fieldStyle} value={birthDate} onChange={e => setBirthDate(e.target.value)} />
          </div>
        </div>

        {error && <p className="text-[12px] text-coral" style={{ fontFamily: 'var(--font-body)' }}>{error}</p>}

        <p className="text-[11px] text-white/40" style={{ fontFamily: 'var(--font-body)' }}>
          Si tiene correo, se le enviará una invitación para completar su perfil y crear su contraseña.
        </p>

        <button
          onClick={submit}
          disabled={!valid || saving}
          className="w-full rounded-2xl bg-coral py-3 text-sm font-semibold text-white hover:bg-coral-deep transition-colors disabled:opacity-40"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {saving ? 'Creando…' : 'Crear y hacer check-in'}
        </button>
      </div>
    </div>
  )
}
