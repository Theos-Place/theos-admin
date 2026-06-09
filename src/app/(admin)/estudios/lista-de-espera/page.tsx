'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { StudyGroup } from '@/data/mock-studies'
import { useStudies } from '@/hooks/useStudies'
import { sedeLabel, useSedes } from '@/lib/sedes'
import { GroupStatusBadge } from '@/components/studies/GroupStatusBadge'
import { cn } from '@/lib/utils'
import { X, Users, Plus } from 'lucide-react'

type TabType = 'N1' | 'campaign'

function InviteModal({
  selectedIds,
  tabType,
  onClose,
  groups,
}: {
  selectedIds: string[]
  tabType: TabType
  onClose: () => void
  groups: StudyGroup[]
}) {
  const [selectedGroup, setSelectedGroup] = useState('')
  const [done, setDone] = useState(false)
  const compatibleGroups = groups.filter(g =>
    g.status === 'open' || g.status === 'pending_opening'
  )

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-navy-ink/50 backdrop-blur-sm" onClick={onClose} />
        <div
          className="relative rounded-2xl p-6 max-w-sm w-full mx-4 text-center space-y-3 bg-surface-card shadow-[var(--shadow-lg)]"
        >
          <p className="text-lg font-bold text-navy font-display">
            Invitaciones enviadas
          </p>
          <p className="text-sm text-navy-light/60 font-body">
            Se notificó a {selectedIds.length} persona{selectedIds.length > 1 ? 's' : ''} sobre el grupo disponible.
          </p>
          <button onClick={onClose} className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-navy-ink/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4 bg-surface-card shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-navy font-display">
            Invitar a inscribirse
          </h3>
          <button onClick={onClose} className="text-navy-light/50 hover:text-navy transition-colors">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-navy-light/60 font-body">
          Invitar a <strong className="text-navy">{selectedIds.length}</strong> persona{selectedIds.length > 1 ? 's' : ''} a un grupo disponible:
        </p>
        <div className="space-y-2 max-h-52 overflow-y-auto">
          {compatibleGroups.map(g => (
            <button
              key={g.id}
              onClick={() => setSelectedGroup(g.id)}
              className={cn(
                'w-full text-left rounded-xl px-3 py-2.5 border transition-all',
                selectedGroup === g.id ? 'border-coral bg-coral/5' : 'hover:bg-surface-low'
              )}
              style={{ borderColor: selectedGroup === g.id ? undefined : 'var(--outline-variant)' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-navy font-medium font-body">
                    {g.study_type_id} — {sedeLabel(g.zone)}
                  </p>
                  <p className="text-[11px] text-navy-light/50">
                    {g.schedule_days.join('/')} {g.schedule_time} · Cap: {g.max_capacity}
                  </p>
                </div>
                <GroupStatusBadge status={g.status} />
              </div>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            disabled={!selectedGroup}
            onClick={() => setDone(true)}
            className="flex-1 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40"
          >
            Enviar invitaciones
          </button>
          <button onClick={onClose} className="rounded-xl border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)]">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ListaEsperaPage() {
  const { groups, waitlist } = useStudies()
  const { activeSedes: ACTIVE_SEDES, historicalSedes: HISTORICAL_SEDES } = useSedes()
  const [activeTab, setActiveTab] = useState<TabType>('N1')
  const [selectedZone, setSelectedZone] = useState('')
  const [ageFrom, setAgeFrom] = useState('')
  const [ageTo, setAgeTo] = useState('')
  const [selectedHorario, setSelectedHorario] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showInvite, setShowInvite] = useState(false)

  const allEntries = waitlist.filter(w => w.type === activeTab)

  const filtered = useMemo(() => {
    return allEntries.filter(w => {
      if (selectedZone && w.zone_preference !== selectedZone) return false
      if (ageFrom && w.age < Number(ageFrom)) return false
      if (ageTo && w.age > Number(ageTo)) return false
      if (selectedHorario && !w.horario_preference.toLowerCase().includes(selectedHorario.toLowerCase())) return false
      return true
    })
  }, [allEntries, selectedZone, ageFrom, ageTo, selectedHorario])

  // Zone breakdown
  const zoneBreakdown = allEntries.reduce<Record<string, number>>((acc, w) => {
    acc[w.zone_preference] = (acc[w.zone_preference] ?? 0) + 1
    return acc
  }, {})
  const topZones = Object.entries(zoneBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  function toggleSelect(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function toggleAll() {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filtered.map(w => w.id))
    }
  }

  const inputCls = 'rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'

  return (
    <div className="space-y-5">
      {showInvite && (
        <InviteModal
          selectedIds={selectedIds}
          tabType={activeTab}
          groups={groups}
          onClose={() => { setShowInvite(false); setSelectedIds([]) }}
        />
      )}

      {/* Header */}
      <div>
        <h1
          className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]"
        >
          Lista de espera
        </h1>
        <p className="mt-1 text-sm text-navy-light/60 font-body">
          {waitlist.length} personas en total esperando inscripción
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--outline-variant)]">
        {(['N1', 'campaign'] as TabType[]).map(t => (
          <button
            key={t}
            onClick={() => { setActiveTab(t); setSelectedIds([]) }}
            className={cn(
              'px-4 py-2.5 text-sm transition-all border-b-2 -mb-px',
              activeTab === t
                ? 'border-coral text-coral font-medium'
                : 'border-transparent text-navy-light/60 hover:text-navy',
              'font-body',
            )}
          >
            {t === 'N1' ? `Nivel 1 (${waitlist.filter(w => w.type === 'N1').length})` : `Campañas (${waitlist.filter(w => w.type === 'campaign').length})`}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-navy-light/40 font-display">Zona</p>
          <select className={inputCls} value={selectedZone} onChange={e => setSelectedZone(e.target.value)}>
            <option value="">Todas</option>
            <optgroup label="── Sedes activas ──">
              {ACTIVE_SEDES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </optgroup>
            <optgroup label="── Sedes históricas ──">
              {HISTORICAL_SEDES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </optgroup>
          </select>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-navy-light/40 font-display">Edad desde</p>
          <input type="number" className={cn(inputCls, 'w-20')} placeholder="18" value={ageFrom} onChange={e => setAgeFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-navy-light/40 font-display">Hasta</p>
          <input type="number" className={cn(inputCls, 'w-20')} placeholder="40" value={ageTo} onChange={e => setAgeTo(e.target.value)} />
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-navy-light/40 font-display">Horario</p>
          <input className={inputCls} placeholder="Miércoles..." value={selectedHorario} onChange={e => setSelectedHorario(e.target.value)} />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm text-navy-light/60 font-body">
          <strong className="text-navy">{filtered.length}</strong> en espera
        </span>
        <div className="flex gap-2">
          {topZones.map(([zone, count]) => (
            <span
              key={zone}
              className="rounded-md bg-surface-low px-2 py-0.5 text-[11px] text-navy-light/60 font-body"
            >
              {sedeLabel(zone)}: {count}
            </span>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  className="accent-coral"
                  checked={selectedIds.length === filtered.length && filtered.length > 0}
                  onChange={toggleAll}
                />
              </th>
              {['Nombre', 'Edad', 'Zona', 'Horario pref.', 'Fecha de solicitud'].map(h => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-[10px] tracking-widest uppercase text-navy-light/50 font-display"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(entry => (
              <tr
                key={entry.id}
                className={cn(
                  'hover:bg-surface-low transition-colors',
                  selectedIds.includes(entry.id) ? 'bg-coral/5' : '',
                  'border-b border-[var(--outline-variant)]',
                )}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    className="accent-coral"
                    checked={selectedIds.includes(entry.id)}
                    onChange={() => toggleSelect(entry.id)}
                  />
                </td>
                <td className="px-4 py-3 text-sm text-navy font-body">
                  {entry.member_name}
                </td>
                <td className="px-4 py-3 text-sm text-navy-light/70 font-body">
                  {entry.age}
                </td>
                <td className="px-4 py-3 text-sm text-navy-light/70 font-body">
                  {sedeLabel(entry.zone_preference)}
                </td>
                <td className="px-4 py-3 text-sm text-navy-light/70 font-body">
                  {entry.horario_preference}
                </td>
                <td className="px-4 py-3 text-[12px] text-navy-light/50 font-body">
                  {entry.requested_at}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-navy-light/40 font-body">Sin registros.</p>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-2xl px-5 py-3 z-40 bg-[var(--navy)] shadow-[var(--shadow-lg)]"
        >
          <span className="text-sm text-white/70 font-body">
            {selectedIds.length} seleccionado{selectedIds.length > 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors"
          >
            <Users size={14} /> Invitar a inscribirse
          </button>
          <Link
            href="/estudios/grupos/nuevo"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 transition-colors"
          >
            <Plus size={14} /> Crear grupo con seleccionados
          </Link>
          <button
            onClick={() => setSelectedIds([])}
            className="text-white/50 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
