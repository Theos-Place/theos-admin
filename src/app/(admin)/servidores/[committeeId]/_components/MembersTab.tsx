'use client'

import Link from 'next/link'
import { Plus, Search, MoreVertical, ExternalLink } from 'lucide-react'
import type { CommitteeServer } from '@/types/server'
import { cn } from '@/lib/utils'
import { SortableHeader } from '@/components/shared/SortableHeader'
import { type SortDirection } from '@/hooks/useSortableTable'

type StatusFilter = 'active' | 'inactive' | 'all'

function calcularAntiguedad(startDate: string): string {
  const inicio = new Date(startDate)
  const hoy = new Date()
  const meses =
    (hoy.getFullYear() - inicio.getFullYear()) * 12 +
    (hoy.getMonth() - inicio.getMonth())
  if (meses < 12) return `${meses} meses`
  const años = Math.floor(meses / 12)
  const mesesRest = meses % 12
  return mesesRest > 0
    ? `${años} año${años > 1 ? 's' : ''} y ${mesesRest} meses`
    : `${años} año${años > 1 ? 's' : ''}`
}

type Props = {
  sortedMembers: CommitteeServer[]
  memberSortKey: string | null
  memberSortDir: SortDirection
  toggleMemberSort: (key: string) => void
  search: string
  onSearchChange: (value: string) => void
  statusFilter: StatusFilter
  onStatusFilterChange: (value: StatusFilter) => void
  openMenu: string | null
  onMenuToggle: (memberId: string) => void
  onChangePosition: (member: CommitteeServer) => void
  onDisconnect: (member: CommitteeServer) => void
  onAddServerClick: () => void
  toolbarExtra?: React.ReactNode
}

export function MembersTab({
  sortedMembers,
  memberSortKey,
  memberSortDir,
  toggleMemberSort,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  openMenu,
  onMenuToggle,
  onChangePosition,
  onDisconnect,
  onAddServerClick,
  toolbarExtra,
}: Props) {
  return (
    <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-light/40" />
          <input
            className="w-full rounded-xl bg-surface-low pl-8 pr-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30"
            style={{ fontFamily: 'var(--font-body)' }}
            placeholder="Buscar por nombre..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
        <div className="flex rounded-full p-1 gap-0.5" style={{ background: 'var(--surface-low)' }}>
          {([['active', 'Activos'], ['inactive', 'Inactivos'], ['all', 'Todos']] as [StatusFilter, string][]).map(([v, l]) => (
            <button
              key={v}
              onClick={() => onStatusFilterChange(v)}
              className={cn(
                'rounded-full px-3 py-1.5 text-[12px] transition-all duration-150',
                statusFilter === v ? 'bg-navy text-white' : 'text-navy-light/60 hover:text-navy'
              )}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {l}
            </button>
          ))}
        </div>
        {toolbarExtra}
        <button
          className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-[12px] text-white hover:bg-coral-deep transition-colors"
          style={{ fontFamily: 'var(--font-body)' }}
          onClick={onAddServerClick}
        >
          <Plus size={13} />
          Añadir servidor
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden" style={{ borderRadius: 12, border: '1px solid rgba(22,20,64,0.09)' }}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--outline-variant)' }}>
                <SortableHeader label="Servidor"   sortKey="name"       currentSortKey={memberSortKey} currentSortDir={memberSortDir} onSort={toggleMemberSort} />
                <SortableHeader label="Puesto"     sortKey="position"   currentSortKey={memberSortKey} currentSortDir={memberSortDir} onSort={toggleMemberSort} />
                <SortableHeader label="Inicio"     sortKey="start_date" currentSortKey={memberSortKey} currentSortDir={memberSortDir} onSort={toggleMemberSort} />
                <SortableHeader label="Antigüedad" sortKey="seniority"  currentSortKey={memberSortKey} currentSortDir={memberSortDir} onSort={toggleMemberSort} />
                <SortableHeader label="Estado"     sortKey="status"     currentSortKey={memberSortKey} currentSortDir={memberSortDir} onSort={toggleMemberSort} />
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {sortedMembers.map((m, idx) => (
                <tr
                  key={m.member_id}
                  className={cn('transition-colors', idx % 2 === 1 ? 'bg-surface-low/40' : '')}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-navy flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                          {m.initials}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                        {m.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-navy-light/70 max-w-[180px]" style={{ fontFamily: 'var(--font-body)' }}>
                    {m.position}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-navy-light/60 whitespace-nowrap" style={{ fontFamily: 'var(--font-body)' }}>
                    {new Date(m.start_date).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-navy-light/60 whitespace-nowrap" style={{ fontFamily: 'var(--font-body)' }}>
                    {calcularAntiguedad(m.start_date)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        m.status === 'active'
                          ? 'bg-teal-deep/10 text-teal-deep'
                          : 'bg-navy-light/10 text-navy-light/50'
                      )}
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {m.status === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <button
                        onClick={() => onMenuToggle(m.member_id)}
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-navy-light/40 hover:text-navy hover:bg-surface-low transition-colors"
                      >
                        <MoreVertical size={14} />
                      </button>
                      {openMenu === m.member_id && (
                        <div
                          className="absolute right-0 top-8 z-20 w-44 rounded-xl overflow-hidden shadow-lg"
                          style={{ background: 'var(--surface-card)', border: '1px solid var(--outline-variant)' }}
                        >
                          <Link
                            href={`/miembros/${m.member_id}`}
                            onClick={() => onMenuToggle(m.member_id)}
                            className="flex items-center gap-2 px-3 py-2.5 text-[13px] text-navy hover:bg-surface-low transition-colors"
                            style={{ fontFamily: 'var(--font-body)' }}
                          >
                            <ExternalLink size={13} />
                            Ver perfil
                          </Link>
                          <button
                            onClick={() => {
                              onChangePosition(m)
                              onMenuToggle(m.member_id)
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] text-navy hover:bg-surface-low transition-colors"
                            style={{ fontFamily: 'var(--font-body)' }}
                          >
                            Cambiar puesto
                          </button>
                          <button
                            onClick={() => {
                              onDisconnect(m)
                              onMenuToggle(m.member_id)
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] text-coral hover:bg-coral/5 transition-colors"
                            style={{ fontFamily: 'var(--font-body)' }}
                          >
                            Desvincular
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sortedMembers.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
              No hay servidores con ese filtro.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
