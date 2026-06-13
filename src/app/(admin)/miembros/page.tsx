'use client'

import { useState, useMemo, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { useUrlFilter, useUrlFlag } from '@/hooks/useUrlFilter'
import {
  MessageCircle,
  UserPlus,
  Search,
  ArrowRight,
  SlidersHorizontal,
  X,
  Bookmark,
  Check,
  Users,
} from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { Modal } from '@/components/shared/Modal'
import { useMemberFilters } from '@/hooks/useMemberFilters'
import { useMembers } from '@/hooks/useMembers'
import { toDomainMember } from '@/lib/members/adapter'
import type { MemberCounts } from '@/lib/supabase/queries/members'
import type { FilterCondition } from '@/types/filters'
import { AdvancedFilters } from '@/components/members/AdvancedFilters'
import { QueryBar } from '@/components/members/QueryBar'
import { type Member } from '@/types/member'
import { ColumnSelector, type ColumnDef } from '@/components/shared/ColumnSelector'
import { TOAST_LONG_MS } from '@/lib/constants'
import { ExportButton } from '@/components/shared/ExportButton'
import { SortableHeader } from '@/components/shared/SortableHeader'
import { useSortableTable } from '@/hooks/useSortableTable'
import { cn } from '@/lib/utils'
import { initialsFromParts } from '@/lib/format'

function calcularEdad(fechaNacimiento: string): number {
  const hoy = new Date()
  const nac = new Date(fechaNacimiento)
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad
}

function initials(m: Member) {
  return initialsFromParts(m.first_name, m.last_name)
}

const AVATAR_COLORS = [
  'bg-navy text-white',
  'bg-coral text-white',
  'bg-teal-deep text-white',
  'bg-navy-light text-white',
]
function avatarColor(id: string) {
  const n = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return AVATAR_COLORS[n % AVATAR_COLORS.length]
}

// Estilos de badge por rol. Los 12 roles vienen de member_roles.role en Supabase.
const ROLE_BADGE: Record<string, string> = {
  admin:                  'bg-coral-soft/20 text-coral',
  direccion:              'bg-coral-soft/20 text-coral',
  finanzas:               'bg-navy/10 text-navy',
  encargado_staff:        'bg-navy/10 text-navy',
  coordinador_estudios:   'bg-navy/10 text-navy',
  coordinador_dirigentes: 'bg-navy/10 text-navy',
  lider_comite:           'bg-navy/10 text-navy',
  comunicaciones:         'bg-teal-soft/30 text-teal-deep',
  dirigente:              'bg-navy/10 text-navy',
  editor_perfiles:        'bg-teal-soft/30 text-teal-deep',
  miembro:                'bg-surface-low text-navy-light/60',
  solo_lectura:           'bg-surface-low text-navy-light/60',
}
const ROLE_LABEL: Record<string, string> = {
  admin:                  'Admin',
  direccion:              'Dirección',
  finanzas:               'Finanzas',
  encargado_staff:        'Encargado de Staff',
  coordinador_estudios:   'Coord. Estudios',
  coordinador_dirigentes: 'Coord. Dirigentes',
  lider_comite:           'Líder Comité',
  comunicaciones:         'Comunicaciones',
  dirigente:              'Dirigente',
  editor_perfiles:        'Editor Perfiles',
  miembro:                'Miembro',
  solo_lectura:           'Sólo Lectura',
}

const QUICK_CHIPS = [
  { key: 'todos',      label: 'Todos' },
  { key: 'donadores',  label: 'Donadores' },
  { key: 'servidores', label: 'Servidores' },
  { key: 'activo',     label: 'Activo (asistencia)' },
] as const

const GENDER_LABELS: Record<string, string> = {
  M: 'Masculino', F: 'Femenino', otro: 'No indica',
}

const MEMBER_COLUMNS: ColumnDef<Member>[] = [
  {
    key: 'name', label: 'Nombre', defaultVisible: true, alwaysVisible: true,
    exportValue: m => `${m.first_name} ${m.last_name}`,
  },
  {
    key: 'cedula', label: 'Cédula', defaultVisible: true,
    exportValue: m => m.cedula ?? 'Sin cédula',
  },
  {
    key: 'age', label: 'Edad', defaultVisible: true,
    exportValue: m => m.birth_date ? String(calcularEdad(m.birth_date)) : '',
  },
  {
    key: 'email', label: 'Correo', defaultVisible: false,
  },
  {
    key: 'phone', label: 'Teléfono', defaultVisible: false,
  },
  {
    key: 'status', label: 'Estado', defaultVisible: false,
    exportValue: m => m.is_active ? 'Activo' : 'Inactivo',
  },
  {
    key: 'is_donor', label: 'Donador', defaultVisible: false,
    exportValue: m => m.is_donor ? 'Sí' : 'No',
  },
  {
    key: 'current_study', label: 'Nivel actual', defaultVisible: false,
    exportValue: m => m.current_study ?? '',
  },
  {
    key: 'completed_studies', label: 'Estudios completados', defaultVisible: false,
    exportValue: m => m.completed_studies?.join(', ') ?? '',
  },
  {
    key: 'service_position', label: 'Puesto de servicio', defaultVisible: false, exportable: true,
    render: m => {
      const active = m.service_history?.find(s => s.status === 'activo' && s.to === null)
      return active
        ? <span className="font-body text-[13px]">{active.position}</span>
        : <span className="text-navy-light/60 text-[12px]">—</span>
    },
    exportValue: m => m.service_history?.find(s => s.status === 'activo' && s.to === null)?.position ?? '',
  },
  {
    key: 'service_committee', label: 'Comité', defaultVisible: false, exportable: true,
    render: m => {
      const active = m.service_history?.find(s => s.status === 'activo' && s.to === null)
      return active
        ? <span className="font-body text-[13px]">{active.committee}</span>
        : <span className="text-navy-light/60 text-[12px]">—</span>
    },
    exportValue: m => m.service_history?.find(s => s.status === 'activo' && s.to === null)?.committee ?? '',
  },
  {
    key: 'service_area', label: 'Área de servicio', defaultVisible: false, exportable: true,
    render: m => {
      const active = m.service_history?.find(s => s.status === 'activo' && s.to === null)
      return active
        ? <span className="font-body text-[13px]">{active.area}</span>
        : <span className="text-navy-light/60 text-[12px]">—</span>
    },
    exportValue: m => m.service_history?.find(s => s.status === 'activo' && s.to === null)?.area ?? '',
  },
  {
    key: 'sede', label: 'Sede principal', defaultVisible: false,
  },
  {
    key: 'join_date', label: 'Fecha de ingreso', defaultVisible: false,
    exportValue: m => m.join_date ? new Date(m.join_date).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '',
  },
  {
    key: 'gender', label: 'Género', defaultVisible: false,
    exportValue: m => (m.gender ? GENDER_LABELS[m.gender] : '') ?? '',
  },
  {
    key: 'occupation', label: 'Ocupación', defaultVisible: false,
  },
]

function buildSegmentLabel(conditions: FilterCondition[], showDonors: boolean, showServers: boolean): string {
  const parts: string[] = []
  if (showDonors)  parts.push('Donadores')
  if (showServers) parts.push('Servidores')
  for (const c of conditions) {
    switch (c.type) {
      case 'study':
        parts.push(`${c.study} ${c.status === 'completed' ? 'completado' : 'en progreso'}`)
        break
      case 'attendance':
        parts.push(`Asistentes a ${c.eventType}`)
        break
      case 'service':
        parts.push(c.committee ? `Comité ${c.committee}` : c.area ? `Área ${c.area}` : 'Servicio')
        break
      case 'donor':
        parts.push(c.value === 'yes' ? 'Donadores' : 'No donadores')
        break
      case 'status':
        parts.push(c.value === 'active' ? 'Activos' : 'Inactivos')
        break
      default:
        parts.push(c.type)
    }
  }
  return parts.length === 0 ? 'Todos los miembros' : parts.join(' · ')
}

function MiembrosContent() {
  const router = useRouter()
  const { can } = usePermissions()
  // Conteos para chips/header — una sola vez al cargar, independiente de la búsqueda.
  const [counts, setCounts] = useState<MemberCounts | null>(null)
  const [countsFailed, setCountsFailed] = useState(false)
  useEffect(() => {
    fetch('/api/members/counts')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setCounts(d); else setCountsFailed(true) })
      .catch(() => setCountsFailed(true))
  }, [])

  // Filtros en la URL: sobreviven recargas y se pueden compartir por link.
  const [showDonors,  setShowDonors]  = useUrlFlag('donadores')
  const [showServers, setShowServers] = useUrlFlag('servidores')
  const [showActive,  setShowActive]  = useUrlFlag('activos')
  const [urlQ, setUrlQ] = useUrlFilter('q')
  const [search,         setSearch]         = useState(urlQ)
  const [debouncedSearch, setDebouncedSearch] = useState(urlQ)
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setUrlQ(search.trim()) }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])
  const [filtersOpen,    setFiltersOpen]    = useState(false)
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set())
  const [visibleColumns, setVisibleColumns] = useState<ColumnDef<Member>[]>(
    MEMBER_COLUMNS.filter(c => c.defaultVisible)
  )

  // Los filtros avanzados también viajan al servidor (junto con búsqueda y chips,
  // combinados en AND): el filtrado client-side sobre campos del mock daba 0
  // con miembros reales de Supabase.
  const filters = useMemberFilters([])
  const searchActive = debouncedSearch.trim().length >= 2
  const shouldFetch  = searchActive || showDonors || showServers || showActive || filters.conditions.length > 0
  const conditionsKey = JSON.stringify(filters.conditions)
  const searchParams = useMemo(() => ({
    search: searchActive ? debouncedSearch.trim() : undefined,
    is_donor: showDonors || undefined,
    is_server: showServers || undefined,
    active_attendance: showActive || undefined,
    conditions: filters.conditions.length ? filters.conditions : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [searchActive, debouncedSearch, showDonors, showServers, showActive, conditionsKey])

  const { members: loadedMembers, total: resultTotal, loading, error, hasMore, loadMore } = useMembers(searchParams, shouldFetch)

  // Guardar lista modal
  const [saveListOpen,    setSaveListOpen]    = useState(false)
  const [saveListName,    setSaveListName]    = useState('')
  const [saveListDesc,    setSaveListDesc]    = useState('')
  const [saveListTags,    setSaveListTags]    = useState('')
  const [saveListDynamic, setSaveListDynamic] = useState(true)
  const [savingList,      setSavingList]      = useState(false)
  const [toast,           setToast]           = useState('')

  // Querystring con los filtros activos (búsqueda + chips) para acciones sobre todo el filtro.
  function filterQS(): string {
    const u = new URLSearchParams({ is_active: 'true' })
    if (searchActive) u.set('search', debouncedSearch.trim())
    if (showDonors)  u.set('is_donor', 'true')
    if (showServers) u.set('is_server', 'true')
    if (showActive)  u.set('active_attendance', 'true')
    if (filters.conditions.length) u.set('conditions', JSON.stringify(filters.conditions))
    return u.toString()
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), TOAST_LONG_MS)
  }

  const hasAnyFilter = filters.conditions.length > 0 || showDonors || showServers || showActive || searchActive
  const quickActiveCount = (showDonors ? 1 : 0) + (showServers ? 1 : 0) + (showActive ? 1 : 0)

  async function handleComunicarLista() {
    // Todos los ids que cumplen el filtro (no solo la página cargada).
    let ids = displayMembers.map(m => m.id)
    if (hasAnyFilter && resultTotal > ids.length) {
      try {
        const res = await fetch(`/api/members/ids?${filterQS()}`)
        if (res.ok) { const d = await res.json(); ids = d.ids ?? ids }
      } catch { /* fallback a lo cargado */ }
    }
    const label = encodeURIComponent(buildSegmentLabel(filters.conditions, showDonors, showServers))
    router.push(`/comunicaciones/nueva?mode=manual&members=${ids.join(',')}&segment_label=${label}`)
  }

  function handleComunicarSeleccion() {
    const ids = allFilteredSelected
      ? displayMembers.map(m => m.id).join(',')
      : Array.from(selectedIds).join(',')
    router.push(`/comunicaciones/nueva?mode=manual&members=${ids}`)
  }

  async function handleSaveList() {
    if (!saveListName.trim() || savingList) return
    setSavingList(true)
    try {
      // Trae TODOS los ids que coinciden con el filtro (no solo los cargados en pantalla).
      let ids: string[] = displayMembers.map(m => m.id)
      let total = ids.length
      try {
        const res = await fetch(`/api/members/ids?${filterQS()}`)
        if (res.ok) { const d = await res.json(); ids = d.ids ?? ids; total = d.total ?? ids.length }
      } catch { /* fallback a lo cargado */ }

      const tags = saveListTags.split(',').map(t => t.trim()).filter(Boolean)
      const segLabel = buildSegmentLabel(filters.conditions, showDonors, showServers)
      await fetch('/api/member-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveListName.trim(),
          description: saveListDesc.trim() || null,
          filters: { conditions: filters.conditions, groups: filters.groups },
          segment_label: segLabel,
          member_ids: ids,
          member_count: total,
          is_dynamic: saveListDynamic,
          tags,
        }),
      })
      setSaveListOpen(false)
      setSaveListName('')
      setSaveListDesc('')
      setSaveListTags('')
      setSaveListDynamic(true)
      showToast('saved')
    } finally {
      setSavingList(false)
    }
  }

  // Todo el filtrado (búsqueda, chips y condiciones avanzadas) es server-side.
  const displayMembers = loadedMembers

  // Limpiar selección cuando cambia el set mostrado
  useEffect(() => {
    setSelectedIds(new Set())
  }, [displayMembers])

  const { sorted: sortedMembers, sortKey, sortDir, toggleSort } = useSortableTable(displayMembers)

  const visibleMembers       = sortedMembers
  const allVisibleSelected   = visibleMembers.length > 0 && visibleMembers.every(m => selectedIds.has(m.id))
  const allFilteredSelected  = selectedIds.size > 0 && selectedIds.size === displayMembers.length
  const selectedData         = allFilteredSelected
    ? displayMembers
    : displayMembers.filter(m => selectedIds.has(m.id))

  const activeFilterCount = filters.conditions.length

  // Export: descarga la totalidad que coincide con búsqueda/chips (no solo lo cargado).
  async function fetchAllForExport(): Promise<Member[]> {
    const u = new URLSearchParams({ is_active: 'true' })
    if (searchActive) u.set('search', debouncedSearch.trim())
    if (showDonors)  u.set('is_donor', 'true')
    if (showServers) u.set('is_server', 'true')
    if (showActive)  u.set('active_attendance', 'true')
    if (filters.conditions.length) u.set('conditions', JSON.stringify(filters.conditions))
    const res = await fetch(`/api/members/export?${u.toString()}`)
    if (!res.ok) throw new Error('Error exportando')
    const d = await res.json()
    return (d.members ?? []).map(toDomainMember) as Member[]
  }
  const exportConfirm = (!searchActive && !showDonors && !showServers && !showActive)
    ? `Vas a exportar ${(counts?.total ?? 0).toLocaleString('es-CR')} miembros. Esto puede tardar unos segundos. ¿Continuás?`
    : undefined

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1
            className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]"
          >
            Miembros
          </h1>
          <p className="mt-1 text-sm text-navy-light/60 font-body">
            {counts ? `${counts.total.toLocaleString('es-CR')} registrados` : countsFailed ? '— registrados' : 'Cargando…'}
            {error && <span className="text-coral"> · {error}</span>}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {can('miembros', 'export') && (
            <>
              <ColumnSelector<Member>
                columns={MEMBER_COLUMNS}
                storageKey="theos_columns_members"
                onChange={setVisibleColumns}
              />
              <ExportButton<Member>
                data={displayMembers}
                columns={visibleColumns}
                allColumns={MEMBER_COLUMNS}
                filename="miembros-theos"
                fetchData={fetchAllForExport}
                confirmMessage={exportConfirm}
                label={hasAnyFilter && resultTotal > 0 ? `Exportar ${resultTotal.toLocaleString('es-CR')}` : undefined}
              />
              <button
                onClick={() => hasAnyFilter ? setSaveListOpen(true) : undefined}
                disabled={!hasAnyFilter}
                title={!hasAnyFilter ? 'Aplicá filtros primero para guardar una lista' : ''}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--outline-variant)] px-3.5 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-body"
              >
                <Bookmark size={13} strokeWidth={1.75} />
                Guardar lista
              </button>
            </>
          )}
          {can('comunicaciones', 'create') && (
            <button
              onClick={handleComunicarLista}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--outline-variant)] px-3.5 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
            >
              <MessageCircle size={15} strokeWidth={1.75} />
              Comunicar{hasAnyFilter && resultTotal > 0 ? ` (${resultTotal.toLocaleString('es-CR')})` : ''}
            </button>
          )}
          {can('miembros', 'create') && (
            <button
              onClick={() => router.push('/miembros/nuevo')}
              className="flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white transition-all hover:bg-coral-deep active:scale-95 shadow-[var(--shadow-pulse)] font-body"
            >
              <UserPlus size={15} strokeWidth={1.75} />
              Nuevo miembro
            </button>
          )}
        </div>
      </div>

      {/* ── Quick chips + Search ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          {QUICK_CHIPS.map(({ key, label }) => {
            const active =
              key === 'todos'      ? (!showDonors && !showServers && !showActive) :
              key === 'donadores'  ? showDonors :
              key === 'servidores' ? showServers :
              showActive
            const count =
              key === 'todos'      ? counts?.total :
              key === 'donadores'  ? counts?.donadores :
              key === 'servidores' ? counts?.servidores :
              counts?.activos_asistencia
            const labelWithCount = count !== undefined ? `${label} · ${count.toLocaleString('es-CR')}` : label
            return (
              <button
                key={key}
                onClick={() => {
                  if (key === 'todos') { setShowDonors(false); setShowServers(false); setShowActive(false) }
                  else if (key === 'donadores') setShowDonors(!showDonors)
                  else if (key === 'servidores') setShowServers(!showServers)
                  else setShowActive(!showActive)
                }}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-sm transition-all duration-150 font-body',
                  active
                    ? 'bg-navy text-white'
                    : 'bg-surface-low text-navy-light/70 hover:bg-surface-card hover:text-navy'
                )}
              >
                {labelWithCount}
              </button>
            )
          })}

          {/* Advanced filters toggle */}
          <button
            onClick={() => setFiltersOpen(o => !o)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-all duration-150 font-body',
              filtersOpen || activeFilterCount > 0
                ? 'bg-navy text-white'
                : 'bg-surface-low text-navy-light/70 hover:bg-surface-card hover:text-navy'
            )}
          >
            <SlidersHorizontal size={13} strokeWidth={1.75} />
            Filtros
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-coral px-1.5 py-0.5 text-[10px] leading-none text-white">
                {activeFilterCount}
              </span>
            )}
            <span className="text-[10px] opacity-60">{filtersOpen ? '↑' : '↓'}</span>
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 rounded-xl bg-surface-low px-3 py-2 w-full sm:w-64 focus-within:ring-1 focus-within:ring-coral/30 transition-all">
          <Search size={15} className="text-navy-light/60 shrink-0" strokeWidth={1.75} />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email…"
            aria-label="Buscar por nombre, email"
            className="flex-1 bg-transparent text-sm text-navy placeholder-navy-light/50 outline-none font-body"
          />
        </div>
      </div>

      {/* ── Conteo de filtros activos · total real del servidor ── */}
      {quickActiveCount > 0 && (
        <p className="text-sm text-navy-light/60 font-body">
          <span className="font-medium text-navy">
            {quickActiveCount} {quickActiveCount === 1 ? 'filtro activo' : 'filtros activos'}
          </span>
          {' · '}
          {resultTotal > displayMembers.length
            ? `${displayMembers.length.toLocaleString('es-CR')} de ${resultTotal.toLocaleString('es-CR')} resultados`
            : `${resultTotal.toLocaleString('es-CR')} resultados`}
        </p>
      )}

      {/* ── Advanced filters panel ── */}
      {filtersOpen && (
        <AdvancedFilters
          conditions={filters.conditions}
          addCondition={filters.addCondition}
          removeCondition={filters.removeCondition}
        />
      )}

      {/* ── Query bar (pills) ── */}
      {filters.conditions.length > 0 && (
        <QueryBar
          conditions={filters.conditions}
          groups={filters.groups}
          topLevelOps={filters.topLevelOps}
          groupMode={filters.groupMode}
          picked={filters.picked}
          newGroupOp={filters.newGroupOp}
          removeCondition={filters.removeCondition}
          removeConditionsByGroup={filters.removeConditionsByGroup}
          removeGroup={filters.removeGroup}
          toggleGroupMode={filters.toggleGroupMode}
          togglePick={filters.togglePick}
          setNewGroupOp={filters.setNewGroupOp}
          confirmGroup={filters.confirmGroup}
          cancelGroup={filters.cancelGroup}
          toggleOperator={filters.toggleOperator}
          toggleGroupOp={filters.toggleGroupOp}
        />
      )}

      {/* ── Summary bar ── */}
      {activeFilterCount > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-navy-light/60 font-body">
            <span className="font-medium text-navy">
              {activeFilterCount} {activeFilterCount === 1 ? 'filtro activo' : 'filtros activos'}
            </span>
            {' · '}
            {resultTotal > displayMembers.length
              ? `${displayMembers.length.toLocaleString('es-CR')} de ${resultTotal.toLocaleString('es-CR')} resultados`
              : `${resultTotal.toLocaleString('es-CR')} resultados`}
          </p>
          <button
            onClick={() => filters.clearAll()}
            className="flex items-center gap-1 text-sm text-coral hover:underline transition-colors font-body"
          >
            <X size={12} strokeWidth={2} />
            Limpiar todo
          </button>
        </div>
      )}

      {/* ── Selection banner ── */}
      {selectedIds.size > 0 && (
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-3 flex-wrap bg-[rgba(22,20,64,0.04)] border border-[rgba(22,20,64,0.12)]"
        >
          <span className="text-[13px] font-semibold text-navy font-body">
            {allFilteredSelected
              ? `${displayMembers.length.toLocaleString('es-CR')} miembros seleccionados (todos los resultados)`
              : `${selectedIds.size} miembro${selectedIds.size !== 1 ? 's' : ''} seleccionado${selectedIds.size !== 1 ? 's' : ''}`
            }
          </span>

          {!allFilteredSelected && (
            <button
              onClick={() => setSelectedIds(new Set(displayMembers.map(m => m.id)))}
              className="text-[12px] font-semibold underline transition-colors text-[var(--coral,#EF5554)] cursor-pointer font-body bg-transparent border-0"
            >
              Seleccionar los {displayMembers.length.toLocaleString('es-CR')} resultados filtrados
            </button>
          )}

          <div className="flex-1" />

          <div className="flex items-center gap-2 flex-wrap">
            <ExportButton<Member>
              data={selectedData}
              columns={visibleColumns}
              allColumns={MEMBER_COLUMNS}
              filename="miembros-seleccionados-theos"
              label={`Exportar ${(allFilteredSelected ? displayMembers.length : selectedIds.size).toLocaleString('es-CR')} miembros`}
            />
            <button
              onClick={handleComunicarSeleccion}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--outline-variant)] px-3.5 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
            >
              <MessageCircle size={14} strokeWidth={1.75} />
              Comunicar ({(allFilteredSelected ? displayMembers.length : selectedIds.size).toLocaleString('es-CR')})
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="flex items-center gap-1 rounded-xl border border-[var(--outline-variant)] px-3.5 py-2 text-sm text-navy-light/60 hover:bg-surface-low transition-colors font-body"
            >
              <X size={13} />
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Table card ── */}
      <div
        className="overflow-hidden rounded-2xl bg-surface-card shadow-[var(--shadow-md)]"
      >
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--outline-variant)]">
                <th className="w-10 px-4 py-3.5">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={el => { if (el) el.indeterminate = selectedIds.size > 0 && !allVisibleSelected }}
                    onChange={e => {
                      if (e.target.checked) setSelectedIds(new Set(visibleMembers.map(m => m.id)))
                      else setSelectedIds(new Set())
                    }}
                    className="accent-coral h-4 w-4 cursor-pointer rounded"
                  />
                </th>
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
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {!shouldFetch ? (
                <tr>
                  <td colSpan={visibleColumns.length + 2} className="px-4 py-16 text-center font-body">
                    <Search size={26} className="text-navy-light/60 mx-auto mb-3" strokeWidth={1.75} />
                    <p className="text-sm font-semibold text-navy-light/60">Usá el buscador o aplicá un filtro para ver miembros</p>
                    <p className="text-[13px] text-navy-light/60 mt-1">Escribí al menos 2 caracteres o activá un chip (Donadores, Servidores, Activo)</p>
                  </td>
                </tr>
              ) : loading && visibleMembers.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 2} className="px-4 py-16 text-center font-body">
                    <div className="h-7 w-7 mx-auto mb-3 rounded-full border-2 border-navy-light/20 border-t-coral animate-spin" />
                    <p className="text-sm text-navy-light/60">Buscando miembros…</p>
                  </td>
                </tr>
              ) : visibleMembers.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 2}>
                    <EmptyState icon={Users} title="Sin resultados para los filtros aplicados" />
                  </td>
                </tr>
              ) : (
                visibleMembers.map((member, i) => (
                  <tr
                    key={member.id}
                    onClick={() => router.push(`/miembros/${member.id}`)}
                    className="group transition-colors hover:bg-surface-low cursor-pointer"
                    style={i < visibleMembers.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
                  >
                    <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(member.id)}
                        onChange={e => {
                          const next = new Set(selectedIds)
                          if (e.target.checked) next.add(member.id)
                          else next.delete(member.id)
                          setSelectedIds(next)
                        }}
                        className="accent-coral h-4 w-4 cursor-pointer rounded"
                      />
                    </td>

                    {visibleColumns.map(col => {
                      switch (String(col.key)) {
                        case 'name':
                          return (
                            <td key="name" className="px-4 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-display font-extrabold', avatarColor(member.id))}>
                                  {initials(member)}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-navy font-body">{member.first_name} {member.last_name}</p>
                                  <p className="truncate text-xs text-navy-light/60 font-body">{member.email}</p>
                                </div>
                              </div>
                            </td>
                          )
                        case 'cedula':
                          return (
                            <td key="cedula" className="px-4 py-3.5 text-navy-light/70 tabular-nums font-mono text-[12px]">
                              {member.cedula ?? <span className="rounded-full bg-surface-low px-2 py-0.5 text-[10px] text-navy-light/60 font-sans">Sin cédula</span>}
                            </td>
                          )
                        case 'age':
                          return (
                            <td key="age" className="px-4 py-3.5 text-navy-light/70 tabular-nums whitespace-nowrap font-mono text-[12px]">
                              {member.birth_date ? `${calcularEdad(member.birth_date)} años` : '—'}
                            </td>
                          )
                        case 'status':
                          return (
                            <td key="status" className="px-4 py-3.5">
                              <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium font-body', member.is_active ? 'bg-[rgba(61,185,122,0.12)] text-[#3DB97A]' : 'bg-coral/10 text-coral')}>
                                {member.is_active ? 'Activo' : 'Inactivo'}
                              </span>
                            </td>
                          )
                        case 'is_donor':
                          return (
                            <td key="is_donor" className="px-4 py-3.5">
                              {member.is_donor
                                ? <span className="rounded-full bg-coral/10 px-2.5 py-0.5 text-xs text-coral font-body">Sí</span>
                                : <span className="text-sm text-navy-light/60 font-body">—</span>
                              }
                            </td>
                          )
                        default: {
                          if (col.render) {
                            return (
                              <td key={String(col.key)} className="px-4 py-3.5">
                                {col.render(member)}
                              </td>
                            )
                          }
                          const rawVal = (member as Record<string, unknown>)[String(col.key)]
                          // Si la columna define exportValue, usarlo también para mostrar
                          // (formatea fechas como dd/mm/aaaa en vez del ISO crudo con hora).
                          const display = col.exportValue
                            ? col.exportValue(member)
                            : Array.isArray(rawVal) ? (rawVal as string[]).join(', ') : String(rawVal ?? '')
                          return (
                            <td key={String(col.key)} className="px-4 py-3.5 text-sm text-navy-light/70 max-w-[180px] truncate font-body">
                              {display || '—'}
                            </td>
                          )
                        }
                      }
                    })}

                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => router.push(`/miembros/${member.id}`)}
                        className="rounded-lg p-1.5 text-navy-light/60 transition-all hover:bg-surface-low hover:text-coral group-hover:text-navy-light/60"
                        aria-label={`Ver perfil de ${member.first_name}`}
                      >
                        <ArrowRight size={16} strokeWidth={1.75} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Mobile: tarjetas ── */}
        <div className="md:hidden">
          {!shouldFetch ? (
            <div className="px-4 py-14 text-center font-body">
              <Search size={26} className="text-navy-light/60 mx-auto mb-3" strokeWidth={1.75} />
              <p className="text-sm font-semibold text-navy-light/60">Usá el buscador o aplicá un filtro</p>
              <p className="text-[13px] text-navy-light/60 mt-1">Escribí al menos 2 caracteres o activá un chip</p>
            </div>
          ) : loading && visibleMembers.length === 0 ? (
            <div className="px-4 py-14 text-center font-body">
              <div className="h-7 w-7 mx-auto mb-3 rounded-full border-2 border-navy-light/20 border-t-coral animate-spin" />
              <p className="text-sm text-navy-light/60">Buscando miembros…</p>
            </div>
          ) : visibleMembers.length === 0 ? (
            <EmptyState icon={Users} title="Sin resultados para los filtros aplicados" />
          ) : (
            <ul>
              {visibleMembers.map((member, i) => (
                <li
                  key={member.id}
                  onClick={() => router.push(`/miembros/${member.id}`)}
                  className="flex items-center gap-3 px-4 py-3 active:bg-surface-low cursor-pointer"
                  style={i < visibleMembers.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(member.id)}
                    onClick={e => e.stopPropagation()}
                    onChange={e => {
                      const next = new Set(selectedIds)
                      if (e.target.checked) next.add(member.id); else next.delete(member.id)
                      setSelectedIds(next)
                    }}
                    className="accent-coral h-4 w-4 shrink-0 cursor-pointer rounded"
                  />
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-display font-extrabold', avatarColor(member.id))}>
                    {initials(member)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-navy font-body">{member.first_name} {member.last_name}</p>
                    <p className="truncate text-xs text-navy-light/60 font-body">
                      {member.cedula ?? 'Sin cédula'}{member.email ? ` · ${member.email}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {member.is_donor && <span className="rounded-full bg-coral/10 px-2 py-0.5 text-[10px] text-coral font-body">Donador</span>}
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium font-body', member.is_active ? 'bg-[rgba(61,185,122,0.12)] text-[#3DB97A]' : 'bg-coral/10 text-coral')}>
                      {member.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Load more (server-side) ── */}
        {shouldFetch && visibleMembers.length > 0 && (
          <div
            className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap border-t border-[var(--outline-variant)]"
          >
            <span className="text-xs text-navy-light/60 font-body">
              Mostrando <strong className="text-navy">{visibleMembers.length.toLocaleString('es-CR')}</strong> de{' '}
              <strong className="text-navy">{resultTotal.toLocaleString('es-CR')}</strong> resultados
            </span>
            {hasMore && (
              <button
                onClick={() => loadMore()}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--outline-variant)] px-3 py-1.5 text-xs text-navy-light hover:bg-surface-low transition-colors disabled:opacity-50 font-body"
              >
                {loading ? 'Cargando…' : 'Cargar 50 más'}
              </button>
            )}
          </div>
        )}
      </div>
      {/* ── Guardar lista modal ── */}
      {saveListOpen && (
        <Modal onClose={() => setSaveListOpen(false)} titleId="guardar-lista-title" width={384}>
          <div className="p-6 space-y-4">
            <p id="guardar-lista-title" className="text-base font-bold text-navy font-display">
              Guardar lista de miembros
            </p>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widests text-navy-light/60 font-display">
                  Nombre de la lista *
                </label>
                <input
                  autoFocus
                  className="w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
                  placeholder="Ej. Donadores Heredia..."
                  value={saveListName}
                  onChange={e => setSaveListName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widests text-navy-light/60 font-display">
                  Descripción (opcional)
                </label>
                <input
                  className="w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
                  placeholder="Para qué sirve esta lista..."
                  value={saveListDesc}
                  onChange={e => setSaveListDesc(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widests text-navy-light/60 font-display">
                  Tags (separados por coma)
                </label>
                <input
                  className="w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
                  placeholder="donadores, heredia..."
                  value={saveListTags}
                  onChange={e => setSaveListTags(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] uppercase tracking-widests text-navy-light/60 font-display">
                  Tipo de lista
                </label>
                {[
                  { val: true,  label: 'Dinámica', desc: 'Se recalcula con los filtros actuales cada vez que la abrís' },
                  { val: false, label: 'Snapshot', desc: `Guarda los ${resultTotal.toLocaleString('es-CR')} miembros exactos de ahora` },
                ].map(opt => (
                  <button
                    key={String(opt.val)}
                    type="button"
                    onClick={() => setSaveListDynamic(opt.val)}
                    className={`flex items-start gap-3 w-full text-left rounded-xl border p-3 transition-all ${saveListDynamic === opt.val ? 'border-navy bg-navy/4' : 'border-outline'}`}
                  >
                    <div className={cn('mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0', saveListDynamic === opt.val ? 'border-coral bg-coral' : 'border-navy-light/30')}>
                      {saveListDynamic === opt.val && <Check size={9} className="text-white" strokeWidth={3} />}
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-navy font-body">{opt.label}</p>
                      <p className="text-[11px] text-navy-light/60 mt-0.5 font-body">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div
              className="rounded-xl px-3 py-2.5 text-[12px] text-navy-light/60 bg-surface-low font-body"
            >
              Resumen: <strong className="text-navy">{resultTotal.toLocaleString('es-CR')} miembros</strong>
              {' · '}{buildSegmentLabel(filters.conditions, showDonors, showServers)}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setSaveListOpen(false)}
                className="flex-1 rounded-xl border border-[var(--outline-variant)] py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveList}
                disabled={!saveListName.trim() || savingList}
                className="flex-1 rounded-xl bg-navy py-2.5 text-sm text-white hover:bg-navy/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-body"
              >
                {savingList ? 'Obteniendo miembros…' : 'Guardar lista'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Toast ── */}
      {toast === 'saved' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl bg-navy shadow-[0_20px_48px_rgba(22,20,64,0.30)]">
          <Check size={15} className="text-teal-deep shrink-0" strokeWidth={2.5} />
          <p className="text-[13px] text-white font-body">
            Lista guardada
          </p>
          <span className="text-white/20 mx-1">·</span>
          <button
            onClick={() => { setToast(''); router.push('/miembros/listas') }}
            className="text-[13px] text-coral hover:underline cursor-pointer font-body bg-transparent border-0"
          >
            Ver mis listas →
          </button>
        </div>
      )}
    </div>
  )
}

export default function MiembrosPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-sm text-navy-light/60 font-body">Cargando...</div>
      </div>
    }>
      <MiembrosContent />
    </Suspense>
  )
}
