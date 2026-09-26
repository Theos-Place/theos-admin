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
import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  Inbox, Loader2, ChevronDown, ChevronUp, X, ArrowUpDown, ArrowUp, History, Search, UserPlus, Clock,
} from 'lucide-react'
import { useToast } from '@/components/shared/Toast'
import { Modal } from '@/components/shared/Modal'
import { EmptyState } from '@/components/shared/EmptyState'
import { RequestTabs } from '@/components/shared/RequestTabs'
import { cn } from '@/lib/utils'
import { formatDate, formatDateNumeric, getInitials } from '@/lib/format'

// 'escalated' lo usa hoy solo el tablero de evaluaciones (DIR-5) y aparece
// únicamente si el consumidor pasa `allowEscalate`. Estudios y finanzas no lo
// tienen en el CHECK de su tabla, así que para ellos no existe.
// 'en_espera' lo usa hoy solo la cola de reubicaciones (REU-2) y aparece
// únicamente si el consumidor pasa `espera`. Igual que 'escalated': el tipo lo
// conoce el tablero, el CHECK de cada tabla decide si existe de verdad.
export type RequestStatus = 'open' | 'in_review' | 'escalated' | 'resolved' | 'rejected' | 'vencida' | 'en_espera'

export type BaseRequest = {
  id: string
  member_id: string
  member_name: string
  request_type: string
  reason: string | null
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
  escalated: { label: 'Escalada',    cls: 'bg-[rgba(155,127,212,0.18)] text-[#6B4FA0]' },
  resolved:  { label: 'Resuelta',    cls: 'bg-success/12 text-success' },
  rejected:  { label: 'Rechazada',   cls: 'bg-surface-low text-navy-light/80' },
  // Se venció el bloque de matrícula para el que servía. No es un rechazo: la
  // persona puede volver a pedirla en el bloque siguiente.
  vencida:   { label: 'Vencida',     cls: 'bg-navy/5 text-navy-light/80' },
  // REU-2: alguien decidió a propósito que esta espera. No es una pendiente
  // olvidada, y por eso no se cuenta como activa ni sale en la lista de arriba.
  en_espera: { label: 'En espera',   cls: 'bg-[rgba(59,117,121,0.14)] text-[#2F5C5F]' },
}

// Orden: estados activos primero, "Todas" al final. Default al entrar: Abiertas.
const STATUS_FILTERS: { key: RequestStatus | 'all'; label: string }[] = [
  { key: 'open', label: 'Abiertas' },
  { key: 'in_review', label: 'En revisión' },
  { key: 'resolved', label: 'Resueltas' },
  { key: 'rejected', label: 'Rechazadas' },
  { key: 'all', label: 'Todas' },
]

/** Los filtros del tablero. "Escaladas" solo aparece donde el estado existe:
 *  va después de "En revisión" porque es la continuación de ese camino. */
function statusFiltersFor(allowEscalate?: boolean): { key: RequestStatus | 'all'; label: string }[] {
  if (!allowEscalate) return STATUS_FILTERS
  const i = STATUS_FILTERS.findIndex(f => f.key === 'in_review') + 1
  return [
    ...STATUS_FILTERS.slice(0, i),
    { key: 'escalated' as const, label: 'Escaladas' },
    ...STATUS_FILTERS.slice(i),
  ]
}

