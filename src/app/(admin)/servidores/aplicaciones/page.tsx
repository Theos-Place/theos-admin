'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { type Application, type ApplicationStatus } from '@/types/server'
import { usePaginatedList } from '@/hooks/usePaginatedList'
import { useRowSelection } from '@/hooks/useRowSelection'
import { LoadMoreFooter } from '@/components/shared/LoadMoreFooter'
import { BulkActionBar } from '@/components/shared/BulkActionBar'
import { Modal } from '@/components/shared/Modal'
import type { DbApplication } from '@/lib/supabase/queries/servers'
import { toDomainApplication } from '@/lib/servers/adapter'
import { cn } from '@/lib/utils'
import { Search, ChevronRight, ClipboardList, Check, Loader2, Printer } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { AccessDenied } from '@/components/shared/AccessDenied'
import { PanelDeAplicacion } from '@/components/servers/PanelDeAplicacion'
import { useAuth } from '@/hooks/useAuth'
import { useTituloDePantalla } from '@/hooks/useTituloDePantalla'
import { canSeeServiceApplications, GESTIONAN_APLICACIONES } from '@/lib/auth/service-applications'
import { useToast } from '@/components/shared/Toast'
import { formatDate } from '@/lib/format'
import {
  APPLICATION_STATE_BADGE, APPLICATION_STATE_LABEL, APPLICATION_STATES,
} from '@/lib/servers/application-states'

// SRV-14 · Las etiquetas y los colores salen del módulo compartido. Estaban
// escritos a mano en DOS pantallas, así que el mismo estado se llamaba
// «Aprobada» en una y «Aceptada» en la otra — y el estado nuevo habría hecho
// falta agregarlo en los dos lados.
const APP_STATUS_COLORS = APPLICATION_STATE_BADGE
const APP_STATUS_LABELS = APPLICATION_STATE_LABEL

// SRV-14 · Los filtros se DERIVAN de los estados: escritos a mano, el estado
// nuevo existía en la base y no se podía filtrar, que es la peor combinación
// —las aplicaciones estaban ahí y la pantalla no las encontraba—.
const STATUS_FILTERS: { key: ApplicationStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Todas' },
  ...APPLICATION_STATES.map(s => ({ key: s, label: APPLICATION_STATE_LABEL[s] })),
]

type BulkAction = 'approve' | 'reject'

