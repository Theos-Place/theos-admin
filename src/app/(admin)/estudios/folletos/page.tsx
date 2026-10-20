'use client'

import { useState, useMemo, useCallback } from 'react'
import { useCargaRemota, json } from '@/hooks/useCargaRemota'
import { resumenDelLote, type ResultadoPorTiquete } from '@/lib/studies/cambio-de-estado-folleto'
import { modalidadDe } from '@/lib/studies/modalidad-de-bloques'
import Link from 'next/link'
import { usePermissions } from '@/hooks/usePermissions'
import { useRowSelection } from '@/hooks/useRowSelection'
import { BulkActionBar } from '@/components/shared/BulkActionBar'
import { Modal } from '@/components/shared/Modal'
import { AccessDenied } from '@/components/shared/AccessDenied'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/lib/utils'
import { FileText, Loader2, Check, ChevronRight, MapPin, Download } from 'lucide-react'
import { RangoDeFechas, Buscador, SelectRotulado } from '@/components/finance/BarraDeReporte'
import {
  PESTANA, BARRA, BARRA_IZQ, BARRA_DER, BOTON_PRIMARIO,
  TARJETA, TARJETA_ETIQUETA, TARJETA_VALOR, VALOR_NEUTRO, VALOR_DINERO, VALOR_PENDIENTE,
} from '@/components/finance/reporte-ui'
import { descargarExcel, enRango } from '@/lib/finance/descargar-excel'
import { formatDate } from '@/lib/format'
import type { DbFolletoRequest } from '@/lib/supabase/queries/folletos'
import { nombreConDirigente,
  FOLLETO_STATES, FOLLETO_STATE_LABEL, FOLLETO_STATE_BADGE, nextFolletoState,
  etiquetaDeFolletos, levelLabel, type FolletoState,
} from '@/lib/studies/folletos'
import { FOLLETO_TIPO_LABEL, FOLLETO_TIPO_BADGE, type FolletoTipo } from '@/lib/studies/bloques'
import { textoDesgloseCorto } from '@/lib/studies/folleto-desglose'
import { ManualFolletoRequestButton } from '@/components/studies/ManualFolletoRequestButton'

/** Vacío con identidad estable: `datos ?? []` sería un array nuevo por render. */
const SIN_DATOS: DbFolletoRequest[] = []

const STATUS_FILTERS: { key: FolletoState | 'all'; label: string }[] = [
  { key: 'all', label: 'Todos' },
  ...FOLLETO_STATES.map(s => ({ key: s, label: FOLLETO_STATE_LABEL[s] })),
]

const TIPO_FILTERS: { key: FolletoTipo | 'all'; label: string }[] = [
  { key: 'all', label: 'Todos los tipos' },
  { key: 'cierre', label: 'Cierre' },
  { key: 'preapertura_preliminar', label: 'Preliminar' },
  { key: 'preapertura_confirmacion', label: 'Confirmación' },
  { key: 'preapertura_final', label: 'Final' },
  { key: 'manual', label: 'Manual' },
]


