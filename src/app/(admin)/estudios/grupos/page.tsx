'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import type { GroupStatus, StudyGroup, StudyType } from '@/data/mock-studies'
import { useStudies } from '@/hooks/useStudies'
import { sedeLabel, useSedes } from '@/lib/sedes'
import { StudyTypeBadge } from '@/components/studies/StudyTypeBadge'
import { GroupStatusBadge, NoLeaderBadge } from '@/components/studies/GroupStatusBadge'
import { ColumnSelector, type ColumnDef } from '@/components/shared/ColumnSelector'
import { ExportButton } from '@/components/shared/ExportButton'
import { SortableHeader } from '@/components/shared/SortableHeader'
import { useSortableTable } from '@/hooks/useSortableTable'
import { cn } from '@/lib/utils'
import { Plus, BookOpen } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { getInitials } from '@/lib/format'

const ALL_STATUSES: GroupStatus[] = ['en_matricula', 'en_curso', 'finalizado']
const STATUS_LABELS: Record<GroupStatus, string> = {
  en_matricula: 'En matrícula',
  en_curso: 'En curso',
  finalizado: 'Finalizado',
}
const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

const STATUS_EXPORT: Record<GroupStatus, string> = {
  en_matricula: 'En matrícula',
  en_curso: 'En curso',
  finalizado: 'Finalizado',
}

