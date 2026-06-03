'use client'

import { useState, useMemo } from 'react'
import { Search, X, Users, Filter, BookOpen, UsersRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { mockMembers } from '@/data/mock-members'
import { MOCK_EVENTS } from '@/data/mock-events'
import { MOCK_GROUPS, type StudyGroup } from '@/data/mock-studies'

export type RecipientMode = 'filters' | 'manual' | 'group'

export type RecipientState = {
  mode: RecipientMode
  // manual
  manualMemberIds: string[]
  // group
  groupEntity: 'event' | 'study_group' | null
  groupId: string
  // computed label
  label: string
  count: number
}

interface Props {
  value: RecipientState
  onChange: (v: RecipientState) => void
  onOpenFilters?: () => void
  filtersLabel?: string
  filtersCount?: number
}

const MODE_OPTIONS: { key: RecipientMode; label: string; icon: React.ElementType; description: string }[] = [
  { key: 'filters', label: 'Filtros avanzados', icon: Filter, description: 'Usar el constructor de segmentos' },
  { key: 'manual',  label: 'Selección manual',  icon: Users,  description: 'Elegir 1-5 personas específicas' },
  { key: 'group',   label: 'Grupo existente',   icon: UsersRound, description: 'Evento, estudio o comité' },
]

export function RecipientSelector({ value, onChange, onOpenFilters, filtersLabel, filtersCount = 0 }: Props) {
  const [memberSearch, setMemberSearch] = useState('')

  const memberResults = useMemo(() => {
    const q = memberSearch.toLowerCase().trim()
    if (!q) return []
    return mockMembers
      .filter(m => !value.manualMemberIds.includes(m.id) && (
        m.first_name.toLowerCase().includes(q) ||
        m.last_name.toLowerCase().includes(q) ||
        (m.email?.toLowerCase().includes(q) ?? false)
      ))
      .slice(0, 6)
  }, [memberSearch, value.manualMemberIds])

  const selectedMembers = useMemo(
    () => mockMembers.filter(m => value.manualMemberIds.includes(m.id)),
    [value.manualMemberIds]
  )

  const upcomingEvents = useMemo(
    () => MOCK_EVENTS.filter(e => e.status !== 'cancelled' && e.status !== 'archived').slice(0, 10),
    []
  )

  const activeGroups = useMemo(
    () => MOCK_GROUPS.filter((g: StudyGroup) => g.status === 'open' || g.status === 'in_progress').slice(0, 10),
    []
  )

  function setMode(mode: RecipientMode) {
    onChange({ ...value, mode, manualMemberIds: [], groupEntity: null, groupId: '', label: '', count: 0 })
  }

  function addMember(id: string) {
    const member = mockMembers.find(m => m.id === id)
    if (!member) return
    const newIds = [...value.manualMemberIds, id]
    onChange({
      ...value,
      manualMemberIds: newIds,
      count: newIds.length,
      label: `${newIds.length} persona${newIds.length !== 1 ? 's' : ''} seleccionada${newIds.length !== 1 ? 's' : ''}`,
    })
    setMemberSearch('')
  }

  function removeMember(id: string) {
    const newIds = value.manualMemberIds.filter(m => m !== id)
    onChange({
      ...value,
      manualMemberIds: newIds,
      count: newIds.length,
      label: newIds.length > 0 ? `${newIds.length} persona${newIds.length !== 1 ? 's' : ''} seleccionada${newIds.length !== 1 ? 's' : ''}` : '',
    })
  }

  function setGroupEvent(eventId: string) {
    const event = MOCK_EVENTS.find(e => e.id === eventId)
    if (!event) return
    onChange({
      ...value,
      groupEntity: 'event',
      groupId: eventId,
      count: event.registrations.length,
      label: `Inscritos a "${event.name}"`,
    })
  }

  function setGroupStudy(groupId: string) {
    const group = MOCK_GROUPS.find((g: StudyGroup) => g.id === groupId)
    if (!group) return
    const enrolled = group.participants.filter(p => p.status === 'enrolled').length
    onChange({
      ...value,
      groupEntity: 'study_group',
      groupId,
      count: enrolled,
      label: `Participantes del grupo "${group.leader_name ?? 'Sin dirigente'}" (${group.zone})`,
    })
  }

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <div className="grid grid-cols-3 gap-2">
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
            <span className="text-[11px] font-medium leading-tight" style={{ fontFamily: 'var(--font-body)' }}>
              {opt.label}
            </span>
          </button>
        ))}
      </div>

      {/* Mode content */}
      {value.mode === 'filters' && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={onOpenFilters}
            className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed py-4 text-sm text-navy-light/50 hover:border-navy/30 hover:text-navy transition-all"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            <Filter size={15} />
            Abrir filtros de miembros
          </button>
          {filtersLabel && (
            <div className="rounded-xl p-3 flex items-center justify-between gap-2" style={{ background: 'var(--surface-low)' }}>
              <div>
                <p className="text-[12px] font-medium text-navy" style={{ fontFamily: 'var(--font-body)' }}>{filtersLabel}</p>
                <p className="text-[11px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>~{filtersCount} miembros</p>
              </div>
              <span className="text-[11px] text-teal-deep font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                ✓ Aplicado
              </span>
            </div>
          )}
        </div>
      )}

      {value.mode === 'manual' && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-light/40" />
            <input
              className="w-full rounded-xl bg-surface-low pl-8 pr-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30"
              style={{ fontFamily: 'var(--font-body)' }}
              placeholder="Buscar miembro..."
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
            />
          </div>

          {memberResults.length > 0 && (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--outline-variant)' }}>
              {memberResults.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => addMember(m.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-low transition-colors border-b last:border-b-0"
                  style={{ borderColor: 'var(--outline-variant)' }}
                >
                  <div className="h-7 w-7 rounded-full bg-navy flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-white">{m.first_name[0]}{m.last_name[0]}</span>
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                      {m.first_name} {m.last_name}
                    </p>
                    <p className="text-[11px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>{m.email}</p>
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
                  className="inline-flex items-center gap-1.5 rounded-full bg-navy/10 px-3 py-1 text-[12px] text-navy"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  {m.first_name} {m.last_name}
                  <button type="button" onClick={() => removeMember(m.id)}>
                    <X size={12} className="text-navy-light/50 hover:text-coral" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {value.mode === 'group' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...value, groupEntity: 'event', groupId: '', count: 0, label: '' })}
              className={cn(
                'flex items-center gap-2 rounded-xl border p-3 text-[12px] transition-all',
                value.groupEntity === 'event'
                  ? 'bg-navy/10 border-navy/30 text-navy font-medium'
                  : 'text-navy-light/60 hover:text-navy'
              )}
              style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
            >
              <BookOpen size={14} />
              Evento
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...value, groupEntity: 'study_group', groupId: '', count: 0, label: '' })}
              className={cn(
                'flex items-center gap-2 rounded-xl border p-3 text-[12px] transition-all',
                value.groupEntity === 'study_group'
                  ? 'bg-navy/10 border-navy/30 text-navy font-medium'
                  : 'text-navy-light/60 hover:text-navy'
              )}
              style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
            >
              <UsersRound size={14} />
              Grupo de estudio
            </button>
          </div>

          {value.groupEntity === 'event' && (
            <select
              className="w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30"
              style={{ fontFamily: 'var(--font-body)' }}
              value={value.groupId}
              onChange={e => setGroupEvent(e.target.value)}
            >
              <option value="">Seleccionar evento...</option>
              {upcomingEvents.map(e => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.registrations.length} inscritos)
                </option>
              ))}
            </select>
          )}

          {value.groupEntity === 'study_group' && (
            <select
              className="w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30"
              style={{ fontFamily: 'var(--font-body)' }}
              value={value.groupId}
              onChange={e => setGroupStudy(e.target.value)}
            >
              <option value="">Seleccionar grupo...</option>
              {activeGroups.map((g: StudyGroup) => (
                <option key={g.id} value={g.id}>
                  {g.leader_name ?? 'Sin dirigente'} — {g.zone} ({g.participants.filter(p => p.status === 'enrolled').length} participantes)
                </option>
              ))}
            </select>
          )}

          {value.label && (
            <div className="rounded-xl px-3 py-2" style={{ background: 'var(--surface-low)' }}>
              <p className="text-[12px] text-navy" style={{ fontFamily: 'var(--font-body)' }}>{value.label}</p>
              <p className="text-[11px] text-teal-deep font-semibold mt-0.5" style={{ fontFamily: 'var(--font-display)' }}>
                {value.count} destinatario{value.count !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