export default function FolletosPage() {
  const { can, loaded } = usePermissions()
  const canView = can('folletos', 'view')
  const canEdit = can('folletos', 'edit')

  const [sedeFilter, setSedeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<FolletoState | 'all'>('all')
  const [tipoFilter, setTipoFilter] = useState<FolletoTipo | 'all'>('all')
  // Rango por la fecha en que se creó el tiquete y búsqueda: el orden de los
  // reportes de finanzas (2026-10-20).
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  /** FOL-2 · Los que NO se movieron, con el motivo de cada uno. */
  const [noMovidos, setNoMovidos] = useState<ResultadoPorTiquete[]>([])
  const [confirm, setConfirm] = useState<FolletoState | null>(null)

  // LINT-1 · «cargando» se deriva (useCargaRemota), no se enciende a mano.
  const { datos, cargando: loading, recargar: refetch } = useCargaRemota<DbFolletoRequest[]>(
    'folletos', () => json<DbFolletoRequest[]>('/api/studies/folletos', 'No se pudieron cargar los folletos.'), { activo: canView },
  )
  const rows = datos ?? SIN_DATOS

  const sedeOptions = useMemo(
    () => Array.from(new Set(rows.map(r => r.sede).filter((s): s is string => !!s))).sort((a, b) => a.localeCompare(b)),
    [rows],
  )
  /** El origen en texto: lo que se ve en la columna, para buscar y exportar. */
  const origenDe = (r: DbFolletoRequest) => r.tipo === 'cierre'
    ? nombreConDirigente(r.source_group?.name, r.source_group?.dirigente)
    : r.tipo === 'manual'
      ? [etiquetaDeFolletos(r.source_plan_code, modalidadDe(r.source_group?.modalidad)) || (r.target_level_code ? levelLabel(r.target_level_code) : ''),
         r.target_leader_name || (r.target_leader ? [r.target_leader.first_name, r.target_leader.last_name].filter(Boolean).join(' ') : '')].filter(Boolean).join(' · ')
      : (r.bloque?.nombre ?? '')
  // Rango, búsqueda, sede y tipo, SIN el estado: de acá salen las tarjetas.
  const sinEstado = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return rows.filter(r =>
      enRango(r.created_at, desde, hasta) &&
      (!q || origenDe(r).toLowerCase().includes(q) || (r.sede ?? '').toLowerCase().includes(q)) &&
      (sedeFilter === 'all' || r.sede === sedeFilter) &&
      (tipoFilter === 'all' || r.tipo === tipoFilter))
  }, [rows, sedeFilter, tipoFilter, desde, hasta, busqueda])
  const filtered = useMemo(() => sinEstado.filter(r => statusFilter === 'all' || r.status === statusFilter), [sinEstado, statusFilter])
  const hayFiltros = sedeFilter !== 'all' || statusFilter !== 'all' || tipoFilter !== 'all' || desde !== '' || hasta !== '' || busqueda !== ''
  const limpiarFiltros = () => { setSedeFilter('all'); setStatusFilter('all'); setTipoFilter('all'); setDesde(''); setHasta(''); setBusqueda('') }

  const sel = useRowSelection(filtered.map(r => r.id))

  const applyStatus = useCallback(async (ids: string[], status: FolletoState) => {
    if (busy || ids.length === 0) return
    setBusy(true); setMsg(null); setNoMovidos([])
    try {
      const res = await fetch('/api/studies/folletos/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, status }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudo actualizar.')
      // FOL-2 · El resumen dice CUÁNTOS de cuántos y, si alguno no se movió,
      // por qué. El texto viejo («0 folletos → En impresión») se leía como
      // que había funcionado.
      setMsg(resumenDelLote(data.resultados ?? [], FOLLETO_STATE_LABEL[status]))
      setNoMovidos((data.resultados ?? []).filter((r: { movido: boolean }) => !r.movido))
      sel.clear(); setConfirm(null); refetch()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error desconocido')
      setNoMovidos([])
    } finally { setBusy(false) }
  }, [busy, sel, refetch])

  if (loaded && !canView) return <AccessDenied />

  return (
    <div className={PESTANA}>
      <div className="rounded-2xl bg-navy px-5 sm:px-6 py-5 shadow-[var(--shadow-md)]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
              <FileText size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl text-white font-display font-extrabold tracking-[-0.02em]">Folletos</h1>
              <p className="mt-0.5 text-sm text-white/80 font-body">{filtered.length} solicitud{filtered.length !== 1 ? 'es' : ''}</p>
            </div>
          </div>
        </div>
      </div>

      {msg && (
        <div className="rounded-xl bg-surface-low px-4 py-2.5 space-y-1.5">
          <p className="text-sm text-navy-light/80 font-body inline-flex items-center gap-1.5">
            {noMovidos.length === 0 && <Check size={14} className="text-teal-deep" />}
            {msg}
          </p>
          {/* FOL-2 · Por qué no se movieron. Sin esto el lote se veía como un
              éxito a medias sin explicación, que es el bug reportado. */}
          {noMovidos.length > 0 && (
            <ul className="space-y-0.5">
              {/* Los motivos se AGRUPAN: cinco tiquetes con la misma razón
                  son una línea con «(5)», no cinco líneas iguales. */}
              {[...noMovidos.reduce((m, r) => {
                const motivo = r.movido === false ? r.motivo : ''
                return m.set(motivo, (m.get(motivo) ?? 0) + 1)
              }, new Map<string, number>())].map(([motivo, n]) => (
                <li key={motivo} className="text-[13px] text-coral-deep font-body">
                  · {motivo}{n > 1 ? ` (${n})` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Orden de los reportes de finanzas (2026-10-20). */}
      <div className={BARRA}>
        <div className={BARRA_IZQ}>
          <RangoDeFechas id="folleto" etiqueta="Creado desde" desde={desde} hasta={hasta} onDesde={setDesde} onHasta={setHasta} />
        </div>
        <div className={BARRA_DER}>
          {canEdit && <ManualFolletoRequestButton onCreated={refetch} />}
          <button type="button" disabled={filtered.length === 0} className={BOTON_PRIMARIO}
            onClick={() => void descargarExcel('folletos', ['Tipo', 'Origen', 'Total a imprimir', 'Desglose', 'Entrega en', 'Estado', 'Creado'],
              filtered.map(r => [FOLLETO_TIPO_LABEL[r.tipo as FolletoTipo] ?? r.tipo, origenDe(r), r.desglose.total, textoDesgloseCorto(r.desglose),
                r.sede ?? '', FOLLETO_STATE_LABEL[r.status as FolletoState] ?? r.status, formatDate(r.created_at)]))}>
            <Download size={14} aria-hidden /> Descargar Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {FOLLETO_STATES.map((st, i) => (
          <div key={st} className={TARJETA}>
            <p className={TARJETA_ETIQUETA}>{FOLLETO_STATE_LABEL[st]}</p>
            <p className={cn(TARJETA_VALOR, [VALOR_PENDIENTE, VALOR_NEUTRO, VALOR_DINERO, VALOR_NEUTRO][i])}>
              {sinEstado.filter(r => r.status === st).length}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Buscador valor={busqueda} onCambio={setBusqueda} placeholder="Buscar por grupo, dirigente o sede…" />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <SelectRotulado id="folleto-sede" etiqueta="Sede" valor={sedeFilter} onCambio={setSedeFilter}
            opciones={[{ value: 'all', label: 'Todas' }, ...sedeOptions.map(x => ({ value: x, label: x }))]} />
          <SelectRotulado id="folleto-tipo" etiqueta="Tipo" valor={tipoFilter} onCambio={v => setTipoFilter(v as FolletoTipo | 'all')}
            opciones={TIPO_FILTERS.map(t => ({ value: t.key, label: t.key === 'all' ? 'Todos' : t.label }))} />
          <SelectRotulado id="folleto-estado" etiqueta="Estado" valor={statusFilter} onCambio={v => setStatusFilter(v as FolletoState | 'all')}
            opciones={STATUS_FILTERS.map(f => ({ value: f.key, label: f.label }))} />
        </div>
      </div>

      {/* Bulk */}
      {canEdit && (
        <BulkActionBar count={sel.count} onClear={sel.clear} noun="folletos">
          {FOLLETO_STATES.filter(s => s !== 'creada').map(s => (
            <button
              key={s}
              onClick={() => setConfirm(s)}
              className="rounded-full border border-white/30 px-3.5 py-1.5 text-[13px] text-white hover:bg-white/10 transition-colors font-body"
            >
              {FOLLETO_STATE_LABEL[s]}
            </button>
          ))}
        </BulkActionBar>
      )}

      {/* Tabla */}
      <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
        {loading ? (
          <p className="px-4 py-10 text-center text-sm text-navy-light/80 font-body inline-flex items-center gap-2 justify-center w-full"><Loader2 size={15} className="animate-spin" /> Cargando…</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon={FileText} title="No hay solicitudes de folletos con esos filtros" onLimpiarFiltros={hayFiltros ? limpiarFiltros : undefined} />

        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {canEdit && (
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox" className="accent-coral" aria-label="Seleccionar todos"
                        checked={sel.allSelected && filtered.length > 0}
                        ref={el => { if (el) el.indeterminate = sel.someSelected }}
                        onChange={sel.toggleAll}
                      />
                    </th>
                  )}
                  {['Tipo', 'Origen', 'Cantidad', 'Entrega en', 'Estado', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] tracking-widest uppercase text-navy-light/80 font-display whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => {
                  const next = nextFolletoState(r.status)
                  return (
                    <tr key={r.id} className={cn('transition-colors', sel.isSelected(r.id) ? 'bg-coral/5' : idx % 2 === 1 ? 'bg-surface-low/40' : '')}>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <input type="checkbox" className="accent-coral" aria-label={`Seleccionar folleto ${r.sede ?? ''}`} checked={sel.isSelected(r.id)} onChange={() => sel.toggle(r.id)} />
                        </td>
                      )}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold font-display', FOLLETO_TIPO_BADGE[(r.tipo as FolletoTipo)] ?? '')}>
                          {FOLLETO_TIPO_LABEL[(r.tipo as FolletoTipo)] ?? r.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-navy-light/80 font-body">
                        {r.tipo === 'cierre' ? (
                          <>{nombreConDirigente(r.source_group?.name, r.source_group?.dirigente)}{r.target_level_code && <span className="text-navy-light/80"> · → {etiquetaDeFolletos(r.source_plan_code, modalidadDe(r.source_group?.modalidad)) || levelLabel(r.target_level_code)}</span>}</>
                        ) : r.tipo === 'manual' ? (
                          <>
                            {(() => {
                              const leader = r.target_leader_name || (r.target_leader ? [r.target_leader.first_name, r.target_leader.last_name].filter(Boolean).join(' ') : '')
                              return <span>{etiquetaDeFolletos(r.source_plan_code, modalidadDe(r.source_group?.modalidad)) || (r.target_level_code ? levelLabel(r.target_level_code) : '—')}{leader ? ` · ${leader}` : ''}</span>
                            })()}
                            {r.note && <span className="block text-navy-light/80 text-[13px] italic">“{r.note}”</span>}
                          </>
                        ) : (r.bloque?.nombre ?? '—')}
                      </td>
                      {/* El TOTAL a imprimir, con el desglose debajo. `quantity`
                          sola es solo la parte de estudiantes: el dirigente y el
                          co-dirigente también llevan folleto, y quien imprime
                          necesita el número completo. */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-semibold text-navy tabular-nums font-display">
                          {r.desglose.total}
                        </span>
                        <span className="block text-[11px] text-navy-light font-body">
                          {textoDesgloseCorto(r.desglose)}
                        </span>
                      </td>
                      {/* Destino DESTACADO: es el dato que usa quien organiza
                          la entrega para armar los paquetes, no un atributo más
                          de la fila. Un tiquete sin destino se marca en rojo en
                          vez de mostrar un guion, que se lee como "no aplica". */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {r.sede ? (
                          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy font-body">
                            <MapPin size={13} className="text-teal-deep shrink-0" aria-hidden />
                            {r.sede}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-coral-deep font-body">
                            <MapPin size={13} className="shrink-0" aria-hidden />
                            Sin destino
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold font-display', FOLLETO_STATE_BADGE[r.status])}>
                          {FOLLETO_STATE_LABEL[r.status]}
                        </span>
                      </td>
                      {/* El estado de pago y la fecha estimada se movieron al
                          detalle: la fila queda con lo que se usa para armar los
                          paquetes, y lo demás está a un clic. */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            href={`/estudios/folletos/${r.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-[var(--outline-variant)] px-2.5 py-1 text-[13px] text-navy-light hover:bg-surface-low transition-colors font-body"
                          >
                            Ver <ChevronRight size={12} aria-hidden />
                          </Link>
                          {canEdit && next && (
                            <button
                              onClick={() => applyStatus([r.id], next)}
                              disabled={busy}
                              className="inline-flex items-center gap-1 rounded-lg border border-[var(--outline-variant)] px-2.5 py-1 text-[13px] text-navy-light hover:bg-surface-low transition-colors disabled:opacity-50 font-body"
                            >
                              {FOLLETO_STATE_LABEL[next]} <ChevronRight size={12} aria-hidden />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmación bulk */}
      {confirm && (
        <Modal onClose={() => !busy && setConfirm(null)} titleId="confirm-folleto-title" width={420}>
          <div className="p-6 space-y-4">
            <h3 id="confirm-folleto-title" className="text-base font-bold text-navy font-display">Cambiar estado</h3>
            <p className="text-sm text-navy-light/80 font-body">
              <strong className="text-navy">{sel.count}</strong> folleto{sel.count !== 1 ? 's' : ''} pasará{sel.count !== 1 ? 'n' : ''} a <strong className="text-navy">{FOLLETO_STATE_LABEL[confirm]}</strong>.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => applyStatus(sel.selectedIds, confirm)}
                disabled={busy}
                className={cn('flex-1 rounded-full px-4 py-2.5 text-sm text-white transition-colors font-body inline-flex items-center justify-center gap-2 bg-teal-deep hover:opacity-90', busy && 'opacity-60 cursor-not-allowed')}
              >
                {busy ? <><Loader2 size={15} className="animate-spin" /> Aplicando…</> : 'Confirmar'}
              </button>
              <button onClick={() => setConfirm(null)} disabled={busy} className="rounded-full border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body">Cancelar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