/** Estados en los que la solicitud sigue pidiendo trabajo. */
const ACTIVE_STATUSES: RequestStatus[] = ['open', 'in_review', 'escalated']

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
  /** Formulario extra requerido para "Resolver" en ciertos tipos (ej. elegir el
   *  grupo destino de una reubicación). `onChange` se llama con el payload a
   *  fusionar en el PATCH, o `null` mientras no sea válido — bloquea el submit. */
  renderResolveExtra?: (r: R, onChange: (payload: Record<string, unknown> | null) => void) => React.ReactNode
  /** Cambio de estado A MANO (coordinación). Se dibuja aparte de las acciones:
   *  aparece también en tableros de solo lectura y en solicitudes ya cerradas,
   *  que es justo donde hacía falta — una de interés nacía 'open' y no había
   *  forma de moverla. `opciones` devuelve [] para no ofrecer nada en esa fila. */
  cambiarEstado?: {
    opciones: (r: R) => { value: string; label: string }[]
    onChange: (r: R, status: string) => void
  }
  /** EST-6: tablero de SOLO LECTURA (datos de demanda) — oculta Tomar/Asignar/
   *  Resolver/Rechazar. El API además rechaza acciones para esos tipos. */
  readOnly?: boolean
  /** Habilita "Asignar a un coordinador": URL que lista los asignables. */
  assigneesUrl?: string
  /** DIR-5: habilita el estado `escalated` — botón "Escalar" y su filtro. Solo
   *  para tableros cuya tabla lo acepta en el CHECK de status. */
  allowEscalate?: boolean
  /**
   * REU-2 · habilita el estado `en_espera`: botón «Poner en espera» con su
   * selector de semanas, y una sección aparte y COLAPSADA con las dormidas.
   *
   * Van aparte y no como un filtro más porque el punto de la función es
   * sacarlas de la vista: si siguieran mezcladas en la lista, poner una en
   * espera no le limpiaría la cola a nadie y la función no serviría de nada.
   */
  espera?: {
    /** ¿Esta fila se puede pausar? (tipo y estado). */
    permitida: (r: R) => boolean
    /** YYYY-MM-DD en que vuelve, para mostrarlo en la sección colapsada. */
    fechaDeVuelta: (r: R) => string | null
    /** Las semanas que ofrece el selector. */
    semanas: readonly number[]
  }
  /** Bloquea Resolver/Rechazar con una razón visible (DIR-5: no se puede cerrar
   *  un tiquete mientras la ventana de respuestas sigue abierta). Devolver null
   *  = se puede cerrar. */
  closeBlockedReason?: (r: R) => string | null
}

