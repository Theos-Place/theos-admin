'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import {
  Download,
  MessageCircle,
  UserPlus,
  Search,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { useMemberFilters } from '@/hooks/useMemberFilters'
import { AdvancedFilters } from '@/components/members/AdvancedFilters'
import { QueryBar } from '@/components/members/QueryBar'
import { type Member } from '@/data/mock-members'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 5

function calcularEdad(fechaNacimiento: string): number {
  const hoy = new Date()
  const nac = new Date(fechaNacimiento)
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad
}

function initials(m: Member) {
  return (m.first_name[0] + m.last_name[0]).toUpperCase()
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

const ROLE_BADGE: Record<string, string> = {
  servidor:  'bg-teal-soft/30 text-teal-deep',
  dirigente: 'bg-navy/10 text-navy',
  admin:     'bg-coral-soft/20 text-coral',
}
const ROLE_LABEL: Record<string, string> = {
  servidor:  'Servidor',
  dirigente: 'Dirigente',
  admin:     'Admin',
}

const QUICK_CHIPS = [
  { key: 'todos',      label: 'Todos' },
  { key: 'donadores',  label: 'Donadores' },
  { key: 'servidores', label: 'Servidores' },
] as const

export default function MiembrosPage() {
  const router = useRouter()
  const { can } = usePermissions()
  const filters = useMemberFilters()

  const [showDonors, setShowDonors] = useState(false)
  const [showServers, setShowServers] = useState(false)
  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const displayMembers = useMemo(() => {
    let list = filters.filteredMembers
    if (showDonors)  list = list.filter(m => m.is_donor)
    if (showServers) list = list.filter(m => m.is_server)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(m =>
        `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.phone.includes(q) ||
        (m.cedula != null && m.cedula.includes(q))
      )
    }
    return list
  }, [filters.filteredMembers, showDonors, showServers, search])

  const totalPages  = Math.max(1, Math.ceil(displayMembers.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated   = displayMembers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const allSelected = paginated.length > 0 && paginated.every(m => selected.has(m.id))

  function toggleAll() {
    setSelected(prev => {
      const next = new Set(prev)
      if (allSelected) paginated.forEach(m => next.delete(m.id))
      else paginated.forEach(m => next.add(m.id))
      return next
    })
  }
  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const activeFilterCount = filters.conditions.length

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1
            className="text-2xl text-navy"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            Miembros
          </h1>
          <p className="mt-1 text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
            23,418 registrados
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {can('miembros', 'export') && (
            <button
              className="flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
              style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
            >
              <Download size={15} strokeWidth={1.75} />
              Exportar
            </button>
          )}
          {can('comunicaciones', 'create') && (
            <button
              className="flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
              style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
            >
              <MessageCircle size={15} strokeWidth={1.75} />
              Comunicar
            </button>
          )}
          {can('miembros', 'create') && (
            <button
              onClick={() => router.push('/miembros/nuevo')}
              className="flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white transition-all hover:bg-coral-deep active:scale-95"
              style={{ boxShadow: 'var(--shadow-pulse)', fontFamily: 'var(--font-body)' }}
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
              key === 'todos'      ? (!showDonors && !showServers) :
              key === 'donadores'  ? showDonors :
              showServers
            return (
              <button
                key={key}
                onClick={() => {
                  if (key === 'todos') { setShowDonors(false); setShowServers(false) }
                  else if (key === 'donadores') setShowDonors(v => !v)
                  else setShowServers(v => !v)
                  setPage(1)
                }}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-sm transition-all duration-150',
                  active
                    ? 'bg-navy text-white'
                    : 'bg-surface-low text-navy-light/70 hover:bg-surface-card hover:text-navy'
                )}
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {label}
              </button>
            )
          })}

          {/* Advanced filters toggle */}
          <button
            onClick={() => setFiltersOpen(o => !o)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-all duration-150',
              filtersOpen || activeFilterCount > 0
                ? 'bg-navy text-white'
                : 'bg-surface-low text-navy-light/70 hover:bg-surface-card hover:text-navy'
            )}
            style={{ fontFamily: 'var(--font-body)' }}
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
          <Search size={15} className="text-navy-light/40 shrink-0" strokeWidth={1.75} />
          <input
            type="search"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar por nombre, email…"
            className="flex-1 bg-transparent text-sm text-navy placeholder-navy-light/40 outline-none"
            style={{ fontFamily: 'var(--font-body)' }}
          />
        </div>
      </div>

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
          <p className="text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
            <span className="font-medium text-navy" style={{ fontWeight: 500 }}>
              {activeFilterCount} {activeFilterCount === 1 ? 'filtro activo' : 'filtros activos'}
            </span>
            {' · '}
            {displayMembers.length.toLocaleString('es')} resultados
          </p>
          <button
            onClick={() => { filters.clearAll(); setPage(1) }}
            className="flex items-center gap-1 text-sm text-coral hover:underline transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <X size={12} strokeWidth={2} />
            Limpiar todo
          </button>
        </div>
      )}

      {/* ── Table card ── */}
      <div
        className="overflow-hidden rounded-2xl"
        style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--outline-variant)' }}>
                <th className="w-10 px-4 py-3.5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="accent-coral h-4 w-4 cursor-pointer rounded"
                  />
                </th>
                {['Miembro', 'Cédula', 'Edad', 'Rol', ''].map(col => (
                  <th
                    key={col}
                    className="px-4 py-3.5 text-left text-xs font-medium text-navy-light/50 tracking-wider uppercase whitespace-nowrap"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-sm text-navy-light/40"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    Sin resultados para los filtros aplicados
                  </td>
                </tr>
              ) : (
                paginated.map((member, i) => (
                  <tr
                    key={member.id}
                    onClick={() => router.push(`/miembros/${member.id}`)}
                    className="group transition-colors hover:bg-surface-low cursor-pointer"
                    style={i < paginated.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
                  >
                    <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(member.id)}
                        onChange={() => toggleOne(member.id)}
                        className="accent-coral h-4 w-4 cursor-pointer rounded"
                      />
                    </td>

                    {/* Miembro */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs', avatarColor(member.id))}
                          style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
                        >
                          {initials(member)}
                        </div>
                        <div className="min-w-0">
                          <p
                            className="truncate text-navy"
                            style={{ fontFamily: 'var(--font-body)', fontWeight: 400 }}
                          >
                            {member.first_name} {member.last_name}
                          </p>
                          <p className="truncate text-xs text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
                            {member.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Cédula */}
                    <td
                      className="px-4 py-3.5 text-navy-light/70 tabular-nums"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                    >
                      {member.cedula ?? (
                        <span className="rounded-full bg-surface-low px-2 py-0.5 text-[10px] text-navy-light/30 font-sans">Sin cédula</span>
                      )}
                    </td>

                    {/* Edad */}
                    <td
                      className="px-4 py-3.5 text-navy-light/70 tabular-nums whitespace-nowrap"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                    >
                      {member.birth_date ? `${calcularEdad(member.birth_date)} años` : '—'}
                    </td>

                    {/* Rol */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {member.roles.filter(r => r !== 'miembro').map(role => (
                          <span
                            key={role}
                            className={cn('rounded-full px-2.5 py-0.5 text-xs', ROLE_BADGE[role])}
                            style={{ fontFamily: 'var(--font-body)' }}
                          >
                            {ROLE_LABEL[role]}
                          </span>
                        ))}
                        {member.is_donor && (
                          <span
                            className="rounded-full bg-coral-soft/20 px-2.5 py-0.5 text-xs text-coral"
                            style={{ fontFamily: 'var(--font-body)' }}
                          >
                            Donador
                          </span>
                        )}
                        {member.roles.length === 1 && !member.is_donor && (
                          <span className="text-xs text-navy-light/30" style={{ fontFamily: 'var(--font-body)' }}>Miembro</span>
                        )}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => router.push(`/miembros/${member.id}`)}
                        className="rounded-lg p-1.5 text-navy-light/30 transition-all hover:bg-surface-low hover:text-coral group-hover:text-navy-light/60"
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

        {/* ── Pagination ── */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderTop: '1px solid var(--outline-variant)' }}
        >
          <p className="text-xs text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
            {displayMembers.length === 0
              ? 'Sin resultados'
              : `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, displayMembers.length)} de ${displayMembers.length}`}
          </p>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-lg p-1.5 text-navy-light/50 transition-colors hover:bg-surface-low disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} strokeWidth={1.75} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={cn(
                  'h-7 w-7 rounded-lg text-xs transition-all',
                  n === currentPage ? 'bg-navy text-white' : 'text-navy-light/60 hover:bg-surface-low'
                )}
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {n}
              </button>
            ))}

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-lg p-1.5 text-navy-light/50 transition-colors hover:bg-surface-low disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
