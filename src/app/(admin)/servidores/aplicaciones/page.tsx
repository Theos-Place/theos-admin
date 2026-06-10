'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { type ApplicationStatus } from '@/types/server'
import { useServers } from '@/hooks/useServers'
import { cn } from '@/lib/utils'
import { Search, ChevronRight, ClipboardList } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'

const APP_STATUS_COLORS: Record<ApplicationStatus, string> = {
  pending:   'bg-amber-500/10 text-amber-600',
  reviewing: 'bg-navy/10 text-navy',
  approved:  'bg-teal-deep/10 text-teal-deep',
  rejected:  'bg-coral/10 text-coral',
}

const APP_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending:   'Pendiente',
  reviewing: 'En revisión',
  approved:  'Aprobada',
  rejected:  'No seleccionada',
}

const STATUS_FILTERS: { key: ApplicationStatus | 'all'; label: string }[] = [
  { key: 'all',       label: 'Todas' },
  { key: 'pending',   label: 'Pendientes' },
  { key: 'reviewing', label: 'En revisión' },
  { key: 'approved',  label: 'Aprobadas' },
  { key: 'rejected',  label: 'No seleccionadas' },
]

export default function AplicacionesPage() {
  const { committees: MOCK_COMMITTEES, applications: MOCK_APPLICATIONS } = useServers()
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all')
  const [committeeFilter, setCommitteeFilter] = useState('all')

  const pending   = MOCK_APPLICATIONS.filter(a => a.status === 'pending').length
  const reviewing = MOCK_APPLICATIONS.filter(a => a.status === 'reviewing').length

  const filtered = useMemo(() => {
    return MOCK_APPLICATIONS.filter(a => {
      const matchSearch    = a.applicant_name.toLowerCase().includes(search.toLowerCase()) ||
                             a.vacancy_title.toLowerCase().includes(search.toLowerCase())
      const matchStatus    = statusFilter === 'all' || a.status === statusFilter
      const matchCommittee = committeeFilter === 'all' || a.committee_id === committeeFilter
      return matchSearch && matchStatus && matchCommittee
    })
  }, [search, statusFilter, committeeFilter])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className="rounded-2xl bg-navy px-6 py-5 flex items-start justify-between gap-4 shadow-[var(--shadow-md)]"
      >
        <div>
          <h1
            className="text-2xl text-white font-display font-extrabold tracking-[-0.02em]"
          >
            Aplicaciones
          </h1>
          <p className="mt-1 text-sm text-white/50 font-body">
            {pending} pendiente{pending !== 1 ? 's' : ''} · {reviewing} en revisión
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 sm:min-w-48 w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-light/40" />
          <input
            className="w-full rounded-xl bg-surface-low pl-8 pr-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
            placeholder="Buscar por nombre o puesto..."
            aria-label="Buscar por nombre o puesto"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="w-full sm:w-auto rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
          value={committeeFilter}
          onChange={e => setCommitteeFilter(e.target.value)}
        >
          <option value="all">Todos los comités</option>
          {MOCK_COMMITTEES.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Status chips */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-[12px] font-medium border transition-all duration-150 font-display',
              statusFilter === f.key
                ? 'bg-navy text-white border-navy'
                : 'text-navy-light/60 hover:text-navy hover:bg-surface-low border-transparent'
            )}
          >
            {f.label}
            {f.key === 'pending' && pending > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 text-white text-[9px] px-1.5 py-0.5 font-display">
                {pending}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]"
      >
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['Aplicante', 'Puesto / Comité', 'Área', 'Fecha', 'Estado', ''].map(h => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[10px] tracking-widests uppercase text-navy-light/50 font-display"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, idx) => (
                <tr
                  key={a.id}
                  className={cn('transition-colors', idx % 2 === 1 ? 'bg-surface-low/40' : '')}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-navy flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-white font-display">
                          {a.applicant_initials}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-navy font-body">
                        {a.applicant_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[13px] font-medium text-navy font-body">
                      {a.vacancy_title}
                    </p>
                    <p className="text-[11px] text-navy-light/50 font-body">
                      {a.committee_name}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-medium text-navy-light/60 font-display"
                    >
                      {a.area}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-navy-light/60 whitespace-nowrap font-body">
                    {new Date(a.applied_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold font-display', APP_STATUS_COLORS[a.status])}
                    >
                      {APP_STATUS_LABELS[a.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/servidores/vacantes/${a.vacancy_id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--outline-variant)] px-2.5 py-1 text-[11px] text-navy-light hover:bg-surface-low transition-colors font-body"
                    >
                      Ver puesto
                      <ChevronRight size={11} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: tarjetas */}
        <ul className="md:hidden">
          {filtered.map((a, i) => (
            <li
              key={a.id}
              style={i < filtered.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
            >
              <Link
                href={`/servidores/vacantes/${a.vacancy_id}`}
                className="flex items-center gap-3 px-4 py-3 active:bg-surface-low"
              >
                <div className="h-9 w-9 rounded-full bg-navy flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-white font-display">
                    {a.applicant_initials}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-navy font-body">{a.applicant_name}</p>
                  <p className="truncate text-[12px] text-navy-light/50 font-body">
                    {a.vacancy_title} · {a.committee_name}
                  </p>
                </div>
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold font-display', APP_STATUS_COLORS[a.status])}>
                  {APP_STATUS_LABELS[a.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {filtered.length === 0 && (
          <EmptyState icon={ClipboardList} title="No hay aplicaciones con ese filtro" />
        )}
      </div>
    </div>
  )
}
