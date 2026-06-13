'use client'

/**
 * Tablero genérico de solicitudes (estudios, finanzas): tabs por tipo,
 * filtros por estado y rango de fechas, orden por fecha, acordeón agrupado
 * por año (año actual expandido), fila resumen → detalle con historial y
 * acciones Tomar / Resolver / Rechazar con notas opcionales.
 *
 * El módulo dueño aporta: requests cargadas, etiquetas, endpoint de PATCH y
 * el render de los detalles específicos del tipo.
 */
import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import {
  Inbox, Loader2, ChevronDown, ChevronUp, X, ArrowUpDown, History, Search, UserPlus,
} from 'lucide-react'
import { useToast } from '@/components/shared/Toast'
import { Modal } from '@/components/shared/Modal'
import { EmptyState } from '@/components/shared/EmptyState'
import { RequestTabs } from '@/components/shared/RequestTabs'
import { cn } from '@/lib/utils'
import { formatDate, formatDateNumeric, getInitials } from '@/lib/format'

export type RequestStatus = 'open' | 'in_review' | 'resolved' | 'rejected'

export type BaseRequest = {
  id: string
  member_id: string
  member_name: string
  request_type: string
  reason: string
  status: RequestStatus
  review_notes: string | null
  /** Quien la tiene asignada (coordinador). */
  reviewed_by?: string | null
  reviewed_by_name?: string | null
  created_at: string
  history: Array<{
    from_status: string | null
    to_status: string
    notes: string | null
    changed_by_name: string | null
    created_at: string
  }>
}

export const REQUEST_STATUS_BADGE: Record<RequestStatus, { label: string; cls: string }> = {
  open:      { label: 'Abierta',     cls: 'bg-coral/10 text-coral' },
  in_review: { label: 'En revisión', cls: 'bg-[rgba(233,185,73,0.15)] text-[#A8821F]' },
  resolved:  { label: 'Resuelta',    cls: 'bg-success/12 text-success' },
  rejected:  { label: 'Rechazada',   cls: 'bg-surface-low text-navy-light/60' },
}

// Orden: estados activos primero, "Todas" al final. Default al entrar: Abiertas.
const STATUS_FILTERS: { key: RequestStatus | 'all'; label: string }[] = [
  { key: 'open', label: 'Abiertas' },
  { key: 'in_review', label: 'En revisión' },
  { key: 'resolved', label: 'Resueltas' },
  { key: 'rejected', label: 'Rechazadas' },
  { key: 'all', label: 'Todas' },
]

function statusLabel(s: string | null): string {
  return s ? (REQUEST_STATUS_BADGE[s as RequestStatus]?.label ?? s) : '—'
}

type Props<R extends BaseRequest> = {
  requests: R[]
  loading: boolean
  tabs: { key: string; label: string }[]
  typeLabel: Record<string, string>
  /** PATCH `${endpointBase}/${id}` con { action, review_notes } */
  endpointBase: string
  onUpdated: (updated: R) => void
  /** Detalles específicos del tipo (chips de grupos/planes/pagos/etc). */
  renderDetails: (r: R) => React.ReactNode
  /** Pista al resolver (ej. link para crear la beca/devolución real). */
  renderResolveHint?: (r: R) => React.ReactNode
  /** Habilita "Asignar a un coordinador": URL que lista los asignables. */
  assigneesUrl?: string
}

