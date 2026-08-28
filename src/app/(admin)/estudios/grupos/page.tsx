'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type { GroupStatus, StudyGroup, StudyType } from '@/types/study'
import { useStudyPlans } from '@/hooks/useStudyPlans'
import { useAuth } from '@/hooks/useAuth'
import { GROUP_ADMIN_ROLES } from '@/lib/auth/roles'
import { groupZoneFilterOptions, zoneFilterParam } from '@/lib/studies/group-zone-filter'
import { usePaginatedList } from '@/hooks/usePaginatedList'
import type { DbGroupListItem } from '@/lib/supabase/queries/studies'
import { toDomainStudyGroup } from '@/lib/studies/adapter'
import { sedeLabel, useSedes } from '@/lib/sedes'
import { StudyTypeBadge } from '@/components/studies/StudyTypeBadge'
import { GroupStatusBadge, NoLeaderBadge, LeaderTrainingBadge, VirtualGroupBadge } from '@/components/studies/GroupStatusBadge'
import { ColumnSelector, type ColumnDef } from '@/components/shared/ColumnSelector'
import { ExportButton } from '@/components/shared/ExportButton'
import { SortableHeader } from '@/components/shared/SortableHeader'
import { LoadMoreFooter } from '@/components/shared/LoadMoreFooter'
import { useSortableTable } from '@/hooks/useSortableTable'
import { useRowSelection } from '@/hooks/useRowSelection'
import { useToast } from '@/components/shared/Toast'
import { cn, claveAlfabetica } from '@/lib/utils'
import { Plus, BookOpen } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { getInitials } from '@/lib/format'

