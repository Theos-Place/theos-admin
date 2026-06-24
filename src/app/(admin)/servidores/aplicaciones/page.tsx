'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { type Application, type ApplicationStatus } from '@/types/server'
import { usePaginatedList } from '@/hooks/usePaginatedList'
import { LoadMoreFooter } from '@/components/shared/LoadMoreFooter'
import type { DbApplication } from '@/lib/supabase/queries/servers'
import { toDomainApplication } from '@/lib/servers/adapter'
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
  const [search, setSearch]             = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all')
  const [committeeFilter, setCommitteeFilter] = useState('all')
  const [assignedFilter, setAssignedFilter] = useState('all')

  // Coordinadores de servidores activos (candidatos para asignar).
  const [coordinators, setCoordinators] = useState<{ member_id: string; member_name: string }[]>([])
  useEffect(() => {
    let alive = true
    fetch('/api/servers/applications/assignees')
      .then(r => (r.ok ? r.json() : []))
      .then((d: Array<{ member_id: string; member_name: string }>) => { if (alive) setCoordinators(Array.isArray(d) ? d : []) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  // Comités para el dropdown (solo id + nombre).
  const [committees, setCommittees] = useState<{ id: string; name: string }[]>([])
  useEffect(() => {
    let alive = true
    fetch('/api/servers/committees')
      .then(r => (r.ok ? r.json() : []))
      .then((d: Array<{ id: string; name: string }>) => {
        if (alive) setCommittees((Array.isArray(d) ? d : []).map(c => ({ id: c.id, name: c.name })))
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])
  const MOCK_COMMITTEES = committees

  // Conteos globales para los badges (pendientes / en revisión).
  const [counts, setCounts] = useState({ pending: 0, reviewing: 0 })
  useEffect(() => {
    let alive = true
    fetch('/api/servers/applications?stats=1')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d) setCounts(d) })
      .catch(() => {})
    return () => { alive = false }
  }, [])
  const { pending, reviewing } = counts

  // Listado paginado server-side (búsqueda + estado + comité al servidor).
  const buildUrl = (page: number) => {
    const u = new URLSearchParams()
    if (debouncedSearch.trim()) u.set('search', debouncedSearch.trim())
    if (statusFilter !== 'all') u.set('status', statusFilter)
    if (committeeFilter !== 'all') u.set('committee', committeeFilter)
    if (assignedFilter !== 'all') u.set('assigned_to', assignedFilter)
    u.set('page', String(page))
    u.set('pageSize', '25')
    return `/api/servers/applications?${u.toString()}`
  }
  const {
    items: filtered, total, loading, hasMore, loadMore, reload,
  } = usePaginatedList<DbApplication, Application>(buildUrl, {
    pageSize: 25, itemsKey: 'applications', mapItem: toDomainApplication,
  })

  // Asigna / toma / quita responsable y recarga.
  async function assign(appId: string, body: Record<string, unknown>) {
    await fetch(`/api/servers/applications/${appId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    reload()
  }

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
          <p className="mt-1 text-sm text-white/70 font-body">
            {pending} pendiente{pending !== 1 ? 's' : ''} · {reviewing} en revisión
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 sm:min-w-48 w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-light/60" />
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
        <select
          className="w-full sm:w-auto rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
          value={assignedFilter}
          onChange={e => setAssignedFilter(e.target.value)}
          aria-label="Filtrar por responsable"
        >
          <option value="all">Cualquier responsable</option>
          <option value="unassigned">Sin asignar</option>
          {coordinators.map(c => (
            <option key={c.member_id} value={c.member_id}>{c.member_name}</option>
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
                {['Aplicante', 'Puesto / Comité', 'Área', 'Fecha', 'Estado', 'Responsable', ''].map(h => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[10px] tracking-widest uppercase text-navy-light/60 font-display"
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
                    <p className="text-[11px] text-navy-light/60 font-body">
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
                    <AssignCell app={a} coordinators={coordinators} onAssign={assign} />
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
                  <p className="truncate text-[12px] text-navy-light/60 font-body">
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
          loading
            ? <p className="px-4 py-8 text-center text-sm text-navy-light/60 font-body">Cargando aplicaciones…</p>
            : <EmptyState icon={ClipboardList} title="No hay aplicaciones con ese filtro" />
        )}

        {filtered.length > 0 && (
          <LoadMoreFooter
            shown={filtered.length}
            total={total}
            hasMore={hasMore}
            loading={loading}
            onLoadMore={loadMore}
            noun="aplicaciones"
            increment={25}
          />
        )}
      </div>
    </div>
  )
}

// ── Celda de responsable: asignar / tomar / quitar ───────────────────────────
function AssignCell({
  app, coordinators, onAssign,
}: {
  app: Application
  coordinators: { member_id: string; member_name: string }[]
  onAssign: (appId: string, body: Record<string, unknown>) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const act = (body: Record<string, unknown>) => { setOpen(false); onAssign(app.id, body) }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1 rounded-lg border border-[var(--outline-variant)] px-2.5 py-1 text-[11px] text-navy-light hover:bg-surface-low transition-colors font-body max-w-[160px]"
      >
        <span className="truncate">{app.assignee_name ?? 'Sin asignar'}</span>
        <span className="text-navy-light/60">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-56 rounded-2xl bg-surface-card shadow-[var(--shadow-lg)] border border-[var(--outline-variant)] overflow-hidden">
          <button
            type="button"
            onClick={() => act({ action: 'take' })}
            className="w-full px-3 py-2 text-left text-[12px] text-navy hover:bg-surface-low transition-colors font-body"
          >
            Tomar (asignármela)
          </button>
          {app.assigned_to && (
            <button
              type="button"
              onClick={() => act({ action: 'unassign' })}
              className="w-full px-3 py-2 text-left text-[12px] text-coral hover:bg-surface-low transition-colors font-body"
            >
              Quitar responsable
            </button>
          )}
          <div className="border-t border-[var(--outline-variant)] max-h-56 overflow-y-auto py-1">
            <p className="px-3 py-1 text-[10px] uppercase tracking-widest text-navy-light/60 font-display">Asignar a</p>
            {coordinators.length === 0 && (
              <p className="px-3 py-2 text-[11px] text-navy-light/60 font-body">No hay coordinadores de servidores activos.</p>
            )}
            {coordinators.map(c => (
              <button
                key={c.member_id}
                type="button"
                onClick={() => act({ action: 'assign', assignee_member_id: c.member_id })}
                className="w-full px-3 py-2 text-left text-[12px] text-navy hover:bg-surface-low transition-colors font-body"
              >
                {c.member_name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