export function RequestBoard<R extends BaseRequest>({
  requests, loading, tabs, typeLabel, endpointBase, onUpdated, renderDetails, renderResolveHint, assigneesUrl,
}: Props<R>) {
  const toast = useToast()
  const [tab, setTab] = useState(tabs[0]?.key ?? '')
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('open')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortDesc, setSortDesc] = useState(true)
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set([new Date().getFullYear()]))
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null)
  const [actionTarget, setActionTarget] = useState<{ req: R; action: 'resolve' | 'reject' } | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // Asignación a coordinador de dirigentes
  const [assignTarget, setAssignTarget] = useState<R | null>(null)
  const [assignees, setAssignees] = useState<Array<{ member_id: string; member_name: string }>>([])
  const [assigneeSearch, setAssigneeSearch] = useState('')
  const [assignedFilter, setAssignedFilter] = useState<'all' | 'none' | string>('all')

  useEffect(() => {
    if (!assigneesUrl) return
    let alive = true
    fetch(assigneesUrl)
      .then(r => (r.ok ? r.json() : []))
      .then(d => { if (alive && Array.isArray(d)) setAssignees(d) })
      .catch(() => {})
    return () => { alive = false }
  }, [assigneesUrl])

  const visible = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom + 'T00:00:00').getTime() : null
    const toTs = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : null
    return requests
      .filter(r => r.request_type === tab)
      .filter(r => statusFilter === 'all' || r.status === statusFilter)
      .filter(r => {
        if (assignedFilter === 'all') return true
        if (assignedFilter === 'none') return !r.reviewed_by || r.status === 'open'
        return r.reviewed_by === assignedFilter
      })
      .filter(r => {
        const ts = new Date(r.created_at).getTime()
        if (fromTs && ts < fromTs) return false
        if (toTs && ts > toTs) return false
        return true
      })
      .sort((a, b) => sortDesc
        ? b.created_at.localeCompare(a.created_at)
        : a.created_at.localeCompare(b.created_at))
  }, [requests, tab, statusFilter, assignedFilter, dateFrom, dateTo, sortDesc])

  // Coordinadores que tienen solicitudes asignadas (para el filtro "Asignado a").
  const assignedOptions = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of requests) {
      if (r.reviewed_by && r.reviewed_by_name && r.status !== 'rejected') m.set(r.reviewed_by, r.reviewed_by_name)
    }
    return Array.from(m.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [requests])

  const byYear = useMemo(() => {
    const m = new Map<number, R[]>()
    for (const r of visible) {
      const y = new Date(r.created_at).getFullYear()
      const arr = m.get(y) ?? []
      arr.push(r)
      m.set(y, arr)
    }
    const years = Array.from(m.keys()).sort((a, b) => (sortDesc ? b - a : a - b))
    return years.map(y => ({ year: y, items: m.get(y)! }))
  }, [visible, sortDesc])

  const countByTab = useMemo(() => {
    const m: Record<string, number> = {}
    for (const t of tabs) m[t.key] = 0
    for (const r of requests) if (r.status === 'open' || r.status === 'in_review') m[r.request_type] = (m[r.request_type] ?? 0) + 1
    return m
  }, [requests, tabs])

  function toggleYear(y: number) {
    setExpandedYears(prev => {
      const next = new Set(prev)
      if (next.has(y)) next.delete(y); else next.add(y)
      return next
    })
  }

  async function doAssign(req: R, assigneeId: string, assigneeName: string) {
    setSubmitting(true)
    try {
      const res = await fetch(`${endpointBase}/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign', assignee_member_id: assigneeId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'No se pudo asignar la solicitud')
      }
      onUpdated(await res.json())
      toast(`Solicitud asignada a ${assigneeName}`, 'success')
      setAssignTarget(null)
      setAssigneeSearch('')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo asignar la solicitud', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function doAction(req: R, action: 'take' | 'resolve' | 'reject', reviewNotes?: string) {
    setSubmitting(true)
    try {
      const res = await fetch(`${endpointBase}/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, review_notes: reviewNotes || undefined }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'No se pudo actualizar la solicitud')
      }
      onUpdated(await res.json())
      toast(
        action === 'take' ? 'Solicitud tomada — quedó a tu nombre'
        : action === 'resolve' ? 'Solicitud marcada como resuelta'
        : 'Solicitud rechazada',
        'success',
      )
      setActionTarget(null)
      setNotes('')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo actualizar la solicitud', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Tabs por tipo */}
      <RequestTabs tabs={tabs} active={tab} counts={countByTab} onChange={setTab} />

      {/* Filtros: estado + rango de fechas + orden */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                'rounded-full px-3 py-1.5 text-[12px] font-body border transition-all',
                statusFilter === f.key
                  ? 'bg-navy text-white border-navy'
                  : 'bg-transparent text-navy/60 border-outline hover:text-navy',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {assigneesUrl && (
          <div className="flex items-center gap-1.5">
            <label htmlFor="req-assigned-filter" className="text-[11px] text-navy-light/60 font-body">Asignado a</label>
            <select
              id="req-assigned-filter"
              value={assignedFilter}
              onChange={e => setAssignedFilter(e.target.value)}
              className="rounded-lg border border-outline bg-surface-card px-2 py-1 text-[12px] text-navy font-body outline-none"
            >
              <option value="all">Todas</option>
              <option value="none">Sin asignar</option>
              {assignedOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        )}
        <div className="flex items-center gap-1.5 ml-auto flex-wrap">
          <label htmlFor="req-date-from" className="text-[11px] text-navy-light/60 font-body">Desde</label>
          <input
            id="req-date-from"
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="rounded-lg border border-outline bg-surface-card px-2 py-1 text-[12px] text-navy font-body outline-none"
          />
          <label htmlFor="req-date-to" className="text-[11px] text-navy-light/60 font-body">Hasta</label>
          <input
            id="req-date-to"
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="rounded-lg border border-outline bg-surface-card px-2 py-1 text-[12px] text-navy font-body outline-none"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo('') }}
              aria-label="Limpiar fechas"
              className="rounded-lg p-1 text-navy-light/60 hover:text-coral transition-colors"
            >
              <X size={13} />
            </button>
          )}
          <button
            onClick={() => setSortDesc(v => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-outline px-2 py-1 text-[12px] text-navy-light/70 font-body hover:text-navy transition-colors"
            title={sortDesc ? 'Más recientes primero' : 'Más antiguas primero'}
          >
            <ArrowUpDown size={12} />
            {sortDesc ? 'Recientes' : 'Antiguas'}
          </button>
        </div>
      </div>

      {/* Lista acordeón por año */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={18} className="animate-spin text-navy-light/40" />
        </div>
      ) : byYear.length === 0 ? (
        <div className="rounded-2xl bg-surface-card shadow-card">
          <EmptyState
            icon={Inbox}
            title="No hay solicitudes con estos filtros"
            description="Las solicitudes que envíen los miembros van a aparecer acá."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {byYear.map(({ year, items }) => {
            const yearOpen = expandedYears.has(year)
            return (
              <div key={year} className="rounded-2xl bg-surface-card shadow-card overflow-hidden">
                <button
                  onClick={() => toggleYear(year)}
                  className="flex w-full items-center justify-between px-5 py-3.5 hover:bg-surface-low transition-colors"
                  aria-expanded={yearOpen}
                >
                  <span className="text-sm font-bold text-navy font-display">{year}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-[11px] text-navy-light/60 font-body">
                      {items.length} solicitud{items.length !== 1 ? 'es' : ''}
                    </span>
                    {yearOpen ? <ChevronUp size={15} className="text-navy-light/60" /> : <ChevronDown size={15} className="text-navy-light/60" />}
                  </span>
                </button>

                {yearOpen && (
                  <ul className="divide-y divide-[var(--outline-variant)] border-t border-outline">
                    {items.map(r => {
                      const badge = REQUEST_STATUS_BADGE[r.status]
                      const isOpen = expandedRequest === r.id
                      return (
                        <li key={r.id}>
                          <button
                            onClick={() => setExpandedRequest(isOpen ? null : r.id)}
                            className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-low transition-colors"
                            aria-expanded={isOpen}
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy text-[10px] font-display font-extrabold">
                              {getInitials(r.member_name)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-navy font-body">
                                <strong className="font-semibold">{typeLabel[r.request_type] ?? r.request_type}</strong> · {r.member_name}
                              </span>
                              <span className="text-[11px] text-navy-light/60 font-body">{formatDate(r.created_at)}</span>
                            </span>
                            {r.reviewed_by_name && r.status !== 'open' && (
                              <span className="hidden sm:inline-flex items-center gap-1.5 shrink-0" title={`Asignada a ${r.reviewed_by_name}`}>
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-soft/40 text-teal-deep text-[9px] font-display font-extrabold">
                                  {getInitials(r.reviewed_by_name)}
                                </span>
                                <span className="text-[11px] text-navy-light/70 font-body max-w-[110px] truncate">{r.reviewed_by_name}</span>
                              </span>
                            )}
                            <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold font-body shrink-0', badge.cls)}>
                              {badge.label}
                            </span>
                            {isOpen ? <ChevronUp size={15} className="text-navy-light/60 shrink-0" /> : <ChevronDown size={15} className="text-navy-light/60 shrink-0" />}
                          </button>

                          {isOpen && (
                            <div className="px-5 pb-4 pt-1 space-y-3 bg-surface-low/40">
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-navy-light/80 font-body">
                                <Link href={`/miembros/${r.member_id}`} className="text-navy font-medium hover:text-coral transition-colors">
                                  Ver perfil de {r.member_name} →
                                </Link>
                                {renderDetails(r)}
                              </div>

                              <p className="text-sm text-navy-light/80 font-body leading-relaxed">
                                &ldquo;{r.reason}&rdquo;
                              </p>

                              {/* Historial */}
                              <div className="space-y-1">
                                <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-navy-light/60 font-display">
                                  <History size={11} /> Historial
                                </p>
                                <p className="text-[12px] text-navy-light/70 font-body">
                                  Creada · {formatDateNumeric(r.created_at)}
                                </p>
                                {r.history.map((h, i) => (
                                  <p key={i} className="text-[12px] text-navy-light/70 font-body">
                                    {statusLabel(h.from_status)} → {statusLabel(h.to_status)}
                                    {h.changed_by_name ? ` · por ${h.changed_by_name}` : ''} · {formatDateNumeric(h.created_at)}
                                    {h.notes ? ` — ${h.notes}` : ''}
                                  </p>
                                ))}
                              </div>

                              {/* Pista de resolución (ej. crear beca/devolución real) */}
                              {r.status === 'resolved' && renderResolveHint?.(r)}

                              {/* Acciones */}
                              {(r.status === 'open' || r.status === 'in_review') && (
                                <div className="flex gap-2 flex-wrap pt-1">
                                  {r.status === 'open' && (
                                    <button
                                      onClick={() => doAction(r, 'take')}
                                      disabled={submitting}
                                      className="rounded-full bg-navy px-4 py-1.5 text-[13px] text-white font-body hover:bg-navy-ink transition-colors disabled:opacity-60"
                                    >
                                      Tomar
                                    </button>
                                  )}
                                  {assigneesUrl && (
                                    <button
                                      onClick={() => { setAssignTarget(r); setAssigneeSearch('') }}
                                      disabled={submitting}
                                      className="inline-flex items-center gap-1.5 rounded-full border border-navy/20 px-4 py-1.5 text-[13px] text-navy font-body hover:bg-navy/5 transition-colors disabled:opacity-60"
                                    >
                                      <UserPlus size={13} />
                                      Asignar
                                    </button>
                                  )}
                                  <button
                                    onClick={() => { setActionTarget({ req: r, action: 'resolve' }); setNotes('') }}
                                    disabled={submitting}
                                    className="rounded-full bg-success/12 px-4 py-1.5 text-[13px] text-success font-body font-medium hover:bg-success/20 transition-colors disabled:opacity-60"
                                  >
                                    Resolver
                                  </button>
                                  <button
                                    onClick={() => { setActionTarget({ req: r, action: 'reject' }); setNotes('') }}
                                    disabled={submitting}
                                    className="rounded-full bg-coral/10 px-4 py-1.5 text-[13px] text-coral font-body font-medium hover:bg-coral/20 transition-colors disabled:opacity-60"
                                  >
                                    Rechazar
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal asignar a coordinador */}
      {assignTarget && (
        <Modal onClose={() => setAssignTarget(null)} titleId="request-assign-title">
          <div className="p-6 space-y-4">
            <div>
              <h2 id="request-assign-title" className="text-lg font-semibold text-navy font-display">
                Asignar solicitud
              </h2>
              <p className="text-sm text-navy-light/60 font-body mt-0.5">
                {typeLabel[assignTarget.request_type] ?? assignTarget.request_type} de {assignTarget.member_name} — elegí el coordinador de dirigentes:
              </p>
            </div>

            {assignees.length > 6 && (
              <div className="flex items-center gap-2 rounded-xl border border-outline bg-surface-low px-3 py-2">
                <Search size={13} className="text-navy-light/60 shrink-0" />
                <input
                  autoFocus
                  value={assigneeSearch}
                  onChange={e => setAssigneeSearch(e.target.value)}
                  placeholder="Buscar coordinador…"
                  aria-label="Buscar coordinador"
                  className="min-w-0 flex-1 bg-transparent text-sm text-navy outline-none font-body placeholder:text-navy-light/50"
                />
              </div>
            )}

            {assignees.length === 0 ? (
              <p className="text-sm text-navy-light/60 font-body py-4 text-center">
                No hay coordinadores de dirigentes activos para asignar.
              </p>
            ) : (
              <ul className="rounded-xl border border-outline overflow-hidden divide-y divide-[var(--outline-variant)] max-h-72 overflow-y-auto">
                {assignees
                  .filter(a => a.member_name.toLowerCase().includes(assigneeSearch.toLowerCase()))
                  .map(a => (
                    <li key={a.member_id}>
                      <button
                        onClick={() => doAssign(assignTarget, a.member_id, a.member_name)}
                        disabled={submitting}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-surface-low transition-colors disabled:opacity-60"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-soft/40 text-teal-deep text-[10px] font-display font-extrabold">
                          {getInitials(a.member_name)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-navy font-body">{a.member_name}</span>
                        {assignTarget.reviewed_by === a.member_id && (
                          <span className="text-[11px] text-navy-light/60 font-body shrink-0">Asignada actual</span>
                        )}
                      </button>
                    </li>
                  ))}
              </ul>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => setAssignTarget(null)}
                className="rounded-full px-4 py-2 text-sm text-navy-light/70 font-body hover:text-navy transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal resolver / rechazar */}
      {actionTarget && (
        <Modal onClose={() => setActionTarget(null)} titleId="request-action-title">
          <div className="p-6">
            <h2 id="request-action-title" className="text-lg font-semibold text-navy font-display mb-1">
              {actionTarget.action === 'resolve' ? 'Resolver solicitud' : 'Rechazar solicitud'}
            </h2>
            <p className="text-sm text-navy-light/60 font-body mb-4">
              {actionTarget.req.member_name} · {formatDate(actionTarget.req.created_at)}
            </p>
            {actionTarget.action === 'resolve' && renderResolveHint && (
              <div className="mb-4">{renderResolveHint(actionTarget.req)}</div>
            )}
            <label htmlFor="request-review-notes" className="block text-[12px] font-medium text-navy-light/70 font-body mb-1.5">
              Notas {actionTarget.action === 'resolve' ? 'de resolución' : 'del rechazo'} (opcional)
            </label>
            <textarea
              id="request-review-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder={actionTarget.action === 'resolve'
                ? 'Ej: Aprobada y registrada.'
                : 'Ej: No cumple los requisitos.'}
              className="w-full rounded-xl border border-outline bg-surface-low px-3 py-2.5 text-sm text-navy font-body outline-none focus:ring-1 focus:ring-coral/30 resize-none placeholder:text-navy-light/50"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setActionTarget(null)}
                className="rounded-full px-4 py-2 text-sm text-navy-light/70 font-body hover:text-navy transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => doAction(actionTarget.req, actionTarget.action, notes)}
                disabled={submitting}
                className={cn(
                  'rounded-full px-5 py-2 text-sm text-white font-body font-medium transition-colors disabled:opacity-60',
                  actionTarget.action === 'resolve' ? 'bg-success hover:bg-[#2f9c64]' : 'bg-coral hover:bg-coral-deep',
                )}
              >
                {submitting
                  ? 'Guardando…'
                  : actionTarget.action === 'resolve' ? 'Confirmar resolución' : 'Confirmar rechazo'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
