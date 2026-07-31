'use client'

import { useState, useMemo, useEffect } from 'react'
import { Search, X, Users, BookOpen, UsersRound, Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSedes } from '@/lib/sedes'
type MemberLite = { id: string; first_name: string; last_name: string; email: string | null }
// La audiencia de un evento son sus ASISTENTES (check-ins), no inscripciones.
type EventLite = { id: string; title: string; status: string; starts_at: string }
// Shape del GET /api/studies/groups (solo lo que se usa acá).
type GroupLite = {
  id: string
  name: string | null
  status: string
  zone: string | null
  leader: { first_name: string | null; last_name: string | null } | null
  enrollments: Array<{ member_id: string; status: string }>
}

const groupEnrolledIds = (g: GroupLite) =>
  Array.from(new Set(g.enrollments.filter(e => e.status === 'enrolled').map(e => e.member_id)))

// 'filters' (constructor de segmentos) se eliminó el 2026-07-31: el botón no
// funcionaba y la forma real de mandar a un segmento es guardarlo como LISTA y
// usar "Usar lista existente".
export type RecipientMode = 'manual' | 'group' | 'audience'

type AudiencePreset = 'all' | 'sede' | 'servidonantes'

export type RecipientState = {
  mode: RecipientMode
  // manual
  manualMemberIds: string[]
  // group
  groupEntity: 'event' | 'study_group' | 'committee' | null
  groupId: string
  // computed label
  label: string
  count: number
}

interface Props {
  value: RecipientState
  onChange: (v: RecipientState) => void
}

const MODE_OPTIONS: { key: RecipientMode; label: string; icon: React.ElementType; description: string }[] = [
  { key: 'audience', label: 'Audiencia', icon: Megaphone, description: 'Todos / por sede / servidonantes' },
  { key: 'manual',  label: 'Selección manual',  icon: Users,  description: 'Elegir 1-5 personas específicas' },
  { key: 'group',   label: 'Grupo existente',   icon: UsersRound, description: 'Evento, estudio o comité' },
]