export function RequestBoard<R extends BaseRequest>({
  requests, loading, tabs, typeLabel, endpointBase, onUpdated, renderDetails, renderResolveHint, renderResolveExtra, assigneesUrl, cambiarEstado, readOnly,
  allowEscalate, closeBlockedReason, espera,
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
  const [resolveExtra, setResolveExtra] = useState<Record<string, unknown> | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Asignación a coordinador de dirigentes
  const [assignTarget, setAssignTarget] = useState<R | null>(null)
  const [assignees, setAssignees] = useState<Array<{ member_id: string; member_name: string }>>([])
  const [assigneeSearch, setAssigneeSearch] = useState('')
  const [assignedFilter, setAssignedFilter] = useState<'all' | 'none' | string>('all')
  // REU-2 · pausar: a quién y por cuántas semanas.
  const [esperaTarget, setEsperaTarget] = useState<R | null>(null)
  const [esperaSemanas, setEsperaSemanas] = useState<number>(0)
  const [esperaNota, setEsperaNota] = useState('')
  const [esperaAbierta, setEsperaAbierta] = useState(false)

  useEffect(() => {
    if (!assigneesUrl) return
    let alive = true
    fetch(assigneesUrl)
      .then(r => (r.ok ? r.json() : []))
      .then(d => { if (alive && Array.isArray(d)) setAssignees(d) })
      .catch(() => {})
    return () => { alive = false }
  }, [assigneesUrl])

  // Deep-link desde una notificación (?request=ID): abre esa solicitud
  // específica — cambia al tab de su tipo, quita el filtro de estado, expande
  // su año y la fila, y hace scroll. Una sola vez por carga.
  const focusedRef = useRef(false)
  // `tabs` llega inline desde la página (array nuevo en cada render): la dep va
  // por las keys para no re-disparar el efecto de gusto.
  const tabKeys = tabs.map(t => t.key).join(',')
  useEffect(() => {
    if (focusedRef.current || requests.length === 0) return
    const id = new URLSearchParams(window.location.search).get('request')
    if (!id) return
    const req = requests.find(r => r.id === id)
    if (!req) return
    // El tablero puede estar montado con UN solo tipo (la página de estudios
    // renderiza un tab por sección): si la solicitud es de otro tipo, la que
    // cambia de sección es la página — acá cambiar el tab dejaría la lista
    // filtrada por un tipo que no está en `tabs` y se vería vacía (bug
    // 2026-08-04: el deep link "abría otro tab" sin la solicitud).
    if (!tabKeys.split(',').includes(req.request_type)) return
    focusedRef.current = true
    setTab(req.request_type)
    setStatusFilter('all')
    setExpandedRequest(id)
    setExpandedYears(prev => new Set(prev).add(new Date(req.created_at).getFullYear()))
    setTimeout(() => {
      document.querySelector(`[data-request-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
  }, [requests, tabKeys])

  const visible = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom + 'T00:00:00').getTime() : null
    const toTs = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : null
    return requests
      .filter(r => r.request_type === tab)
      // REU-2: las dormidas van en su propia sección colapsada. Dejarlas acá
      // sería no haberle limpiado la cola a nadie, que es el punto de pausar.
      .filter(r => !espera || r.status !== 'en_espera')
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
  }, [requests, tab, statusFilter, assignedFilter, dateFrom, dateTo, sortDesc, espera])

  /** REU-2 · Las que están durmiendo, de la más próxima a despertar a la más
   *  lejana: la primera de la lista es la que hay que volver a mirar antes. */
  const dormidas = useMemo(() => {
    if (!espera) return []
    return requests
      .filter(r => r.request_type === tab && r.status === 'en_espera')
      .sort((a, b) => (espera.fechaDeVuelta(a) ?? '9999').localeCompare(espera.fechaDeVuelta(b) ?? '9999'))
  }, [requests, tab, espera])

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
    for (const key of tabKeys.split(',')) m[key] = 0
    for (const r of requests) if (ACTIVE_STATUSES.includes(r.status)) m[r.request_type] = (m[r.request_type] ?? 0) + 1
    return m
  }, [requests, tabKeys])

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

  /** REU-2 · Pausar. Va por el mismo PATCH que el resto: el servidor valida el
   *  tipo, el estado y las semanas, y calcula la fecha — acá no se calcula nada
   *  para que la pantalla y el cron no puedan discrepar en un día. */
  async function doEspera(req: R, semanas: number, nota: string) {
    setSubmitting(true)
    try {
      const res = await fetch(`${endpointBase}/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'wait', weeks: semanas, review_notes: nota.trim() || undefined }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'No se pudo poner en espera')
      }
      onUpdated(await res.json())
      toast('Solicitud en espera — vuelve a la cola sola', 'success')
      setEsperaTarget(null); setEsperaSemanas(0); setEsperaNota('')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo poner en espera', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function doAction(req: R, action: 'take' | 'escalate' | 'resolve' | 'reject', reviewNotes?: string, extra?: Record<string, unknown> | null) {
    setSubmitting(true)
    try {
      const res = await fetch(`${endpointBase}/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, review_notes: reviewNotes || undefined, ...(extra ?? {}) }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'No se pudo actualizar la solicitud')
      }
      onUpdated(await res.json())
      toast(
        action === 'take' ? 'Solicitud tomada — quedó a tu nombre'
        : action === 'escalate' ? 'Solicitud escalada'
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
      {/* Tabs por tipo — se ocultan si el board recibe un solo tipo (el tabbing
          lo controla la página, ej. solicitudes de estudio con tabs planos). */}
      {tabs.length > 1 && <RequestTabs tabs={tabs} active={tab} counts={countByTab} onChange={setTab} />}

      {/* Filtros: estado + rango de fechas + orden */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {statusFiltersFor(allowEscalate).map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                'rounded-full px-3 py-1.5 text-[13px] font-body border transition-all',
                statusFilter === f.key
                  ? 'bg-navy text-white border-navy'
                  : 'bg-transparent text-navy/80 border-outline hover:text-navy',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {assigneesUrl && (
          <div className="flex items-center gap-1.5">
            <label htmlFor="req-assigned-filter" className="text-[13px] text-navy-light/80 font-body">Asignado a</label>
            <select
              id="req-assigned-filter"
              value={assignedFilter}
              onChange={e => setAssignedFilter(e.target.value)}
              className="rounded-lg border border-outline bg-surface-card px-2 py-1 text-[13px] text-navy font-body outline-none"
            >
              <option value="all">Todas</option>
              <option value="none">Sin asignar</option>
              {assignedOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        )}
        <div className="flex items-center gap-1.5 ml-auto flex-wrap">
          <label htmlFor="req-date-from" className="text-[13px] text-navy-light/80 font-body">Desde</label>
          <input
            id="req-date-from"
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="rounded-lg border border-outline bg-surface-card px-2 py-1 text-[13px] text-navy font-body outline-none"
          />
          <label htmlFor="req-date-to" className="text-[13px] text-navy-light/80 font-body">Hasta</label>
          <input
            id="req-date-to"
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="rounded-lg border border-outline bg-surface-card px-2 py-1 text-[13px] text-navy font-body outline-none"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo('') }}
              aria-label="Limpiar fechas"
              className="rounded-lg p-1 text-navy-light/80 hover:text-coral transition-colors"
            >
              <X size={13} />
            </button>
          )}
          <button
            onClick={() => setSortDesc(v => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-outline px-2 py-1 text-[13px] text-navy-light/80 font-body hover:text-navy transition-colors"
            title={sortDesc ? 'Más recientes primero' : 'Más antiguas primero'}
          >
            <ArrowUpDown size={12} />
            {sortDesc ? 'Recientes' : 'Antiguas'}
          </button>
        </div>
      </div>

      {/* REU-2 · Las que están en espera, aparte y colapsadas. Colapsadas es la
          función, no un detalle de estilo: quien puso una en espera decidió no
          mirarla hoy. Abierta se ve cuándo vuelve cada una. */}
      {espera && dormidas.length > 0 && (
        <div className="rounded-2xl bg-surface-card shadow-card overflow-hidden">
          <button
            onClick={() => setEsperaAbierta(v => !v)}
            aria-expanded={esperaAbierta}
            className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-surface-low/40 transition-colors"
          >
            <span className="inline-flex items-center gap-2 text-sm text-navy font-body">
              <Clock size={14} className="text-navy-light/80" aria-hidden="true" />
              {dormidas.length === 1 ? '1 solicitud en espera' : `${dormidas.length} solicitudes en espera`}
            </span>
            <span className="text-[13px] text-navy-light/80 font-body">
              {esperaAbierta ? 'Ocultar' : 'Ver'}
            </span>
          </button>
          {esperaAbierta && (
            <ul className="border-t border-[var(--outline-variant)]">
              {dormidas.map(r => {
                const vuelve = espera.fechaDeVuelta(r)
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 border-b border-[var(--outline-variant)] last:border-0">
                    <Link href={`/miembros/${r.member_id}`} className="text-sm text-navy font-body hover:text-coral transition-colors">
                      {r.member_name}
                    </Link>
                    <span className="text-[13px] text-navy-light/80 font-body">
                      {vuelve ? `Vuelve a la cola el ${formatDate(vuelve)}` : 'Sin fecha de vuelta'}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {/* Lista acordeón por año */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={18} className="animate-spin text-navy-light/80" />
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
                    <span className="text-[13px] text-navy-light/80 font-body">
                      {items.length} solicitud{items.length !== 1 ? 'es' : ''}
                    </span>
                    {yearOpen ? <ChevronUp size={15} className="text-navy-light/80" /> : <ChevronDown size={15} className="text-navy-light/80" />}
                  </span>
                </button>

                {yearOpen && (
                  <ul className="divide-y divide-[var(--outline-variant)] border-t border-outline">
                    {items.map(r => {
                      const badge = REQUEST_STATUS_BADGE[r.status]
                      const isOpen = expandedRequest === r.id
                      return (
                        <li key={r.id} data-request-id={r.id}>
                          <button
                            onClick={() => setExpandedRequest(isOpen ? null : r.id)}
                            className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-low transition-colors"
                            aria-expanded={isOpen}
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy text-[11px] font-display font-extrabold">
                              {getInitials(r.member_name)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-navy font-body">
                                <strong className="font-semibold">{typeLabel[r.request_type] ?? r.request_type}</strong> · {r.member_name}
                              </span>
                              <span className="text-[13px] text-navy-light/80 font-body">{formatDate(r.created_at)}</span>
                            </span>
                            {r.reviewed_by_name && r.status !== 'open' && (
                              <span className="hidden sm:inline-flex items-center gap-1.5 shrink-0" title={`Asignada a ${r.reviewed_by_name}`}>
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-soft/40 text-teal-deep text-[11px] font-display font-extrabold">
                                  {getInitials(r.reviewed_by_name)}
                                </span>
                                <span className="text-[13px] text-navy-light/80 font-body max-w-[110px] truncate">{r.reviewed_by_name}</span>
                              </span>
                            )}
                            <span className={cn('rounded-full px-2.5 py-1 text-[13px] font-semibold font-body shrink-0', badge.cls)}>
                              {badge.label}
                            </span>
                            {isOpen ? <ChevronUp size={15} className="text-navy-light/80 shrink-0" /> : <ChevronDown size={15} className="text-navy-light/80 shrink-0" />}
                          </button>

                          {isOpen && (
                            <div className="px-5 pb-4 pt-1 space-y-3 bg-surface-low/40">
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-navy-light/80 font-body">
                                <Link href={`/miembros/${r.member_id}`} className="text-navy font-medium hover:text-coral transition-colors">
                                  Ver perfil de {r.member_name} →
                                </Link>
                                {renderDetails(r)}
                              </div>

                              {r.reason && (
                                <p className="text-sm text-navy-light/80 font-body leading-relaxed">
                                  &ldquo;{r.reason}&rdquo;
                                </p>
                              )}

                              {/* Historial */}
                              <div className="space-y-1">
                                <p className="inline-flex items-center gap-1.5 text-[13px] uppercase tracking-widest text-navy-light/80 font-display">
                                  <History size={11} /> Historial
                                </p>
                                <p className="text-[13px] text-navy-light/80 font-body">
                                  Creada · {formatDateNumeric(r.created_at)}
                                </p>
                                {r.history.map((h, i) => (
                                  <p key={i} className="text-[13px] text-navy-light/80 font-body">
                                    {statusLabel(h.from_status)} → {statusLabel(h.to_status)}
                                    {h.changed_by_name ? ` · por ${h.changed_by_name}` : ''} · {formatDateNumeric(h.created_at)}
                                    {h.notes ? ` — ${h.notes}` : ''}
                                  </p>
                                ))}
                              </div>

                              {/* Pista de resolución (ej. crear beca/devolución real) */}
                              {r.status === 'resolved' && renderResolveHint?.(r)}

                              {/* Cambio de estado a mano. Va FUERA del bloque de
                                  acciones a propósito: se ofrece aunque el
                                  tablero sea de solo lectura y aunque la
                                  solicitud ya esté cerrada. */}
                              {(() => {
                                const opciones = cambiarEstado?.opciones(r) ?? []
                                if (opciones.length === 0) return null
                                return (
                                  <div className="flex items-center gap-2 flex-wrap pt-1">
                                    <label
                                      htmlFor={`estado-${r.id}`}
                                      className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display"
                                    >
                                      Cambiar estado
                                    </label>
                                    <select
                                      id={`estado-${r.id}`}
                                      value=""
                                      disabled={submitting}
                                      onChange={e => {
                                        const v = e.target.value
                                        e.target.value = ''
                                        if (v) cambiarEstado!.onChange(r, v)
                                      }}
                                      className="rounded-full border border-[var(--outline-variant)] bg-surface-card px-3 py-1.5 text-[13px] text-navy font-body disabled:opacity-60"
                                    >
                                      <option value="">Elegir…</option>
                                      {opciones.map(o => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                )
                              })()}

                              {/* Acciones (ocultas en tableros de solo lectura, EST-6) */}
                              {!readOnly && ACTIVE_STATUSES.includes(r.status) && (
                                <div className="flex gap-2 flex-wrap pt-1 items-center">
                                  {r.status === 'open' && (
                                    <button
                                      onClick={() => doAction(r, 'take')}
                                      disabled={submitting}
                                      className="rounded-full bg-navy px-4 py-1.5 text-[13px] text-white font-body hover:bg-navy-ink transition-colors disabled:opacity-60"
                                    >
                                      Tomar
                                    </button>
                                  )}
                                  {espera?.permitida(r) && (
                                    <button
                                      onClick={() => { setEsperaTarget(r); setEsperaSemanas(0); setEsperaNota('') }}
                                      disabled={submitting}
                                      className="inline-flex items-center gap-1.5 rounded-full border border-navy/20 px-4 py-1.5 text-[13px] text-navy font-body hover:bg-navy/5 transition-colors disabled:opacity-60"
                                    >
                                      <Clock size={13} aria-hidden="true" />
                                      Poner en espera
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
                                  {allowEscalate && r.status !== 'escalated' && (
                                    <button
                                      onClick={() => doAction(r, 'escalate')}
                                      disabled={submitting}
                                      className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(155,127,212,0.18)] px-4 py-1.5 text-[13px] text-[#6B4FA0] font-body font-medium hover:bg-[rgba(155,127,212,0.3)] transition-colors disabled:opacity-60"
                                    >
                                      <ArrowUp size={13} />
                                      Escalar
                                    </button>
                                  )}
                                  <button
                                    onClick={() => { setActionTarget({ req: r, action: 'resolve' }); setNotes(''); setResolveExtra(null) }}
                                    disabled={submitting || !!closeBlockedReason?.(r)}
                                    className="rounded-full bg-success/12 px-4 py-1.5 text-[13px] text-success font-body font-medium hover:bg-success/20 transition-colors disabled:opacity-60"
                                  >
                                    Resolver
                                  </button>
                                  <button
                                    onClick={() => { setActionTarget({ req: r, action: 'reject' }); setNotes('') }}
                                    disabled={submitting || !!closeBlockedReason?.(r)}
                                    className="rounded-full bg-coral/10 px-4 py-1.5 text-[13px] text-coral font-body font-medium hover:bg-coral/20 transition-colors disabled:opacity-60"
                                  >
                                    Rechazar
                                  </button>
                                  {/* Por qué no se puede cerrar todavía: un botón
                                      deshabilitado sin explicación es una pared. */}
                                  {closeBlockedReason?.(r) && (
                                    <p className="text-[13px] text-navy-light/80 font-body">
                                      {closeBlockedReason(r)}
                                    </p>
                                  )}
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

      {/* REU-2 · Modal de poner en espera */}
      {espera && esperaTarget && (
        <Modal onClose={() => setEsperaTarget(null)} titleId="request-espera-title">
          <div className="p-6 space-y-4">
            <div>
              <h2 id="request-espera-title" className="text-lg font-semibold text-navy font-display">
                Poner en espera
              </h2>
              <p className="text-sm text-navy-light/80 font-body mt-0.5">
                La solicitud de {esperaTarget.member_name} sale de la cola y vuelve sola
                cuando llegue la fecha. Nadie tiene que acordarse de reabrirla.
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-[13px] font-medium text-navy-light/80 font-body">
                ¿Cuánto tiempo?
              </p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Semanas de espera">
                {espera.semanas.map(n => (
                  <button
                    key={n}
                    onClick={() => setEsperaSemanas(n)}
                    aria-pressed={esperaSemanas === n}
                    className={cn(
                      'rounded-full px-3.5 py-1.5 text-[13px] font-body border transition-all',
                      esperaSemanas === n
                        ? 'bg-navy text-white border-navy'
                        : 'bg-transparent text-navy/80 border-outline hover:text-navy',
                    )}
                  >
                    {n === 4 ? '1 mes' : n % 4 === 0 ? `${n / 4} meses` : `${n} semanas`}
                  </button>
                ))}
              </div>
              <p className="text-[13px] text-navy-light/80 font-body">
                Es una estimación, no un compromiso: cuando vuelva se puede volver a pausar.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="espera-nota" className="block text-[13px] font-medium text-navy-light/80 font-body">
                ¿Por qué espera? (opcional)
              </label>
              <textarea
                id="espera-nota"
                value={esperaNota}
                onChange={e => setEsperaNota(e.target.value)}
                rows={2}
                maxLength={300}
                placeholder="Ej.: quiere esperar a que el grupo de Karla llegue a Discípulos 2"
                className="w-full rounded-xl border border-outline bg-surface-low px-3 py-2.5 text-sm text-navy font-body outline-none focus:ring-1 focus:ring-coral/30"
              />
              <p className="text-[13px] text-navy-light/80 font-body">
                Queda en el historial. Sin esto, dentro de tres meses nadie se acuerda de
                qué estaba esperando.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEsperaTarget(null)}
                disabled={submitting}
                className="rounded-xl border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
              >
                Cancelar
              </button>
              <button
                onClick={() => doEspera(esperaTarget, esperaSemanas, esperaNota)}
                disabled={submitting || esperaSemanas <= 0}
                title={esperaSemanas <= 0 ? 'Elegí cuánto tiempo esperar' : undefined}
                className="rounded-full bg-coral px-5 py-2 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40 font-body"
              >
                {submitting ? 'Guardando…' : 'Poner en espera'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal asignar a coordinador */}
      {assignTarget && (
        <Modal onClose={() => setAssignTarget(null)} titleId="request-assign-title">
          <div className="p-6 space-y-4">
            <div>
              <h2 id="request-assign-title" className="text-lg font-semibold text-navy font-display">
                Asignar solicitud
              </h2>
              <p className="text-sm text-navy-light/80 font-body mt-0.5">
                {typeLabel[assignTarget.request_type] ?? assignTarget.request_type} de {assignTarget.member_name} — elegí el coordinador de dirigentes:
              </p>
            </div>

            {assignees.length > 6 && (
              <div className="flex items-center gap-2 rounded-xl border border-outline bg-surface-low px-3 py-2">
                <Search size={13} className="text-navy-light/80 shrink-0" />
                <input
                  autoFocus
                  value={assigneeSearch}
                  onChange={e => setAssigneeSearch(e.target.value)}
                  placeholder="Buscar coordinador…"
                  aria-label="Buscar coordinador"
                  className="min-w-0 flex-1 bg-transparent text-sm text-navy outline-none font-body placeholder:text-navy-light/80"
                />
              </div>
            )}

            {assignees.length === 0 ? (
              <p className="text-sm text-navy-light/80 font-body py-4 text-center">
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
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-soft/40 text-teal-deep text-[11px] font-display font-extrabold">
                          {getInitials(a.member_name)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-navy font-body">{a.member_name}</span>
                        {assignTarget.reviewed_by === a.member_id && (
                          <span className="text-[13px] text-navy-light/80 font-body shrink-0">Asignada actual</span>
                        )}
                      </button>
                    </li>
                  ))}
              </ul>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => setAssignTarget(null)}
                className="rounded-full px-4 py-2 text-sm text-navy-light/80 font-body hover:text-navy transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal resolver / rechazar. EST-7: el form extra puede NO aplicar a este
          tipo de solicitud (renderResolveExtra devuelve null) — en ese caso el
          submit no debe exigir resolveExtra. Antes bastaba con que la prop
          existiera para deshabilitar el botón para siempre en los tipos sin
          picker: ese era el bug de "no me deja resolver". */}
      {actionTarget && (() => {
        const resolveExtraNode = actionTarget.action === 'resolve'
          ? renderResolveExtra?.(actionTarget.req, setResolveExtra) ?? null
          : null
        return (
        <Modal onClose={() => setActionTarget(null)} titleId="request-action-title">
          <div className="p-6">
            <h2 id="request-action-title" className="text-lg font-semibold text-navy font-display mb-1">
              {actionTarget.action === 'resolve' ? 'Resolver solicitud' : 'Rechazar solicitud'}
            </h2>
            <p className="text-sm text-navy-light/80 font-body mb-4">
              {actionTarget.req.member_name} · {formatDate(actionTarget.req.created_at)}
            </p>
            {actionTarget.action === 'resolve' && renderResolveHint && (
              <div className="mb-4">{renderResolveHint(actionTarget.req)}</div>
            )}
            {resolveExtraNode && <div className="mb-4">{resolveExtraNode}</div>}
            <label htmlFor="request-review-notes" className="block text-[13px] font-medium text-navy-light/80 font-body mb-1.5">
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
              className="w-full rounded-xl border border-outline bg-surface-low px-3 py-2.5 text-sm text-navy font-body outline-none focus:ring-1 focus:ring-coral/30 resize-none placeholder:text-navy-light/80"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setActionTarget(null)}
                className="rounded-full px-4 py-2 text-sm text-navy-light/80 font-body hover:text-navy transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => doAction(actionTarget.req, actionTarget.action, notes, actionTarget.action === 'resolve' ? resolveExtra : undefined)}
                disabled={submitting || (actionTarget.action === 'resolve' && resolveExtraNode !== null && resolveExtra === null)}
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
        )
      })()}
    </div>
  )
}