const PAGE_SIZE = 25

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
  // studyTypes: catálogo liviano (34 filas), NO trae los ~1.680 grupos.
  const toast = useToast()
  const { studyTypes: STUDY_TYPES, error: typesError } = useStudyPlans()
  const { zoneSedes: ZONE_SEDES, sedes: ALL_SEDES } = useSedes()
  const { user: actor } = useAuth()
  const canManageGroups = (actor?.roles ?? []).some(r => (GROUP_ADMIN_ROLES as string[]).includes(r))
  const STUDY_GROUP_COLUMNS = useMemo(() => buildStudyGroupColumns(STUDY_TYPES), [STUDY_TYPES])
  // Por defecto solo los grupos abiertos/activos; los finalizados se ven con el filtro.
  const [selectedStatuses, setSelectedStatuses] = useState<GroupStatus[]>(['en_matricula', 'en_curso'])
  const [selectedType, setSelectedType] = useState('')
  const [selectedZone, setSelectedZone] = useState('')
  // Zonas que de verdad aparecen en los grupos: sin esto el filtro ofrecía las 29
  // sedes históricas (solo 2 con grupos) y NO ofrecía "Todas las zonas", que es la
  // de la enorme mayoría.
  const [zonesInGroups, setZonesInGroups] = useState<string[]>([])
  const [hasGroupsWithoutZone, setHasGroupsWithoutZone] = useState(false)
  useEffect(() => {
    let alive = true
    fetch('/api/studies/groups?facet=zones')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!alive || !d) return
        setZonesInGroups(Array.isArray(d.zones) ? d.zones : [])
        setHasGroupsWithoutZone(!!d.hasGroupsWithoutZone)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])
  const [selectedDay, setSelectedDay] = useState('')
  // Bloques de capacitación con grupos (facet), para buscar grupos por bloque.
  const [selectedBloque, setSelectedBloque] = useState('')
  const [bloqueOptions, setBloqueOptions] = useState<Array<{ id: string; nombre: string }>>([])
  useEffect(() => {
    let alive = true
    fetch('/api/studies/groups?facet=bloques')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d && Array.isArray(d.bloques)) setBloqueOptions(d.bloques) })
      .catch(() => {})
    return () => { alive = false }
  }, [])
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  // Filtros activables por deep-link desde las alertas del dashboard:
  //  ?filter=without_leader (o ?sin_dirigente=1) → sin dirigente
  //  ?filter=closing_soon → prontos a cerrar (ends_at en los próximos 30 días)
  const [noLeaderOnly, setNoLeaderOnly] = useState(false)
  const [startFrom, setStartFrom] = useState('')
  const [startTo, setStartTo] = useState('')
  const [closingSoonOnly, setClosingSoonOnly] = useState(false)

  // Debounce de 300ms para no re-filtrar la tabla en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Deep-link de las alertas del dashboard. Para que el conteo del filtro coincida
  // EXACTO con el de la alerta, al entrar por estos links se limpia el filtro de
  // estado explícito (closing_soon ya excluye 'finalizado' del lado del servidor).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const f = p.get('filter')
    if (f === 'without_leader' || p.get('sin_dirigente') === '1') {
      setNoLeaderOnly(true)
      setSelectedStatuses([])
    }
    if (f === 'closing_soon') {
      setClosingSoonOnly(true)
      setSelectedStatuses([])
    }
  }, [])
  const [visibleColumns, setVisibleColumns] = useState<ColumnDef<StudyGroup>[]>(
    STUDY_GROUP_COLUMNS.filter(c => c.defaultVisible)
  )

  function toggleStatus(s: GroupStatus) {
    setSelectedStatuses(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    )
  }

  // Mismas zonas que al crear un grupo (is_zone), más las sedes/zonas legadas
  // que de verdad aparecen en grupos (para que sigan siendo filtrables).
  const zoneOptions = useMemo(
    () => groupZoneFilterOptions({
      activeSedes: ZONE_SEDES,
      historicalSedes: ALL_SEDES.filter(s => !s.is_zone),
      zonesInGroups, hasGroupsWithoutZone,
    }),
    [ZONE_SEDES, ALL_SEDES, zonesInGroups, hasGroupsWithoutZone],
  )

  // Filtros → query string. Viajan al servidor; nada se filtra en memoria.
  const filterQS = useCallback(() => {
    const u = new URLSearchParams()
    selectedStatuses.forEach(s => u.append('status', s))
    if (selectedType) u.set('plan', selectedType)
    // "Todas las zonas" (zone IS NULL) viaja como zone_null, no como zone.
    const zoneParam = zoneFilterParam(selectedZone)
    if (zoneParam.zone) u.set('zone', zoneParam.zone)
    if (zoneParam.zoneNull) u.set('zone_null', '1')
    if (selectedDay)  u.set('day', selectedDay)
    if (selectedBloque) u.set('bloque', selectedBloque)
    if (search.trim()) u.set('search', search.trim())
    if (noLeaderOnly) u.set('no_leader', '1')
    if (closingSoonOnly) u.set('closing_soon', '1')
    if (startFrom) u.set('start_from', startFrom)
    if (startTo) u.set('start_to', startTo)
    return u
  }, [selectedStatuses, selectedType, selectedZone, selectedDay, selectedBloque, search, noLeaderOnly, closingSoonOnly, startFrom, startTo])

  const buildUrl = (page: number) => {
    const u = filterQS()
    u.set('page', String(page))
    u.set('pageSize', String(PAGE_SIZE))
    return `/api/studies/groups?${u.toString()}`
  }

  // Paginación server-side acumulativa (count exacto + cargar más). Resetea sola
  // al cambiar cualquier filtro/búsqueda (cambia la URL base).
  const {
    items: groups, total, loading, error: groupsError, hasMore, loadMore, reload,
  } = usePaginatedList<DbGroupListItem, StudyGroup>(buildUrl, {
    pageSize: PAGE_SIZE,
    itemsKey: 'groups',
    mapItem: toDomainStudyGroup,
  })
  const error = typesError || groupsError

  const tiposPorNombre = useMemo(
    () => [...STUDY_TYPES].sort((a, b) => claveAlfabetica(a.name).localeCompare(claveAlfabetica(b.name), 'es')),
    [STUDY_TYPES],
  )

  // El sort reordena solo las filas ya cargadas (in-page). El orden base lo da
  // el servidor (fecha de fin desc).
  const { sorted: sortedGroups, sortKey, sortDir, toggleSort } = useSortableTable(groups)

  /** Selección para exportar. El universo son las filas CARGADAS: "seleccionar
   *  todo" marca las que están a la vista, no las 150 del filtro. Por eso el
   *  menú de exportar dice cuántas van — sin ese número, marcar el encabezado y
   *  bajar 25 de 150 sería una sorpresa desagradable. */
  const sel = useRowSelection(sortedGroups.map(g => g.id))

  // Export: trae el set COMPLETO filtrado vía endpoint dedicado (?all=1), no
  // depende de lo cargado en pantalla.
  const fetchAllForExport = useCallback(async (): Promise<StudyGroup[]> => {
    // Con grupos marcados se exportan SOLO esos, y no hace falta ir al servidor:
    // ya están cargados.
    if (sel.count > 0) return sortedGroups.filter(g => sel.isSelected(g.id))
    const res = await fetch(`/api/studies/groups?all=1&${filterQS().toString()}`)
    if (!res.ok) throw new Error('Error exportando grupos')
    const rows = (await res.json()) as DbGroupListItem[]
    return rows.map(toDomainStudyGroup)
  }, [filterQS, sel, sortedGroups])

  /** Export "grupos y participantes": una fila por persona, con el grupo
   *  repetido, su rol y el costo del plan. Se arma en el servidor porque
   *  necesita nombres, correos y el costo — datos que la tabla no carga. */
  const exportarParticipantes = useCallback(async () => {
    const qs = sel.count > 0
      ? new URLSearchParams({ ids: sel.selectedIds.join(',') })
      : filterQS()
    const res = await fetch(`/api/studies/groups/participantes?${qs.toString()}`)
    if (!res.ok) { toast('No se pudo generar el export de participantes.', 'error'); return }
    const { filas } = await res.json() as { filas: Array<Record<string, unknown>> }
    if (!filas.length) { toast('No hay participantes que exportar con esos filtros.', 'error'); return }
    const COLS: Array<[string, string]> = [
      ['grupo', 'Grupo'], ['codigo', 'Código'], ['estudio', 'Estudio'],
      ['costo', 'Costo'], ['moneda', 'Moneda'],
      ['estado_grupo', 'Estado del grupo'], ['inicio', 'Inicio'], ['fin', 'Fin'],
      ['persona', 'Persona'], ['rol', 'Rol'], ['estado_inscripcion', 'Estado'],
      ['correo', 'Correo'], ['telefono', 'Teléfono'], ['cedula', 'Cédula'],
    ]
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([
      COLS.map(([, label]) => label),
      // El costo va como NÚMERO, no como texto: si no, en Excel no se puede
      // sumar ni hacer tabla dinámica, que es medio motivo del export.
      ...filas.map(f => COLS.map(([k]) => (k === 'costo' ? Number(f[k] ?? 0) : String(f[k] ?? '')))),
    ])
    ws['!cols'] = COLS.map(([, l]) => ({ wch: Math.max(l.length, 16) }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Participantes')
    XLSX.writeFile(wb, `grupos-participantes-${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast(`${filas.length} participantes exportados.`, 'success')
  }, [sel, filterQS, toast])

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
          <p className="mt-1 text-sm text-navy-light/80 font-body">
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
            data={sortedGroups}
            fetchData={fetchAllForExport}
            columns={visibleColumns}
            allColumns={STUDY_GROUP_COLUMNS}
            filename="grupos-estudio-theos"
            extraExports={!canManageGroups ? [] : [{
              id: 'participantes',
              label: 'Grupos con sus participantes',
              hint: sel.count > 0
                ? `Solo los ${sel.count} grupos marcados · una fila por persona`
                : 'Una fila por persona, con rol y costo',
              run: exportarParticipantes,
            }]}
          />
          {canManageGroups && (
            <Link
              href="/estudios/grupos/nuevo"
              className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors font-body"
            >
              <Plus size={14} />
              Nuevo grupo
            </Link>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl p-4 bg-surface-card shadow-[var(--shadow-md)]">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Búsqueda */}
          <div className="space-y-1.5">
            <p className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
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
              className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display"
            >
              Estado
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-[13px] font-medium border transition-all',
                    selectedStatuses.includes(s)
                      ? 'bg-navy text-white border-navy'
                      : 'text-navy-light hover:bg-surface-low',
                    'border-[var(--outline-variant)] font-display',
                  )}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
              {noLeaderOnly && (
                <button
                  onClick={() => setNoLeaderOnly(false)}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[13px] font-medium border border-coral/30 bg-coral/10 text-coral-deep transition-all font-display"
                  aria-label="Quitar filtro sin dirigente"
                >
                  Sin dirigente ✕
                </button>
              )}
              {closingSoonOnly && (
                <button
                  onClick={() => setClosingSoonOnly(false)}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[13px] font-medium border border-coral/30 bg-coral/10 text-coral-deep transition-all font-display"
                  aria-label="Quitar filtro prontos a cerrar"
                >
                  Prontos a cerrar (30 días) ✕
                </button>
              )}
            </div>
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <p className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
              Tipo de estudio
            </p>
            <select
              className={cn(inputCls, 'font-body')}
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
            >
              <option value="">Todos</option>
              {/* Ordenado por NOMBRE, no por código. El catálogo viene por
                  código y la lista se leía desordenada: "AED — Administrando el
                  Dinero, APO — Apocalipsis, ASF — Amor sin Fronteras" está
                  alfabético por la izquierda, pero quien busca lee la derecha y
                  ve Apocalipsis antes que Amor sin Fronteras. */}
              {tiposPorNombre.map(s => (
                <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
              ))}
            </select>
          </div>

          {/* Zone */}
          <div className="space-y-1.5">
            <p className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
              Zona
            </p>
            <select
              className={cn(inputCls, 'font-body')}
              value={selectedZone}
              onChange={e => setSelectedZone(e.target.value)}
            >
              <option value="">Todas</option>
              {zoneOptions.filter(o => !o.historical).map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
              {zoneOptions.some(o => o.historical) && (
                <optgroup label="── Otras zonas/sedes (con grupos) ──">
                  {zoneOptions.filter(o => o.historical).map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Bloque de capacitación (solo si hay grupos asociados a bloques) */}
          {bloqueOptions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
                Bloque
              </p>
              <select
                className={cn(inputCls, 'font-body')}
                aria-label="Filtrar por bloque de capacitación"
                value={selectedBloque}
                onChange={e => setSelectedBloque(e.target.value)}
              >
                <option value="">Todos</option>
                {bloqueOptions.map(b => (
                  <option key={b.id} value={b.id}>{b.nombre}</option>
                ))}
              </select>
            </div>
          )}

          {/* Rango de fecha de inicio */}
          <div className="space-y-1.5">
            <p className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
              Inicio entre
            </p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                className={cn(inputCls, 'font-body')}
                aria-label="Fecha de inicio desde"
                value={startFrom}
                max={startTo || undefined}
                onChange={e => setStartFrom(e.target.value)}
              />
              <span className="text-[13px] text-navy-light/80">y</span>
              <input
                type="date"
                className={cn(inputCls, 'font-body')}
                aria-label="Fecha de inicio hasta"
                value={startTo}
                min={startFrom || undefined}
                onChange={e => setStartTo(e.target.value)}
              />
            </div>
          </div>

          {/* Day */}
          <div className="space-y-1.5">
            <p className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
              Día
            </p>
            <div className="flex gap-1">
              {DAYS.map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedDay(selectedDay === d ? '' : d)}
                  className={cn(
                    'h-8 w-8 rounded-lg text-[13px] font-medium border transition-all',
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
        className="flex items-center gap-1 text-[13px] text-navy-light/80 px-1 font-body"
      >
        <span><strong className="text-navy">{total.toLocaleString('es-CR')}</strong> grupos con estos filtros</span>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {canManageGroups && <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    aria-label={sel.allSelected ? 'Quitar la selección de todos' : 'Seleccionar todos los grupos cargados'}
                    checked={sel.allSelected}
                    ref={el => { if (el) el.indeterminate = sel.someSelected }}
                    onChange={sel.toggleAll}
                    className="cursor-pointer"
                  />
                </th>}
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
                    className={cn('hover:bg-surface-low transition-colors border-b border-[var(--outline-variant)]', sel.isSelected(group.id) && 'bg-coral/[0.04]')}
                  >
                    {canManageGroups && <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar ${group.name}`}
                        checked={sel.isSelected(group.id)}
                        onChange={() => sel.toggle(group.id)}
                        className="cursor-pointer"
                      />
                    </td>}
                    {visibleColumns.map(col => {
                      switch (String(col.key)) {
                        case 'study_type_id':
                          return <td key="study_type_id" className="px-4 py-3"><StudyTypeBadge code={group.study_type_id} size="sm" /></td>
                        case 'study_stage':
                          return <td key="study_stage" className="px-4 py-3 text-[13px] text-navy-light/80 font-body">{studyType?.stage ?? '—'}</td>
                        case 'leader_name':
                          return (
                            <td key="leader_name" className="px-4 py-3">
                              {group.leader_name ? (
                                <div className="flex items-center gap-2">
                                  <div className="h-7 w-7 rounded-full bg-navy/10 flex items-center justify-center text-[11px] font-bold text-navy shrink-0">{getInitials(group.leader_name)}</div>
                                  <span className="text-sm text-navy font-body">{group.leader_name}</span>
                                </div>
                              ) : <span className="text-[13px] text-amber-600">Sin asignar</span>}
                            </td>
                          )
                        case 'zone':
                          return <td key="zone" className="px-4 py-3 text-sm text-navy-light/80 font-body">{sedeLabel(group.zone)}</td>
                        case 'schedule':
                          return <td key="schedule" className="px-4 py-3 text-[13px] text-navy-light/80 font-body">{group.schedule_days.join('/')} {group.schedule_time}</td>
                        case 'participants_count':
                          return <td key="participants_count" className="px-4 py-3 text-sm text-navy font-body">{enrolled}/{group.max_capacity}</td>
                        case 'max_capacity':
                          return <td key="max_capacity" className="px-4 py-3 text-sm text-navy font-body">{group.max_capacity}</td>
                        case 'status':
                          return (
                            <td key="status" className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5 flex-wrap">
                                <GroupStatusBadge status={group.status} />
                                {group.is_leader_training && <LeaderTrainingBadge modality={group.training_modality} />}
                                {group.is_virtual && <VirtualGroupBadge />}
                                {!group.leader_id && group.status !== 'finalizado' && <NoLeaderBadge />}
                              </span>
                            </td>
                          )
                        case 'start_date':
                          return <td key="start_date" className="px-4 py-3 text-[13px] text-navy-light/80 font-body">{group.start_date ? new Date(group.start_date).toLocaleDateString('es-CR') : '—'}</td>
                        case 'end_date':
                          return <td key="end_date" className="px-4 py-3 text-[13px] text-navy-light/80 font-body">{group.end_date ? new Date(group.end_date).toLocaleDateString('es-CR') : '—'}</td>
                        default: {
                          const rawVal = (group as Record<string, unknown>)[String(col.key)]
                          return <td key={String(col.key)} className="px-4 py-3 text-sm text-navy-light/80 max-w-[160px] truncate font-body">{rawVal != null ? String(rawVal) : '—'}</td>
                        }
                      }
                    })}
                    <td className="px-4 py-3">
                      <Link
                        href={`/estudios/grupos/${group.id}`}
                        className="rounded-lg px-2.5 py-1 text-[13px] text-navy-light border hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
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
                      {group.is_leader_training && <LeaderTrainingBadge modality={group.training_modality} />}
                      {group.is_virtual && <VirtualGroupBadge />}
                      {!group.leader_id && group.status !== 'finalizado' && <NoLeaderBadge />}
                    </div>
                    <p className="text-sm text-navy font-body truncate">
                      {group.leader_name ?? <span className="text-amber-600">Sin dirigente</span>}
                    </p>
                    <p className="text-[13px] text-navy-light/80 font-body truncate">
                      {sedeLabel(group.zone)} · {group.schedule_days.join('/')} {group.schedule_time} · {enrolled}/{group.max_capacity}
                    </p>
                  </div>
                  <span className="shrink-0 text-[13px] text-navy-light/80 font-body">{studyType?.stage ?? ''}</span>
                </Link>
              </li>
            )
          })}
        </ul>

        {groups.length === 0 && (
          error
            ? <ErrorState message={error} onRetry={reload} />
            : loading
              ? <div className="px-4 py-10 text-center text-sm text-navy-light/80 font-body">Cargando grupos…</div>
              : <EmptyState icon={BookOpen} title="No se encontraron grupos con esos filtros" />
        )}

        {groups.length > 0 && (
          <LoadMoreFooter
            shown={groups.length}
            total={total}
            hasMore={hasMore}
            loading={loading}
            onLoadMore={loadMore}
            noun="grupos"
            increment={PAGE_SIZE}
          />
        )}
      </div>
    </div>
  )
}
