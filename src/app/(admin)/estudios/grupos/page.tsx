'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { MOCK_GROUPS, STUDY_TYPES, type GroupStatus } from '@/data/mock-studies'
import { SEDES, sedeLabel } from '@/data/mock-sedes'
import { StudyTypeBadge } from '@/components/studies/StudyTypeBadge'
import { GroupStatusBadge } from '@/components/studies/GroupStatusBadge'
import { WeekProgressBar } from '@/components/studies/WeekProgressBar'
import { cn } from '@/lib/utils'
import { Plus, Download } from 'lucide-react'

const ALL_STATUSES: GroupStatus[] = ['pending_leader', 'pending_opening', 'open', 'in_progress', 'finished']
const STATUS_LABELS: Record<GroupStatus, string> = {
  pending_leader: 'Sin dirigente',
  pending_opening: 'Pendiente apertura',
  open: 'Abierto',
  in_progress: 'En curso',
  finished: 'Finalizado',
}
const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

export default function GruposPage() {
  const [selectedStatuses, setSelectedStatuses] = useState<GroupStatus[]>([])
  const [selectedType, setSelectedType] = useState('')
  const [selectedZone, setSelectedZone] = useState('')
  const [selectedDay, setSelectedDay] = useState('')

  function toggleStatus(s: GroupStatus) {
    setSelectedStatuses(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    )
  }

  const filtered = useMemo(() => {
    return MOCK_GROUPS.filter(g => {
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(g.status)) return false
      if (selectedType && g.study_type_id !== selectedType) return false
      if (selectedZone && g.zone !== selectedZone) return false
      if (selectedDay && !g.schedule_days.includes(selectedDay)) return false
      return true
    })
  }, [selectedStatuses, selectedType, selectedZone, selectedDay])

  const totalCapacity = filtered.reduce((sum, g) => sum + g.max_capacity, 0)
  const totalEnrolled = filtered.reduce((sum, g) =>
    sum + g.participants.filter(p => p.status !== 'withdrawn').length, 0)
  const occupancy = totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0

  const inputCls = 'rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="text-2xl text-navy"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            Grupos
          </h1>
          <p className="mt-1 text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
            Todos los grupos de estudio bíblico
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            <Download size={14} />
            Exportar CSV
          </button>
          <Link
            href="/estudios/grupos/nuevo"
            className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <Plus size={14} />
            Nuevo grupo
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <div className="flex flex-wrap gap-3 items-end">
          {/* Status */}
          <div className="space-y-1.5">
            <p
              className="text-[10px] tracking-widest uppercase text-navy-light/40"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Estado
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-[11px] font-medium border transition-all',
                    selectedStatuses.includes(s)
                      ? 'bg-navy text-white border-navy'
                      : 'text-navy-light hover:bg-surface-low'
                  )}
                  style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-display)' }}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <p className="text-[10px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
              Tipo de estudio
            </p>
            <select
              className={inputCls}
              style={{ fontFamily: 'var(--font-body)' }}
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
            >
              <option value="">Todos</option>
              {STUDY_TYPES.map(s => (
                <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
              ))}
            </select>
          </div>

          {/* Zone */}
          <div className="space-y-1.5">
            <p className="text-[10px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
              Zona
            </p>
            <select
              className={inputCls}
              style={{ fontFamily: 'var(--font-body)' }}
              value={selectedZone}
              onChange={e => setSelectedZone(e.target.value)}
            >
              <option value="">Todas</option>
              {SEDES.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Day */}
          <div className="space-y-1.5">
            <p className="text-[10px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
              Día
            </p>
            <div className="flex gap-1">
              {DAYS.map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedDay(selectedDay === d ? '' : d)}
                  className={cn(
                    'h-8 w-8 rounded-lg text-[12px] font-medium border transition-all',
                    selectedDay === d
                      ? 'bg-navy text-white border-navy'
                      : 'text-navy-light hover:bg-surface-low'
                  )}
                  style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-display)' }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div
        className="flex items-center gap-1 text-[12px] text-navy-light/60 px-1"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        <span><strong className="text-navy">{filtered.length}</strong> grupos filtrados</span>
        <span className="mx-2 text-navy-light/30">·</span>
        <span>Capacidad total: <strong className="text-navy">{totalCapacity}</strong></span>
        <span className="mx-2 text-navy-light/30">·</span>
        <span>Ocupación: <strong className="text-navy">{occupancy}%</strong></span>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['Estudio', 'Dirigente', 'Zona', 'Horario', 'Participantes', 'Estado', 'Semana', ''].map(h => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[10px] tracking-widest uppercase text-navy-light/50"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(group => {
                const studyType = STUDY_TYPES.find(s => s.id === group.study_type_id)
                const enrolled = group.participants.filter(p => p.status !== 'withdrawn').length
                return (
                  <tr
                    key={group.id}
                    className="hover:bg-surface-low transition-colors"
                    style={{ borderBottom: '1px solid var(--outline-variant)' }}
                  >
                    <td className="px-4 py-3">
                      <StudyTypeBadge code={group.study_type_id} size="sm" />
                    </td>
                    <td className="px-4 py-3">
                      {group.leader_name ? (
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-navy/10 flex items-center justify-center text-[10px] font-bold text-navy shrink-0">
                            {getInitials(group.leader_name)}
                          </div>
                          <span className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                            {group.leader_name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-amber-600">Sin asignar</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
                      {sedeLabel(group.zone)}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
                      {group.schedule_days.join('/')} {group.schedule_time}
                    </td>
                    <td className="px-4 py-3 text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                      {enrolled}/{group.max_capacity}
                    </td>
                    <td className="px-4 py-3">
                      <GroupStatusBadge status={group.status} />
                    </td>
                    <td className="px-4 py-3">
                      {studyType && group.current_week > 0 ? (
                        <WeekProgressBar
                          current={group.current_week}
                          total={studyType.weeks}
                          className="w-20"
                        />
                      ) : (
                        <span className="text-[11px] text-navy-light/30">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/estudios/grupos/${group.id}`}
                        className="rounded-lg px-2.5 py-1 text-[11px] text-navy-light border hover:bg-surface-low transition-colors"
                        style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
              No se encontraron grupos con esos filtros.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
