'use client'

import { use, useState, useEffect } from 'react'
import { type AttendanceType, type EventCheckin } from '@/types/event'
import { useEvent } from '@/hooks/useEvents'
import { CheckinCard } from '@/components/events/CheckinCard'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { ChevronLeft, Scan, UserPlus, X } from 'lucide-react'
import { FamilyMemberModal, type FamilyDraft } from '@/components/members/FamilyMemberModal'

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
    <span className="tabular-nums text-white/70 text-lg font-mono">
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
  const [familyCheckin, setFamilyCheckin] = useState<{ member: { id: string; name: string }; family: { member_id: string; name: string; relation: string }[] } | null>(null)
  const [checkingFamily, setCheckingFamily] = useState(false)

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

  // Persiste un check-in (optimista con rollback). Reutilizado por el flujo
  // individual, el de familia y el de persona nueva.
  async function persistCheckin(m: { id: string; name: string }, type: AttendanceType) {
    const subEventId = event!.sub_events.length > 0 ? event!.sub_events[0].id : null
    const stamp = new Date().toISOString() + ':' + m.id
    const newCheckin: EventCheckin & { _new?: boolean } = {
      member_id: m.id,
      member_name: m.name,
      attendance_type: type,
      sub_event_id: subEventId,
      checked_at: stamp,
      _new: true,
    }
    setCheckins(prev => [newCheckin, ...prev])
    setRecentCheckins(prev => [newCheckin, ...prev].slice(0, 8))
    setTimeout(() => setRecentCheckins(prev => prev.map(c => ({ ...c, _new: false }))), 50)
    try {
      const res = await fetch(`/api/events/${id}/checkins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: m.id, sub_event_id: subEventId, method: 'manual' }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (err) {
      console.error('No se pudo registrar el check-in:', err)
      setCheckins(prev => prev.filter(c => c.checked_at !== stamp))
      setRecentCheckins(prev => prev.filter(c => c.checked_at !== stamp))
    }
  }

  // Al elegir un miembro existente: si tiene familia, ofrecer registrar a todos.
  async function handleSelectMember(member: { id: string; name: string }) {
    try {
      const res = await fetch(`/api/members/${member.id}/family`)
      const family = res.ok ? await res.json() : []
      if (Array.isArray(family) && family.length > 0) {
        setFamilyCheckin({ member, family })
        return
      }
    } catch { /* si falla, seguimos al flujo individual */ }
    setSelectedMember(member)
  }

  async function handleConfirm(type: AttendanceType) {
    if (!selectedMember) return
    const member = selectedMember
    setSelectedMember(null)
    setQuery('')
    await persistCheckin(member, type)
  }

  // Registra varios miembros (familia) al evento.
  async function registerFamily(ids: string[]) {
    if (!familyCheckin) return
    setCheckingFamily(true)
    const all = [{ member_id: familyCheckin.member.id, name: familyCheckin.member.name }, ...familyCheckin.family]
    for (const id of ids) {
      const m = all.find(x => x.member_id === id)
      if (m) await persistCheckin({ id: m.member_id, name: m.name }, 'participant')
    }
    setCheckingFamily(false)
    setFamilyCheckin(null)
    setQuery('')
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
    <div className="min-h-screen bg-navy flex flex-col font-body">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4 border-b border-white/10">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Link
            href={`/eventos/${id}`}
            className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors text-sm"
          >
            <ChevronLeft size={16} />
            Volver
          </Link>
          <div className="h-5 w-px bg-white/10 shrink-0" />
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm font-display truncate">
              {event.name}
            </p>
            <p className="text-white/40 text-[11px]">Check-in en vivo</p>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-6 shrink-0">
          <span className="hidden sm:inline-flex"><Clock /></span>
          <div className="text-right">
            <p
              className="text-4xl font-extrabold text-white tabular-nums font-display"
            >
              {checkins.length}
            </p>
            <p className="text-[11px] text-white/40">check-ins</p>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-y-auto lg:overflow-hidden">
        {/* Panel izquierdo — 60% */}
        <div className="w-full lg:w-3/5 p-4 sm:p-6 flex flex-col gap-4 border-b lg:border-b-0 lg:border-r border-white/10">
          {/* Search */}
          <div className="relative">
            <input
              className="w-full rounded-2xl px-5 py-4 text-base text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-coral/40 transition-all bg-[rgba(255,255,255,0.08)] font-body"
              placeholder="Buscar por nombre..."
              aria-label="Buscar por nombre"
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
                  onClick={() => handleSelectMember(r)}
                  className="w-full flex items-center gap-4 rounded-2xl px-4 py-3 text-left hover:bg-white/10 transition-all bg-[rgba(255,255,255,0.05)]"
                >
                  <div className={cn('h-10 w-10 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0', avatarColor(r.name))}>
                    {getInitials(r.name)}
                  </div>
                  <div>
                    <p className="text-white font-medium font-body">{r.name}</p>
                    <p className="text-white/40 text-[12px]">{registeredIds.has(r.id) ? 'Inscrito' : 'Miembro'}</p>
                  </div>
                </button>
              ))}
              <button
                onClick={() => setShowNewPerson(true)}
                className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-coral hover:bg-coral/10 transition-all border border-dashed border-coral/40"
              >
                <UserPlus size={18} />
                <span className="text-sm font-medium font-body">Agregar a «{query.trim()}» como persona nueva</span>
              </button>
            </div>
          ) : query.trim().length >= 2 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <p className="text-white/30 text-sm">{searching ? 'Buscando…' : 'No se encontró nadie con ese nombre.'}</p>
              {!searching && (
                <button
                  onClick={() => setShowNewPerson(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-coral px-4 py-2.5 text-sm font-medium text-white hover:bg-coral-deep transition-colors font-body"
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
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 transition-colors font-body"
              >
                <UserPlus size={15} /> Agregar persona nueva
              </button>
            </div>
          )}
        </div>

        {/* Panel derecho — 40% */}
        <div className="w-full lg:w-2/5 p-4 sm:p-6 flex flex-col gap-5">
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
            <p className="text-[10px] tracking-widest uppercase text-white/30 mb-3 font-display">
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
                    <p className="text-white text-sm truncate font-body">{ci.member_name}</p>
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
          onCheckedIn={() => { setShowNewPerson(false); setQuery('') }}
          persistCheckin={persistCheckin}
        />
      )}

      {familyCheckin && (
        <FamilyCheckinModal
          member={familyCheckin.member}
          family={familyCheckin.family}
          busy={checkingFamily}
          onRegister={registerFamily}
          onClose={() => setFamilyCheckin(null)}
        />
      )}
    </div>
  )
}

// ─── Modal: check-in en familia (miembro existente con familia) ──────────────────

function FamilyCheckinModal({ member, family, busy, onRegister, onClose }: {
  member: { id: string; name: string }
  family: { member_id: string; name: string; relation: string }[]
  busy: boolean
  onRegister: (ids: string[]) => void
  onClose: () => void
}) {
  // El miembro encontrado siempre va; los familiares arrancan seleccionados.
  const [selected, setSelected] = useState<Set<string>>(new Set(family.map(f => f.member_id)))

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-navy-ink/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-3xl bg-navy border border-white/10 p-6 space-y-4 shadow-[var(--shadow-lg)]" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-extrabold text-white font-display">
          {member.name} viene con familia
        </h3>
        <p className="text-sm text-white/60 font-body">¿Quién más llegó?</p>

        <div className="space-y-2 max-h-72 overflow-y-auto">
          <div className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2.5">
            <div className="h-8 w-8 rounded-full bg-coral flex items-center justify-center text-[10px] font-bold text-white">{getInitials(member.name)}</div>
            <span className="flex-1 text-sm text-white font-body">{member.name}</span>
            <span className="text-[11px] text-white/40">Titular</span>
          </div>
          {family.map(f => (
            <label key={f.member_id} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5 cursor-pointer">
              <input type="checkbox" checked={selected.has(f.member_id)} onChange={() => toggle(f.member_id)} className="accent-coral h-4 w-4" />
              <div className="h-8 w-8 rounded-full bg-navy-light flex items-center justify-center text-[10px] font-bold text-white">{getInitials(f.name)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate font-body">{f.name}</p>
                <p className="text-[11px] text-white/40">{f.relation}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onRegister([member.id])}
            disabled={busy}
            className="flex-1 rounded-2xl border border-white/15 py-3 text-sm font-medium text-white/80 hover:bg-white/10 transition-colors disabled:opacity-50 font-body"
          >
            Solo {member.name.split(' ')[0]}
          </button>
          <button
            onClick={() => onRegister([member.id, ...Array.from(selected)])}
            disabled={busy}
            className="flex-1 rounded-2xl bg-coral py-3 text-sm font-semibold text-white hover:bg-coral-deep transition-colors disabled:opacity-50 font-body"
          >
            {busy ? 'Registrando…' : `Registrar ${1 + selected.size}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: agregar persona nueva (primera visita) ──────────────────────────────

function NewPersonModal({ initialName, onClose, onCreated, onCheckedIn, persistCheckin }: {
  initialName: string
  onClose: () => void
  onCreated: (member: { id: string; name: string }) => void
  onCheckedIn: () => void
  persistCheckin: (m: { id: string; name: string }, type: AttendanceType) => Promise<void>
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
  const [familyDrafts, setFamilyDrafts] = useState<FamilyDraft[]>([])
  const [showFamily, setShowFamily] = useState(false)

  const valid = firstName.trim().length > 0 && lastName.trim().length > 0

  async function createMember(payload: Record<string, unknown>): Promise<{ id: string; name: string }> {
    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(data?.error === 'duplicate'
        ? `Ya existe un miembro con la cédula o correo de ${payload.first_name}.`
        : `No se pudo crear a ${payload.first_name}.`)
    }
    return { id: data.id as string, name: `${payload.first_name} ${payload.last_name}` }
  }

  async function submit() {
    if (!valid || saving) return
    setSaving(true)
    setError(null)
    try {
      const principal = await createMember({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        cedula: cedula.trim() || null,
        birth_date: birthDate || null,
        send_invite: !!email.trim(),
      })

      // Sin familia → flujo de una persona (el operador elige participante/servidor).
      if (familyDrafts.length === 0) {
        onCreated(principal)
        return
      }

      // Con familia → crear integrantes, armar familia y check-in de todos.
      const entries: Array<{ member_id: string; relation: string }> = [{ member_id: principal.id, relation: 'Titular' }]
      const toCheckin: Array<{ id: string; name: string }> = [principal]
      for (const d of familyDrafts) {
        if (d.kind === 'linked') {
          entries.push({ member_id: d.member_id, relation: d.relation })
          toCheckin.push({ id: d.member_id, name: `${d.first_name} ${d.last_name}` })
        } else {
          const created = await createMember({
            first_name: d.first_name,
            last_name: d.last_name || lastName.trim(),
            cedula: d.cedula,
            birth_date: d.birth_date,
            phone: d.phone,
            email: d.email,
            send_invite: !!d.email,
          })
          entries.push({ member_id: created.id, relation: d.relation })
          toCheckin.push(created)
        }
      }
      const famRes = await fetch('/api/families', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Familia ${lastName.trim()}`, members: entries }),
      })
      if (!famRes.ok) throw new Error('Se crearon los miembros pero falló la creación de la familia.')

      for (const m of toCheckin) await persistCheckin(m, 'participant')
      onCheckedIn()
    } catch (err) {
      console.error('Error creando persona/familia:', err)
      setError(err instanceof Error ? err.message : 'No se pudo crear. Intentá de nuevo.')
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
        className="relative w-full max-w-md rounded-3xl p-6 space-y-4 bg-navy border border-white/10 shadow-[var(--shadow-lg)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-white font-display">Persona nueva</h3>
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

        {/* Familia */}
        <div className="space-y-2">
          {familyDrafts.map((d, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
              <div className="h-7 w-7 rounded-full bg-navy-light flex items-center justify-center text-[10px] font-bold text-white">{getInitials(`${d.first_name} ${d.last_name}`)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate font-body">{d.first_name} {d.last_name}</p>
                <p className="text-[11px] text-white/40">{d.relation} · {d.kind === 'linked' ? 'existente' : 'nuevo'}</p>
              </div>
              <button onClick={() => setFamilyDrafts(prev => prev.filter((_, j) => j !== i))} className="text-white/30 hover:text-coral"><X size={14} /></button>
            </div>
          ))}
          <button
            onClick={() => setShowFamily(true)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 py-2.5 text-[13px] text-white/60 hover:text-white hover:border-white/30 transition-colors font-body"
          >
            <UserPlus size={14} /> Agregar familia
          </button>
        </div>

        {error && <p className="text-[12px] text-coral font-body">{error}</p>}

        <p className="text-[11px] text-white/40 font-body">
          Si tiene correo, se le enviará una invitación para completar su perfil y crear su contraseña.
        </p>

        <button
          onClick={submit}
          disabled={!valid || saving}
          className="w-full rounded-2xl bg-coral py-3 text-sm font-semibold text-white hover:bg-coral-deep transition-colors disabled:opacity-40 font-body"
        >
          {saving ? 'Creando…' : familyDrafts.length > 0 ? `Crear familia y check-in (${familyDrafts.length + 1})` : 'Crear y hacer check-in'}
        </button>
      </div>

      {showFamily && (
        <FamilyMemberModal
          defaultLastName={lastName.trim()}
          existingIds={familyDrafts.filter((f): f is Extract<FamilyDraft, { kind: 'linked' }> => f.kind === 'linked').map(f => f.member_id)}
          onAdd={d => { setFamilyDrafts(prev => [...prev, d]); setShowFamily(false) }}
          onClose={() => setShowFamily(false)}
        />
      )}
    </div>
  )
}