export default function AplicacionesPage() {
  const { user, loaded } = useAuth()
  // Sin esto la pestaña del navegador dice solo el nombre del módulo, y en el
  // historial todas las pantallas de servidores se ven iguales (QA-1/N4).
  useTituloDePantalla('Aplicaciones de Servicio', 'Servidores')
  const canSee = canSeeServiceApplications(user?.roles ?? [])
  // VER no es GESTIONAR: dirección entra a la bandeja pero no cambia estados.
  const puedeGestionar = (user?.roles ?? []).some(r => (GESTIONAN_APLICACIONES as string[]).includes(r))
  const toast = useToast()
  const [revisando, setRevisando] = useState<Application | null>(null)
  // Filtros de la bandeja: además del estado, por comité y por ubicación
  // (SRV-14). Con 40 aplicaciones repartidas en comités distintos, filtrar
  // solo por estado deja la pantalla igual de larga.
  const [ubicacionFiltro, setUbicacionFiltro] = useState('all')
  /** Las ubicaciones que existen HOY en el catálogo de puestos: no se escriben
   *  a mano ni se derivan de lo cargado, que con la lista paginada ofrecería
   *  solo las de la primera página. */
  const [ubicaciones, setUbicaciones] = useState<string[]>([])
  useEffect(() => {
    fetch('/api/servers/positions')
      .then(r => (r.ok ? r.json() : []))
      .then((d: Array<{ location?: string | null }>) => {
        if (!Array.isArray(d)) return
        setUbicaciones([...new Set(d.map(p => (p.location ?? '').trim()).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b, 'es')))
      })
      .catch(() => {})
  }, [])

  const [search, setSearch]             = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all')
  const [committeeFilter, setCommitteeFilter] = useState('all')

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

  // Conteos globales para los badges (pendientes / en revisión).
  const [counts, setCounts] = useState({ pending: 0, reviewing: 0 })
  const reloadCounts = () => {
    fetch('/api/servers/applications?stats=1')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setCounts(d) })
      .catch(() => {})
  }
  useEffect(() => { reloadCounts() }, [])
  const { pending, reviewing } = counts

  // Listado paginado server-side (búsqueda + estado + comité al servidor).
  const buildUrl = (page: number) => {
    const u = new URLSearchParams()
    if (debouncedSearch.trim()) u.set('search', debouncedSearch.trim())
    if (statusFilter !== 'all') u.set('status', statusFilter)
    if (committeeFilter !== 'all') u.set('committee', committeeFilter)
    if (ubicacionFiltro !== 'all') u.set('location', ubicacionFiltro)
    u.set('page', String(page))
    u.set('pageSize', '25')
    return `/api/servers/applications?${u.toString()}`
  }
  const {
    items: filtered, total, loading, hasMore, loadMore, reload,
  } = usePaginatedList<DbApplication, Application>(buildUrl, {
    pageSize: 25, itemsKey: 'applications', mapItem: toDomainApplication,
  })

  // Selección múltiple (sobre lo cargado) + bulk approve/reject (5b).
  const sel = useRowSelection(filtered.map(a => a.id))
  const [confirm, setConfirm] = useState<BulkAction | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function runBulk(action: BulkAction) {
    if (busy || sel.count === 0) return
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch('/api/servers/applications/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids: sel.selectedIds }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudo aplicar la acción.')
      if (action === 'approve') {
        setResult(`${sel.count} aplicación${sel.count !== 1 ? 'es' : ''} aprobada${sel.count !== 1 ? 's' : ''} · ${data.activated} servidor${data.activated !== 1 ? 'es' : ''} activado${data.activated !== 1 ? 's' : ''}.`)
      } else {
        setResult(`${sel.count} aplicación${sel.count !== 1 ? 'es' : ''} marcada${sel.count !== 1 ? 's' : ''} como no seleccionada${sel.count !== 1 ? 's' : ''}.`)
      }
      sel.clear()
      setConfirm(null)
      reload()
      reloadCounts()
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setBusy(false)
    }
  }


  // Solo coordinador de servidores y admin (2026-07-30).
  if (loaded && !canSee) return <AccessDenied />
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-navy px-6 py-5 flex items-start justify-between gap-4 shadow-[var(--shadow-md)]">
        <div>
          <h1 className="text-2xl text-white font-display font-extrabold tracking-[-0.02em]">Aplicaciones de Servicio</h1>
          <p className="mt-1 text-sm text-white/80 font-body">
            {pending} pendiente{pending !== 1 ? 's' : ''} · {reviewing} en revisión
          </p>
        </div>
      </div>

      {result && (
        <p className="rounded-xl bg-teal-soft/20 px-4 py-2 text-sm text-teal-deep font-body inline-flex items-center gap-1.5">
          <Check size={14} /> {result}
        </p>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 sm:min-w-48 w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-light/80" />
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
          aria-label="Filtrar por comité"
        >
          <option value="all">Todos los comités</option>
          {committees.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {/* SRV-14 · Por ubicación del puesto. Se filtra en el SERVIDOR, igual
            que el comité: la lista está paginada, y filtrar en pantalla solo
            recortaría la página cargada — el total diría otra cosa. */}
        {ubicaciones.length > 0 && (
          <select
            className="w-full sm:w-auto rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
            value={ubicacionFiltro}
            onChange={e => setUbicacionFiltro(e.target.value)}
            aria-label="Filtrar por ubicación"
          >
            <option value="all">Todas las ubicaciones</option>
            {ubicaciones.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        )}
      </div>

      {/* Status chips */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-[13px] font-medium border transition-all duration-150 font-display',
              statusFilter === f.key
                ? 'bg-navy text-white border-navy'
                : 'text-navy-light/80 hover:text-navy hover:bg-surface-low border-transparent'
            )}
          >
            {f.label}
            {f.key === 'pending' && pending > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 text-white text-[11px] px-1.5 py-0.5 font-display">
                {pending}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Bulk bar */}
      <BulkActionBar count={sel.count} onClear={sel.clear} noun="aplicaciones">
        <button
          onClick={() => setConfirm('approve')}
          className="rounded-full bg-teal-deep px-3.5 py-1.5 text-[13px] text-white hover:opacity-90 transition-opacity font-body"
        >
          Aprobar
        </button>
        <button
          onClick={() => setConfirm('reject')}
          className="rounded-full border border-white/30 px-3.5 py-1.5 text-[13px] text-white hover:bg-white/10 transition-colors font-body"
        >
          No seleccionar
        </button>
      </BulkActionBar>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    className="accent-coral"
                    aria-label="Seleccionar todas"
                    checked={sel.allSelected && filtered.length > 0}
                    ref={el => { if (el) el.indeterminate = sel.someSelected }}
                    onChange={sel.toggleAll}
                  />
                </th>
                {['Aplicante', 'Puesto / Comité', 'Área', 'Fecha', 'Estado', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, idx) => (
                <tr key={a.id} className={cn('transition-colors', sel.isSelected(a.id) ? 'bg-coral/5' : idx % 2 === 1 ? 'bg-surface-low/40' : '')}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="accent-coral"
                      aria-label={`Seleccionar ${a.applicant_name}`}
                      checked={sel.isSelected(a.id)}
                      onChange={() => sel.toggle(a.id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-navy flex items-center justify-center shrink-0">
                        <span className="text-[11px] font-bold text-white font-display">{a.applicant_initials}</span>
                      </div>
                      <span className="text-sm font-medium text-navy font-body">{a.applicant_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[13px] font-medium text-navy font-body">{a.vacancy_title}</p>
                    <p className="text-[13px] text-navy-light/80 font-body">{a.committee_name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-navy/10 px-2 py-0.5 text-[11px] font-medium text-navy-light/80 font-display">{a.area}</span>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-navy-light/80 whitespace-nowrap font-body">
                    {formatDate(a.applied_at)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold font-display', APP_STATUS_COLORS[a.status])}>
                      {APP_STATUS_LABELS[a.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* SRV-14 · La hoja con el tema de Theos, lista para
                          guardar como PDF desde el navegador. Es una página y
                          no un archivo generado para que use el MISMO CSS de
                          marca del resto del sistema, y para que el PDF que
                          sale tenga el texto seleccionable — el encargado
                          necesita COPIAR el teléfono del dirigente. */}
                      <Link
                        href={`/servidores/aplicaciones/${a.id}/hoja`}
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--outline-variant)] px-2.5 py-1 text-[13px] text-navy-light hover:bg-surface-low transition-colors font-body"
                      >
                        <Printer size={11} /> Hoja
                      </Link>
                      {/* Abre el MISMO panel que el tab de la vacante. Se
                          llama «Ver aplicación» y no «Revisar» para que haga
                          par con «Ver puesto», que está al lado: son las dos
                          caras de la misma fila. */}
                      <button
                        type="button"
                        onClick={() => setRevisando(a)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--outline-variant)] px-2.5 py-1 text-[13px] text-navy-light hover:bg-surface-low transition-colors font-body"
                      >
                        Ver aplicación <ChevronRight size={11} />
                      </button>
                      <Link
                        href={`/servidores/vacantes/${a.vacancy_id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--outline-variant)] px-2.5 py-1 text-[13px] text-navy-light hover:bg-surface-low transition-colors font-body"
                      >
                        Ver puesto <ChevronRight size={11} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: tarjetas */}
        <ul className="md:hidden">
          {filtered.map((a, i) => (
            <li key={a.id} style={i < filtered.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}>
              <div className="flex items-center gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  className="accent-coral shrink-0"
                  aria-label={`Seleccionar ${a.applicant_name}`}
                  checked={sel.isSelected(a.id)}
                  onChange={() => sel.toggle(a.id)}
                />
                <Link href={`/servidores/vacantes/${a.vacancy_id}`} className="flex items-center gap-3 min-w-0 flex-1 active:opacity-70">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-navy font-body">{a.applicant_name}</p>
                    <p className="truncate text-[13px] text-navy-light/80 font-body">{a.vacancy_title} · {a.committee_name}</p>
                  </div>
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold font-display', APP_STATUS_COLORS[a.status])}>
                    {APP_STATUS_LABELS[a.status]}
                  </span>
                </Link>
              </div>
            </li>
          ))}
        </ul>

        {filtered.length === 0 && (
          loading
            ? <p className="px-4 py-8 text-center text-sm text-navy-light/80 font-body">Cargando aplicaciones…</p>
            : <EmptyState icon={ClipboardList} title="No hay aplicaciones con ese filtro" />
        )}

        {filtered.length > 0 && (
          <LoadMoreFooter shown={filtered.length} total={total} hasMore={hasMore} loading={loading} onLoadMore={loadMore} noun="aplicaciones" increment={25} />
        )}
      </div>

      {/* Confirmación de bulk */}
      {confirm && (
        <Modal onClose={() => !busy && setConfirm(null)} titleId="confirm-bulk-title" width={420}>
          <div className="p-6 space-y-4">
            <h3 id="confirm-bulk-title" className="text-base font-bold text-navy font-display">
              {confirm === 'approve' ? 'Aprobar aplicaciones' : 'Marcar como no seleccionadas'}
            </h3>
            <p className="text-sm text-navy-light/80 font-body">
              {confirm === 'approve' ? (
                <><strong className="text-navy">{sel.count}</strong> aplicación{sel.count !== 1 ? 'es' : ''} pasará{sel.count !== 1 ? 'n' : ''} a <strong className="text-navy">Aprobada</strong>. Cada aplicante quedará activo como servidor del puesto y comité al que aplicó.</>
              ) : (
                <><strong className="text-navy">{sel.count}</strong> aplicación{sel.count !== 1 ? 'es' : ''} pasará{sel.count !== 1 ? 'n' : ''} a <strong className="text-navy">No seleccionada</strong>.</>
              )}
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => runBulk(confirm)}
                disabled={busy}
                className={cn(
                  'flex-1 rounded-full px-4 py-2.5 text-sm text-white transition-colors font-body inline-flex items-center justify-center gap-2',
                  confirm === 'approve' ? 'bg-teal-deep hover:opacity-90' : 'bg-coral hover:bg-coral-deep',
                  busy && 'opacity-60 cursor-not-allowed',
                )}
              >
                {busy ? <><Loader2 size={15} className="animate-spin" /> Aplicando…</> : 'Confirmar'}
              </button>
              <button
                onClick={() => setConfirm(null)}
                disabled={busy}
                className="rounded-full border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
              >
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* SRV-14 · Cambiar el estado, con el motivo cuando corresponde. */}
      {/* El panel de revisión, el MISMO del tab de aplicaciones de la
          vacante: se extrajo a un componente porque eran dos paneles con la
          misma intención y ya se había visto a dónde lleva eso. */}
      {revisando && (
        <Modal onClose={() => setRevisando(null)} titleId="revisar-aplicacion-title">
          <div className="p-4">
            <h2 id="revisar-aplicacion-title" className="sr-only">
              Revisar la aplicación de {revisando.applicant_name}
            </h2>
            <PanelDeAplicacion
              app={revisando}
              puedeGestionar={puedeGestionar}
              // El Modal ya pone la X y ya es la tarjeta.
              dentroDeModal
              onClose={() => setRevisando(null)}
              onSaved={(estado) => {
                setRevisando(null)
                toast(`Quedó como «${APPLICATION_STATE_LABEL[estado]}»`, 'success')
                reload(); reloadCounts()
              }}
              onError={(m) => toast(m, 'error')}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