export function RecipientSelector({ value, onChange }: Props) {
  const [memberSearch, setMemberSearch] = useState('')
  const [memberResults, setMemberResults] = useState<MemberLite[]>([])
  const [selectedMembers, setSelectedMembers] = useState<MemberLite[]>([])
  const [events, setEvents] = useState<EventLite[]>([])

  const [groups, setGroups] = useState<GroupLite[]>([])
  // Comités con los ids de sus servidores activos (facet del endpoint de
  // audiencia: el rol comunicaciones no tiene el módulo servidores).
  const [committees, setCommittees] = useState<Array<{ id: string; name: string; member_ids: string[] }>>([])

  // Modo "audiencia": preset + sedes seleccionadas + estado de carga del conteo.
  const { activeSedes } = useSedes()
  const [audPreset, setAudPreset] = useState<AudiencePreset>('all')
  const [audSedes, setAudSedes] = useState<string[]>([])
  const [audLoading, setAudLoading] = useState(false)
  // Fuente de la audiencia de un evento: asistentes (check-in) o inscritos.
  const [eventSource, setEventSource] = useState<'checkin' | 'registration'>('checkin')

  // Carga de eventos y grupos de estudio reales (para el modo "grupo").
  useEffect(() => {
    let alive = true
    fetch('/api/events?pageSize=100&light=1')
      .then(r => (r.ok ? r.json() : { events: [] }))
      .then(d => { if (alive) setEvents((d.events ?? []) as EventLite[]) })
      .catch(() => { if (alive) setEvents([]) })
    // include=enrollments: este selector necesita los member_id de los inscritos
    // (el listado default ya solo trae conteos).
    fetch('/api/studies/groups?include=enrollments')
      .then(r => (r.ok ? r.json() : []))
      .then(d => { if (alive && Array.isArray(d)) setGroups(d as GroupLite[]) })
      .catch(() => { if (alive) setGroups([]) })
    fetch('/api/communications/audience?facet=committees')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d?.committees) setCommittees(d.committees) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  // Búsqueda real de miembros (debounced) para el modo "selección manual".
  useEffect(() => {
    const q = memberSearch.trim()
    if (q.length < 2) { setMemberResults([]); return }
    let alive = true
    const t = setTimeout(() => {
      fetch(`/api/members?search=${encodeURIComponent(q)}&pageSize=6`)
        .then(r => (r.ok ? r.json() : { members: [] }))
        .then(d => {
          if (!alive) return
          const list = (d.members ?? []) as MemberLite[]
          setMemberResults(list.filter(m => !value.manualMemberIds.includes(m.id)))
        })
        .catch(() => { if (alive) setMemberResults([]) })
    }, 300)
    return () => { alive = false; clearTimeout(t) }
  }, [memberSearch, value.manualMemberIds])

  const upcomingEvents = useMemo(
    () => events.filter(e => e.status !== 'cancelled' && e.status !== 'archived').slice(0, 50),
    [events]
  )

  const activeGroups = useMemo(
    () => groups.filter(g => g.status === 'en_matricula' || g.status === 'en_curso'),
    [groups]
  )

  function setMode(mode: RecipientMode) {
    setSelectedMembers([])
    onChange({ ...value, mode, manualMemberIds: [], groupEntity: null, groupId: '', label: '', count: 0 })
  }

  function addMember(member: MemberLite) {
    const newIds = [...value.manualMemberIds, member.id]
    setSelectedMembers(prev => [...prev, member])
    onChange({
      ...value,
      manualMemberIds: newIds,
      count: newIds.length,
      label: `${newIds.length} persona${newIds.length !== 1 ? 's' : ''} seleccionada${newIds.length !== 1 ? 's' : ''}`,
    })
    setMemberSearch('')
    setMemberResults([])
  }

  function removeMember(id: string) {
    const newIds = value.manualMemberIds.filter(m => m !== id)
    setSelectedMembers(prev => prev.filter(m => m.id !== id))
    onChange({
      ...value,
      manualMemberIds: newIds,
      count: newIds.length,
      label: newIds.length > 0 ? `${newIds.length} persona${newIds.length !== 1 ? 's' : ''} seleccionada${newIds.length !== 1 ? 's' : ''}` : '',
    })
  }

  // Al elegir evento/grupo se resuelven los member_id reales en
  // manualMemberIds: el envío encola exactamente esa lista (antes el modo
  // grupo mandaba el conteo pero cero destinatarios).
  async function setGroupEvent(eventId: string, source: 'checkin' | 'registration' = eventSource) {
    const event = events.find(e => e.id === eventId)
    if (!eventId || !event) {
      onChange({ ...value, groupEntity: 'event', groupId: '', manualMemberIds: [], count: 0, label: '' })
      return
    }
    const noun = source === 'checkin' ? 'Asistentes a' : 'Inscritos a'
    const labelFor = (n: number) => `${noun} "${event.title}" (${n})`
    // Estado intermedio mientras resuelve.
    onChange({ ...value, groupEntity: 'event', groupId: eventId, manualMemberIds: [], count: 0, label: labelFor(0) })
    try {
      const url = source === 'checkin' ? `/api/events/${eventId}/checkins` : `/api/events/${eventId}/registrations`
      const res = await fetch(url)
      const d = res.ok ? await res.json() : { member_ids: [] }
      const ids = (d.member_ids ?? []) as string[]
      onChange({ ...value, groupEntity: 'event', groupId: eventId, manualMemberIds: ids, count: ids.length, label: labelFor(ids.length) })
    } catch { /* deja 0 si falla */ }
  }

  function setGroupCommittee(committeeId: string) {
    const committee = committees.find(c => c.id === committeeId)
    if (!committee) {
      onChange({ ...value, groupEntity: 'committee', groupId: '', manualMemberIds: [], count: 0, label: '' })
      return
    }
    onChange({
      ...value,
      groupEntity: 'committee',
      groupId: committeeId,
      manualMemberIds: committee.member_ids,
      count: committee.member_ids.length,
      label: `Servidores de "${committee.name}"`,
    })
  }

  function setGroupStudy(groupId: string) {
    const group = groups.find(g => g.id === groupId)
    if (!group) return
    const ids = groupEnrolledIds(group)
    const leaderName = group.leader ? `${group.leader.first_name ?? ''} ${group.leader.last_name ?? ''}`.trim() : null
    onChange({
      ...value,
      groupEntity: 'study_group',
      groupId,
      manualMemberIds: ids,
      count: ids.length,
      label: `Participantes de "${group.name ?? leaderName ?? 'grupo de estudio'}"`,
    })
  }

  // Resuelve la audiencia elegible (server-side) y la vuelca en manualMemberIds.
  async function applyAudience(preset: AudiencePreset, sedes: string[]) {
    setAudPreset(preset)
    setAudSedes(sedes)
    if (preset === 'sede' && sedes.length === 0) {
      onChange({ ...value, manualMemberIds: [], count: 0, label: '' })
      return
    }
    setAudLoading(true)
    try {
      const qs = new URLSearchParams({ type: preset })
      if (preset === 'sede') qs.set('sedes', sedes.join(','))
      const res = await fetch(`/api/communications/audience?${qs}`)
      const d = res.ok ? await res.json() : { member_ids: [], count: 0 }
      const label = preset === 'all' ? 'Todos los activos con email'
        : preset === 'servidonantes' ? 'Servidonantes (sirven y donan)'
        : `Sedes: ${sedes.join(', ')}`
      onChange({ ...value, manualMemberIds: d.member_ids ?? [], count: d.count ?? 0, label })
    } catch {
      onChange({ ...value, manualMemberIds: [], count: 0, label: '' })
    } finally {
      setAudLoading(false)
    }
  }

  function toggleAudSede(code: string) {
    const next = audSedes.includes(code) ? audSedes.filter(c => c !== code) : [...audSedes, code]
    applyAudience('sede', next)
  }

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {MODE_OPTIONS.map(opt => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setMode(opt.key)}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-xl p-3 border text-center transition-all',
              value.mode === opt.key
                ? 'bg-navy border-navy text-white'
                : 'border-outline-variant text-navy-light/60 hover:border-navy/30 hover:text-navy'
            )}
            style={{ borderColor: value.mode === opt.key ? undefined : 'var(--outline-variant)' }}
          >
            <opt.icon size={16} />
            <span className="text-[11px] font-medium leading-tight font-body">
              {opt.label}
            </span>
          </button>
        ))}
      </div>

      {/* Mode content */}
      {value.mode === 'audience' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {([['all', 'Todos los activos'], ['sede', 'Por sede'], ['servidonantes', 'Servidonantes']] as [AudiencePreset, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => applyAudience(key, key === 'sede' ? audSedes : [])}
                className={cn(
                  'rounded-xl border p-3 text-left transition-colors',
                  audPreset === key ? 'border-coral bg-coral/[0.06]' : 'border-[var(--outline-variant)] hover:bg-surface-low',
                )}
              >
                <span className={cn('text-[13px] font-medium font-body', audPreset === key ? 'text-coral' : 'text-navy')}>{label}</span>
              </button>
            ))}
          </div>

          {audPreset === 'sede' && (
            <div className="flex flex-wrap gap-1.5">
              {activeSedes.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleAudSede(s.id)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-[12px] font-body transition-colors',
                    audSedes.includes(s.id) ? 'bg-navy text-white' : 'bg-surface-low text-navy-light hover:bg-surface-container',
                  )}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}

          <div className="rounded-xl bg-surface-low px-3 py-2.5 text-[12px] text-navy-light/70 font-body">
            {audLoading ? 'Calculando elegibles…' : (
              <>Destinatarios elegibles: <strong className="text-navy">{value.count.toLocaleString('es-CR')}</strong>{' '}
              <span className="text-navy-light/50">(descuenta bajas, rebotes y quejas)</span></>
            )}
          </div>
        </div>
      )}

      {value.mode === 'manual' && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-light/60" />
            <input
              className="w-full rounded-xl bg-surface-low pl-8 pr-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
              placeholder="Buscar miembro..."
              aria-label="Buscar miembro"
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
            />
          </div>

          {memberResults.length > 0 && (
            <div className="rounded-xl border overflow-hidden border-[var(--outline-variant)]">
              {memberResults.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => addMember(m)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-low transition-colors border-b last:border-b-0 border-[var(--outline-variant)]"
                >
                  <div className="h-7 w-7 rounded-full bg-navy flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-white">{m.first_name[0]}{m.last_name[0]}</span>
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-navy font-body">
                      {m.first_name} {m.last_name}
                    </p>
                    <p className="text-[11px] text-navy-light/60 font-body">{m.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedMembers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedMembers.map(m => (
                <span
                  key={m.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-navy/10 px-3 py-1 text-[12px] text-navy font-body"
                >
                  {m.first_name} {m.last_name}
                  <button type="button" onClick={() => removeMember(m.id)}>
                    <X size={12} className="text-navy-light/60 hover:text-coral" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {value.mode === 'group' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...value, groupEntity: 'event', groupId: '', count: 0, label: '' })}
              className={cn(
                'flex items-center gap-2 rounded-xl border p-3 text-[12px] transition-all font-body',
                value.groupEntity === 'event'
                  ? 'bg-navy/10 border-navy/30 text-navy font-medium'
                  : 'text-navy-light/60 hover:text-navy'
              , 'border-outline')}
            >
              <BookOpen size={14} />
              Evento
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...value, groupEntity: 'study_group', groupId: '', count: 0, label: '' })}
              className={cn(
                'flex items-center gap-2 rounded-xl border p-3 text-[12px] transition-all font-body',
                value.groupEntity === 'study_group'
                  ? 'bg-navy/10 border-navy/30 text-navy font-medium'
                  : 'text-navy-light/60 hover:text-navy'
              , 'border-outline')}
            >
              <UsersRound size={14} />
              Grupo de estudio
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...value, groupEntity: 'committee', groupId: '', manualMemberIds: [], count: 0, label: '' })}
              className={cn(
                'flex items-center gap-2 rounded-xl border p-3 text-[12px] transition-all font-body',
                value.groupEntity === 'committee'
                  ? 'bg-navy/10 border-navy/30 text-navy font-medium'
                  : 'text-navy-light/60 hover:text-navy'
              , 'border-outline')}
            >
              <Users size={14} />
              Comité
            </button>
          </div>

          {value.groupEntity === 'committee' && (
            <select
              className="w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
              value={value.groupId}
              onChange={e => setGroupCommittee(e.target.value)}
              aria-label="Comité"
            >
              <option value="">Seleccionar comité...</option>
              {committees.map(c => (
                <option key={c.id} value={c.id} disabled={c.member_ids.length === 0}>
                  {c.name} ({c.member_ids.length} servidor{c.member_ids.length === 1 ? '' : 'es'})
                </option>
              ))}
            </select>
          )}

          {value.groupEntity === 'event' && (
            <select
              className="w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
              value={value.groupId}
              onChange={e => setGroupEvent(e.target.value)}
            >
              <option value="">Seleccionar evento...</option>
              {upcomingEvents.map(e => (
                <option key={e.id} value={e.id}>
                  {e.title}{e.starts_at ? ` · ${new Date(e.starts_at).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: '2-digit' })}` : ''}
                </option>
              ))}
            </select>
          )}

          {value.groupEntity === 'event' && value.groupId && (
            <div className="flex gap-2">
              {([['checkin', 'Asistentes (check-in)'], ['registration', 'Inscritos']] as const).map(([src, label]) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => { setEventSource(src); setGroupEvent(value.groupId, src) }}
                  className={cn(
                    'flex-1 rounded-xl border px-3 py-2 text-[12px] font-body transition-colors',
                    eventSource === src ? 'border-coral bg-coral/[0.06] text-coral' : 'border-[var(--outline-variant)] text-navy-light hover:bg-surface-low',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {value.groupEntity === 'study_group' && (
            <select
              className="w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
              value={value.groupId}
              onChange={e => setGroupStudy(e.target.value)}
            >
              <option value="">Seleccionar grupo...</option>
              {activeGroups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name ?? 'Grupo sin nombre'} ({groupEnrolledIds(g).length} participantes)
                </option>
              ))}
            </select>
          )}

          {value.label && (
            <div className="rounded-xl px-3 py-2 bg-surface-low">
              <p className="text-[12px] text-navy font-body">{value.label}</p>
              <p className="text-[11px] text-teal-deep font-semibold mt-0.5 font-display">
                {value.count} destinatario{value.count !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
