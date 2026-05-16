'use client'

import { use, useState, useEffect } from 'react'
import { getEvent, type AttendanceType, type EventCheckin } from '@/data/mock-events'
import { CheckinCard } from '@/components/events/CheckinCard'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { ChevronLeft, Scan } from 'lucide-react'

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
  const event = getEvent(id)
  const [query, setQuery] = useState('')
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string } | null>(null)
  const [checkins, setCheckins] = useState<EventCheckin[]>(event?.checkins ?? [])
  const [recentCheckins, setRecentCheckins] = useState<(EventCheckin & { _new?: boolean })[]>([])

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

  const searchResults = query.trim().length > 0
    ? event.registrations.filter(r =>
        r.member_name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : []

  function handleConfirm(type: AttendanceType) {
    if (!selectedMember) return
    const newCheckin: EventCheckin & { _new?: boolean } = {
      member_id: selectedMember.id,
      member_name: selectedMember.name,
      attendance_type: type,
      sub_event_id: event!.sub_events.length > 0 ? event!.sub_events[0].id : null,
      checked_at: new Date().toISOString(),
      _new: true,
    }
    setCheckins(prev => [newCheckin, ...prev])
    setRecentCheckins(prev => [newCheckin, ...prev].slice(0, 8))
    setSelectedMember(null)
    setQuery('')
    setTimeout(() => {
      setRecentCheckins(prev => prev.map(c => ({ ...c, _new: false })))
    }, 50)
  }

  function handleSimulateQR() {
    const registered = event!.registrations
    if (registered.length === 0) return
    const random = registered[Math.floor(Math.random() * registered.length)]
    setSelectedMember({ id: random.member_id, name: random.member_name })
    setQuery(random.member_name)
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
                  key={r.member_id}
                  onClick={() => setSelectedMember({ id: r.member_id, name: r.member_name })}
                  className="w-full flex items-center gap-4 rounded-2xl px-4 py-3 text-left hover:bg-white/10 transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  <div className={cn('h-10 w-10 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0', avatarColor(r.member_name))}>
                    {getInitials(r.member_name)}
                  </div>
                  <div>
                    <p className="text-white font-medium" style={{ fontFamily: 'var(--font-body)' }}>{r.member_name}</p>
                    <p className="text-white/40 text-[12px]">Inscrito · {r.payment_status === 'paid' ? 'Pago confirmado' : 'Pago pendiente'}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : query.trim().length > 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-white/30 text-sm">No se encontró nadie con ese nombre.</p>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-white/20 text-sm">Escribí un nombre o usá el QR.</p>
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
    </div>
  )
}
