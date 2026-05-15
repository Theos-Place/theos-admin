'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { useMemberFilters, type QuickFilter } from '@/hooks/useMemberFilters'
import { AdvancedFilters } from '@/components/members/AdvancedFilters'
import { type Member } from '@/data/mock-members'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 5

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
  return AVATAR_COLORS[parseInt(id) % AVATAR_COLORS.length]
}

const QUICK_CHIPS: { key: QuickFilter; label: string }[] = [
  { key: 'todos',      label: 'Todos' },
  { key: 'activos',    label: 'Activos' },
  { key: 'donadores',  label: 'Donadores' },
  { key: 'servidores', label: 'Servidores' },
]

export default function MiembrosPage() {
  const router = useRouter()
  const filters = useMemberFilters()
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const totalPages  = Math.max(1, Math.ceil(filters.filteredMembers.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated   = filters.filteredMembers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

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
          <button
            className="flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            <Download size={15} strokeWidth={1.75} />
            Exportar
          </button>
          <button
            className="flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            <MessageCircle size={15} strokeWidth={1.75} />
            Comunicar
          </button>
          <button
            className="flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white transition-all hover:bg-coral-deep active:scale-95"
            style={{ boxShadow: 'var(--shadow-pulse)', fontFamily: 'var(--font-body)' }}
          >
            <UserPlus size={15} strokeWidth={1.75} />
            Nuevo miembro
          </button>
        </div>
      </div>

      {/* ── Quick chips + Search ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          {QUICK_CHIPS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { filters.setQuickFilter(key); setPage(1) }}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-sm transition-all duration-150',
                filters.quickFilter === key
                  ? 'bg-navy text-white'
                  : 'bg-surface-low text-navy-light/70 hover:bg-surface-card hover:text-navy'
              )}
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {label}
            </button>
          ))}

          {/* Advanced toggle */}
          <button
            onClick={() => filters.setAdvancedOpen(o => !o)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-all duration-150',
              filters.advancedOpen || filters.activeFilterCount > 0
                ? 'bg-navy text-white'
                : 'bg-surface-low text-navy-light/70 hover:bg-surface-card hover:text-navy'
            )}
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <SlidersHorizontal size={13} strokeWidth={1.75} />
            Filtros
            {filters.activeFilterCount > 0 && (
              <span className="rounded-full bg-coral px-1.5 py-0.5 text-[10px] leading-none text-white">
                {filters.activeFilterCount}
              </span>
            )}
            <span className="text-[10px] opacity-60">{filters.advancedOpen ? '↑' : '↓'}</span>
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 rounded-xl bg-surface-low px-3 py-2 w-full sm:w-64 focus-within:ring-1 focus-within:ring-coral/30 transition-all">
          <Search size={15} className="text-navy-light/40 shrink-0" strokeWidth={1.75} />
          <input
            type="search"
            value={filters.search}
            onChange={e => { filters.setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar por nombre, email…"
            className="flex-1 bg-transparent text-sm text-navy placeholder-navy-light/40 outline-none"
            style={{ fontFamily: 'var(--font-body)' }}
          />
        </div>
      </div>

      {/* ── Active filter chips ── */}
      {filters.activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {filters.activeChips.map(chip => (
            <span
              key={chip.id}
              className="flex items-center gap-1.5 rounded-full bg-navy/8 px-3 py-1 text-xs text-navy-light"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {chip.label}
              <button
                onClick={chip.onRemove}
                className="text-navy-light/50 hover:text-coral transition-colors"
                aria-label={`Quitar filtro ${chip.label}`}
              >
                <X size={11} strokeWidth={2} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ── Advanced filters panel ── */}
      <AdvancedFilters {...filters} />

      {/* ── Summary bar ── */}
      {filters.activeFilterCount > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
            <span className="font-medium text-navy" style={{ fontWeight: 500 }}>
              {filters.activeFilterCount} {filters.activeFilterCount === 1 ? 'filtro activo' : 'filtros activos'}
            </span>
            {' · '}
            {filters.filteredMembers.length.toLocaleString('es')} resultados
          </p>
          <button
            onClick={filters.clearAll}
            className="text-sm text-coral hover:underline transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
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
                {['Miembro', 'Cédula', 'Estado', 'Rol', 'Sede', ''].map(col => (
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
                    colSpan={7}
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
                    className="group transition-colors hover:bg-surface-low"
                    style={i < paginated.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
                  >
                    <td className="px-4 py-3.5">
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
                      {member.cedula}
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-3.5">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs',
                          member.status === 'active'
                            ? 'bg-teal-soft/50 text-teal-deep'
                            : 'bg-surface-low text-navy-light/50'
                        )}
                        style={{ fontFamily: 'var(--font-body)' }}
                      >
                        <span className={cn(
                          'mr-1.5 h-1.5 w-1.5 rounded-full',
                          member.status === 'active' ? 'bg-teal-deep' : 'bg-navy-light/30'
                        )} />
                        {member.status === 'active' ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>

                    {/* Rol */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {member.is_donor && (
                          <span
                            className="rounded-full bg-coral-soft/20 px-2.5 py-0.5 text-xs text-coral"
                            style={{ fontFamily: 'var(--font-body)' }}
                          >
                            Donador
                          </span>
                        )}
                        {member.is_server && (
                          <span
                            className="rounded-full bg-teal-soft/30 px-2.5 py-0.5 text-xs text-teal-deep"
                            style={{ fontFamily: 'var(--font-body)' }}
                          >
                            Servidor
                          </span>
                        )}
                        {!member.is_donor && !member.is_server && (
                          <span className="text-xs text-navy-light/30" style={{ fontFamily: 'var(--font-body)' }}>—</span>
                        )}
                      </div>
                    </td>

                    {/* Sede */}
                    <td
                      className="px-4 py-3.5 text-sm text-navy-light/70 whitespace-nowrap"
                      style={{ fontFamily: 'var(--font-body)' }}
                    >
                      {member.sede}
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
            {filters.filteredMembers.length === 0
              ? 'Sin resultados'
              : `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filters.filteredMembers.length)} de ${filters.filteredMembers.length}`}
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