/** Normaliza para búsqueda insensible a mayúsculas y tildes. */
function normalize(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function buildStudyGroupColumns(studyTypes: StudyType[]): ColumnDef<StudyGroup>[] {
  return [
  {
    key: 'study_type_id', label: 'Estudio', defaultVisible: true, alwaysVisible: true,
    exportValue: g => {
      const t = studyTypes.find(s => s.id === g.study_type_id)
      return t ? `${t.code} — ${t.name}` : g.study_type_id
    },
  },
  {
    key: 'study_stage', label: 'Etapa', defaultVisible: false,
    exportValue: g => {
      const t = studyTypes.find(s => s.id === g.study_type_id)
      return t?.stage ?? ''
    },
  },
  {
    key: 'leader_name', label: 'Dirigente', defaultVisible: true,
    exportValue: g => g.leader_name ?? 'Sin asignar',
  },
  {
    key: 'zone', label: 'Zona / Sede', defaultVisible: true,
    exportValue: g => sedeLabel(g.zone),
  },
  {
    key: 'schedule', label: 'Horario', defaultVisible: true,
    exportValue: g => `${g.schedule_days.join('/')} ${g.schedule_time}`,
  },
  {
    key: 'participants_count', label: 'Participantes', defaultVisible: true,
    exportValue: g => `${g.participants.filter(p => p.status !== 'withdrawn').length}/${g.max_capacity}`,
  },
  {
    key: 'max_capacity', label: 'Capacidad máxima', defaultVisible: false,
    exportValue: g => String(g.max_capacity),
  },
  {
    key: 'status', label: 'Estado', defaultVisible: true,
    exportValue: g => STATUS_EXPORT[g.status] ?? g.status,
  },
  {
    key: 'start_date', label: 'Fecha inicio', defaultVisible: true,
    exportValue: g => g.start_date ? new Date(g.start_date).toLocaleDateString('es-CR') : '—',
  },
  {
    key: 'end_date', label: 'Fecha fin', defaultVisible: false,
    exportValue: g => g.end_date ? new Date(g.end_date).toLocaleDateString('es-CR') : '',
  },
  {
    key: 'location', label: 'Ubicación', defaultVisible: false,
  },
  {
    key: 'whatsapp_group_url', label: 'Grupo WhatsApp', defaultVisible: false,
    exportValue: g => g.whatsapp_group_url ?? 'Sin crear',
  },
  ]
}

export default function GruposPage() {
  const { groups: MOCK_GROUPS, studyTypes: STUDY_TYPES, error, refetch } = useStudies()
  const { activeSedes: ACTIVE_SEDES, historicalSedes: HISTORICAL_SEDES } = useSedes()
  const STUDY_GROUP_COLUMNS = useMemo(() => buildStudyGroupColumns(STUDY_TYPES), [STUDY_TYPES])
  // Por defecto solo los grupos abiertos/activos; los finalizados se ven con el filtro.
  const [selectedStatuses, setSelectedStatuses] = useState<GroupStatus[]>(['en_matricula', 'en_curso'])
  const [selectedType, setSelectedType] = useState('')
  const [selectedZone, setSelectedZone] = useState('')
  const [selectedDay, setSelectedDay] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  // Debounce de 300ms para no re-filtrar la tabla en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])
  const [visibleColumns, setVisibleColumns] = useState<ColumnDef<StudyGroup>[]>(
    STUDY_GROUP_COLUMNS.filter(c => c.defaultVisible)
  )

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
      if (search) {
        const haystack = normalize(`${g.name} ${g.leader_name ?? ''} ${g.co_leader_name ?? ''}`)
        if (!haystack.includes(normalize(search))) return false
      }
      return true
    }).sort((a, b) => {
      // Orden por defecto: fecha de finalización más reciente primero; sin fecha al final.
      if (!a.end_date && !b.end_date) return 0
      if (!a.end_date) return 1
      if (!b.end_date) return -1
      return b.end_date.localeCompare(a.end_date)
    })
  }, [MOCK_GROUPS, selectedStatuses, selectedType, selectedZone, selectedDay, search])

  const { sorted: sortedGroups, sortKey, sortDir, toggleSort } = useSortableTable(filtered)

  const totalCapacity = filtered.reduce((sum, g) => sum + g.max_capacity, 0)
  const totalEnrolled = filtered.reduce((sum, g) =>
    sum + g.participants.filter(p => p.status !== 'withdrawn').length, 0)
  const occupancy = totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0

  const inputCls = 'rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1
            className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]"
          >
            Grupos
          </h1>
          <p className="mt-1 text-sm text-navy-light/60 font-body">
            Todos los grupos de estudio bíblico
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ColumnSelector<StudyGroup>
            columns={STUDY_GROUP_COLUMNS}
            storageKey="theos_columns_studies"
            onChange={setVisibleColumns}
          />
          <ExportButton<StudyGroup>
            data={filtered}
            columns={visibleColumns}
            allColumns={STUDY_GROUP_COLUMNS}
            filename="grupos-estudio-theos"
          />
          <Link
            href="/estudios/grupos/nuevo"
            className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors font-body"
          >
            <Plus size={14} />
            Nuevo grupo
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl p-4 bg-surface-card shadow-[var(--shadow-md)]">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Búsqueda */}
          <div className="space-y-1.5">
            <p className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display">
              Buscar
            </p>
            <input
              className={cn(inputCls, 'font-body min-w-[230px]')}
              placeholder="Buscar por grupo o dirigente..."
              aria-label="Buscar por grupo o dirigente"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <p
              className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display"
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
                      : 'text-navy-light hover:bg-surface-low',
                    'border-[var(--outline-variant)] font-display',
                  )}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <p className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display">
              Tipo de estudio
            </p>
            <select
              className={cn(inputCls, 'font-body')}
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
            <p className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display">
              Zona
            </p>
            <select
              className={cn(inputCls, 'font-body')}
              value={selectedZone}
              onChange={e => setSelectedZone(e.target.value)}
            >
              <option value="">Todas</option>
              <optgroup label="── Sedes activas ──">
                {ACTIVE_SEDES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </optgroup>
              <optgroup label="── Sedes históricas ──">
                {HISTORICAL_SEDES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </optgroup>
            </select>
          </div>

          {/* Day */}
          <div className="space-y-1.5">
            <p className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display">
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
                      : 'text-navy-light hover:bg-surface-low',
                    'border-[var(--outline-variant)] font-display',
                  )}
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
        className="flex items-center gap-1 text-[12px] text-navy-light/60 px-1 font-body"
      >
        <span><strong className="text-navy">{filtered.length}</strong> grupos filtrados</span>
        <span className="mx-2 text-navy-light/60">·</span>
        <span>Capacidad total: <strong className="text-navy">{totalCapacity}</strong></span>
        <span className="mx-2 text-navy-light/60">·</span>
        <span>Ocupación: <strong className="text-navy">{occupancy}%</strong></span>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {visibleColumns.map(col => (
                  <SortableHeader
                    key={String(col.key)}
                    label={col.label}
                    sortKey={String(col.key)}
                    currentSortKey={sortKey}
                    currentSortDir={sortDir}
                    onSort={toggleSort}
                  />
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sortedGroups.map(group => {
                const studyType = STUDY_TYPES.find(s => s.id === group.study_type_id)
                const enrolled = group.participants.filter(p => p.status !== 'withdrawn').length
                return (
                  <tr
                    key={group.id}
                    className="hover:bg-surface-low transition-colors border-b border-[var(--outline-variant)]"
                  >
                    {visibleColumns.map(col => {
                      switch (String(col.key)) {
                        case 'study_type_id':
                          return <td key="study_type_id" className="px-4 py-3"><StudyTypeBadge code={group.study_type_id} size="sm" /></td>
                        case 'study_stage':
                          return <td key="study_stage" className="px-4 py-3 text-[12px] text-navy-light/60 font-body">{studyType?.stage ?? '—'}</td>
                        case 'leader_name':
                          return (
                            <td key="leader_name" className="px-4 py-3">
                              {group.leader_name ? (
                                <div className="flex items-center gap-2">
                                  <div className="h-7 w-7 rounded-full bg-navy/10 flex items-center justify-center text-[10px] font-bold text-navy shrink-0">{getInitials(group.leader_name)}</div>
                                  <span className="text-sm text-navy font-body">{group.leader_name}</span>
                                </div>
                              ) : <span className="text-[11px] text-amber-600">Sin asignar</span>}
                            </td>
                          )
                        case 'zone':
                          return <td key="zone" className="px-4 py-3 text-sm text-navy-light/70 font-body">{sedeLabel(group.zone)}</td>
                        case 'schedule':
                          return <td key="schedule" className="px-4 py-3 text-[12px] text-navy-light/60 font-body">{group.schedule_days.join('/')} {group.schedule_time}</td>
                        case 'participants_count':
                          return <td key="participants_count" className="px-4 py-3 text-sm text-navy font-body">{enrolled}/{group.max_capacity}</td>
                        case 'max_capacity':
                          return <td key="max_capacity" className="px-4 py-3 text-sm text-navy font-body">{group.max_capacity}</td>
                        case 'status':
                          return (
                            <td key="status" className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5 flex-wrap">
                                <GroupStatusBadge status={group.status} />
                                {!group.leader_id && group.status !== 'finalizado' && <NoLeaderBadge />}
                              </span>
                            </td>
                          )
                        case 'start_date':
                          return <td key="start_date" className="px-4 py-3 text-[12px] text-navy-light/70 font-body">{group.start_date ? new Date(group.start_date).toLocaleDateString('es-CR') : '—'}</td>
                        case 'end_date':
                          return <td key="end_date" className="px-4 py-3 text-[12px] text-navy-light/70 font-body">{group.end_date ? new Date(group.end_date).toLocaleDateString('es-CR') : '—'}</td>
                        default: {
                          const rawVal = (group as Record<string, unknown>)[String(col.key)]
                          return <td key={String(col.key)} className="px-4 py-3 text-sm text-navy-light/70 max-w-[160px] truncate font-body">{rawVal != null ? String(rawVal) : '—'}</td>
                        }
                      }
                    })}
                    <td className="px-4 py-3">
                      <Link
                        href={`/estudios/grupos/${group.id}`}
                        className="rounded-lg px-2.5 py-1 text-[11px] text-navy-light border hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
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

        {/* Mobile: tarjetas */}
        <ul className="md:hidden">
          {sortedGroups.map((group, i) => {
            const studyType = STUDY_TYPES.find(s => s.id === group.study_type_id)
            const enrolled = group.participants.filter(p => p.status !== 'withdrawn').length
            return (
              <li key={group.id} style={i < sortedGroups.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}>
                <Link
                  href={`/estudios/grupos/${group.id}`}
                  className="flex items-start gap-3 px-4 py-3 active:bg-surface-low"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StudyTypeBadge code={group.study_type_id} size="sm" />
                      <GroupStatusBadge status={group.status} />
                      {!group.leader_id && group.status !== 'finalizado' && <NoLeaderBadge />}
                    </div>
                    <p className="text-sm text-navy font-body truncate">
                      {group.leader_name ?? <span className="text-amber-600">Sin dirigente</span>}
                    </p>
                    <p className="text-[12px] text-navy-light/60 font-body truncate">
                      {sedeLabel(group.zone)} · {group.schedule_days.join('/')} {group.schedule_time} · {enrolled}/{group.max_capacity}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-navy-light/60 font-body">{studyType?.stage ?? ''}</span>
                </Link>
              </li>
            )
          })}
        </ul>

        {filtered.length === 0 && (
          error
            ? <ErrorState message={error} onRetry={refetch} />
            : <EmptyState icon={BookOpen} title="No se encontraron grupos con esos filtros" />
        )}
      </div>
    </div>
  )
}
