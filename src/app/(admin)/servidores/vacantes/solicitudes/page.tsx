'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'
import { cn } from '@/lib/utils'
import { ChevronLeft, Loader2, Check, Download, ClipboardList } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { BulkActionBar } from '@/components/shared/BulkActionBar'
import { ColumnSelector, type ColumnDef } from '@/components/shared/ColumnSelector'
import { Modal } from '@/components/shared/Modal'
import { useRowSelection } from '@/hooks/useRowSelection'
import { generateCSV } from '@/lib/export'
import type { DbVacancy } from '@/lib/supabase/queries/servers'
import {
  VACANCY_STATES, VACANCY_STATE_LABEL, VACANCY_STATE_BADGE, isVacancyState, type VacancyState,
} from '@/lib/servers/vacancy-states'

type Row = {
  id: string
  committee_id: string
  committee_name: string
  title: string
  slots_total: number
  status: VacancyState
  application_count: number
  created_at: string
}

type ApplicantRow = Record<string, string>

const APPLICANT_COLUMNS: ColumnDef<ApplicantRow>[] = [
  { key: 'nombre', label: 'Nombre', defaultVisible: true, alwaysVisible: true, exportValue: r => r.nombre ?? '' },
  { key: 'cedula', label: 'Cédula', defaultVisible: true, exportValue: r => r.cedula ?? '' },
  { key: 'email', label: 'Correo', defaultVisible: true, exportValue: r => r.email ?? '' },
  { key: 'telefono', label: 'Teléfono', defaultVisible: true, exportValue: r => r.telefono ?? '' },
  { key: 'provincia', label: 'Provincia', defaultVisible: false, exportValue: r => r.provincia ?? '' },
  { key: 'historial_estudios', label: 'Historial de estudios', defaultVisible: true, exportValue: r => r.historial_estudios ?? '' },
  { key: 'sede', label: 'Sede', defaultVisible: true, exportValue: r => r.sede ?? '' },
  { key: 'miembro_activo', label: 'Miembro activo', defaultVisible: true, exportValue: r => r.miembro_activo ?? '' },
  { key: 'servicios_activos', label: 'Servicios activos', defaultVisible: true, exportValue: r => r.servicios_activos ?? '' },
  { key: 'puesto_aplicado', label: 'Puesto al que aplicó', defaultVisible: true, alwaysVisible: true, exportValue: r => r.puesto_aplicado ?? '' },
]

const STATUS_FILTERS: { key: VacancyState | 'all'; label: string }[] = [
  { key: 'all', label: 'Todos' },
  ...VACANCY_STATES.map(s => ({ key: s, label: VACANCY_STATE_LABEL[s] })),
]

export default function SolicitudesVacantesPage() {
  const { hasRole } = useAuth()
  const isAdmin = hasRole(...SERVICE_ADMIN_ROLES)

  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [committeeFilter, setCommitteeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<VacancyState | 'all'>('all')

  const refetch = useCallback(() => {
    setLoading(true)
    fetch('/api/servers/vacancies')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: DbVacancy[]) => {
        const mapped: Row[] = (Array.isArray(d) ? d : [])
          .filter(v => isVacancyState(v.status))
          .map(v => ({
            id: v.id,
            committee_id: v.committee_id,
            committee_name: v.committee?.name ?? '',
            title: v.title,
            slots_total: v.slots_total,
            status: v.status as VacancyState,
            application_count: v.applications?.[0]?.count ?? 0,
            created_at: v.created_at,
          }))
        setRows(mapped)
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { refetch() }, [refetch])

  const committeeOptions = useMemo(() => {
    const m = new Map<string, string>()
    rows.forEach(r => m.set(r.committee_id, r.committee_name))
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [rows])

  const filtered = useMemo(() => rows.filter(r =>
    (committeeFilter === 'all' || r.committee_id === committeeFilter) &&
    (statusFilter === 'all' || r.status === statusFilter),
  ), [rows, committeeFilter, statusFilter])

  const sel = useRowSelection(filtered.map(r => r.id))

  // Bulk de estado.
  const [confirm, setConfirm] = useState<VacancyState | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function runBulk(status: VacancyState) {
    if (busy || sel.count === 0) return
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/servers/vacancies/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ids: sel.selectedIds }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudo aplicar.')
      setMsg(`${data.updated} vacante${data.updated !== 1 ? 's' : ''} → ${VACANCY_STATE_LABEL[status]}.`)
      sel.clear(); setConfirm(null); refetch()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error desconocido')
    } finally { setBusy(false) }
  }

  // Export de aplicantes (selección, o todo lo filtrado si no hay selección).
  const [visibleCols, setVisibleCols] = useState<ColumnDef<ApplicantRow>[]>(APPLICANT_COLUMNS.filter(c => c.defaultVisible))
  const [exporting, setExporting] = useState(false)
  async function exportApplicants() {
    if (exporting) return
    const ids = sel.count > 0 ? sel.selectedIds : filtered.map(r => r.id)
    if (ids.length === 0) return
    setExporting(true); setMsg(null)
    try {
      const res = await fetch('/api/servers/vacancies/export-applicants', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vacancy_ids: ids }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudo exportar.')
      const applicants: ApplicantRow[] = data.rows ?? []
      if (applicants.length === 0) { setMsg('No hay aplicantes en las vacantes seleccionadas.'); return }
      const cols = visibleCols.filter(c => c.exportable !== false)
      const headers = cols.map(c => c.label)
      const csvRows = applicants.map(a => cols.map(c => c.exportValue?.(a) ?? ''))
      generateCSV(headers, csvRows, 'aplicantes-vacantes')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error desconocido')
    } finally { setExporting(false) }
  }

  return (
    <div className="space-y-4">
      <Link href="/servidores/vacantes" className="inline-flex items-center gap-1.5 text-[13px] text-navy-light/60 hover:text-navy-light transition-colors font-body">
        <ChevronLeft size={15} /> Puestos de Servicio
      </Link>

      <div className="rounded-2xl bg-navy px-5 sm:px-6 py-5 flex items-start justify-between gap-4 shadow-[var(--shadow-md)]">
        <div>
          <h1 className="text-2xl text-white font-display font-extrabold tracking-[-0.02em]">Solicitudes de vacantes</h1>
          <p className="mt-1 text-sm text-white/70 font-body">{filtered.length} solicitud{filtered.length !== 1 ? 'es' : ''}</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            <ColumnSelector columns={APPLICANT_COLUMNS} storageKey="vacancy-applicants-columns" onChange={setVisibleCols} />
            <button
              onClick={exportApplicants}
              disabled={exporting || filtered.length === 0}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors disabled:opacity-40 font-body"
            >
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {sel.count > 0 ? `Exportar aplicantes (${sel.count})` : `Exportar todo (${filtered.length})`}
            </button>
          </div>
        )}
      </div>

      {msg && (
        <p className="rounded-xl bg-surface-low px-4 py-2 text-sm text-navy-light/80 font-body inline-flex items-center gap-1.5">
          <Check size={14} className="text-teal-deep" /> {msg}
        </p>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={committeeFilter}
          onChange={e => setCommitteeFilter(e.target.value)}
          aria-label="Filtrar por comité"
          className="w-full sm:w-auto rounded-xl bg-surface-card px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 shadow-[var(--shadow-sm)] font-body"
        >
          <option value="all">Todos los comités</option>
          {committeeOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-[12px] font-medium border transition-all duration-150 font-display',
                statusFilter === f.key ? 'bg-navy text-white border-navy' : 'text-navy-light/60 hover:text-navy hover:bg-surface-low border-transparent',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk bar (solo admin/coordinación) */}
      {isAdmin && (
        <BulkActionBar count={sel.count} onClear={sel.clear} noun="vacantes">
          <button onClick={() => setConfirm('enviado_lider')} className="rounded-full border border-white/30 px-3.5 py-1.5 text-[12px] text-white hover:bg-white/10 transition-colors font-body">Enviar a líder</button>
          <button onClick={() => setConfirm('aprobado')} className="rounded-full bg-teal-deep px-3.5 py-1.5 text-[12px] text-white hover:opacity-90 transition-opacity font-body">Aprobar</button>
          <button onClick={() => setConfirm('denegado')} className="rounded-full bg-coral px-3.5 py-1.5 text-[12px] text-white hover:bg-coral-deep transition-colors font-body">Denegar</button>
        </BulkActionBar>
      )}

      {/* Tabla */}
      <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
        {loading ? (
          <p className="px-4 py-10 text-center text-sm text-navy-light/60 font-body inline-flex items-center gap-2 justify-center w-full"><Loader2 size={15} className="animate-spin" /> Cargando…</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No hay solicitudes con esos filtros" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {isAdmin && (
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox" className="accent-coral" aria-label="Seleccionar todas"
                        checked={sel.allSelected && filtered.length > 0}
                        ref={el => { if (el) el.indeterminate = sel.someSelected }}
                        onChange={sel.toggleAll}
                      />
                    </th>
                  )}
                  {['Puesto', 'Comité', 'Cupos', 'Aplicaciones', 'Estado'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] tracking-widest uppercase text-navy-light/60 font-display">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => (
                  <tr key={r.id} className={cn('transition-colors', sel.isSelected(r.id) ? 'bg-coral/5' : idx % 2 === 1 ? 'bg-surface-low/40' : '')}>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <input type="checkbox" className="accent-coral" aria-label={`Seleccionar ${r.title}`} checked={sel.isSelected(r.id)} onChange={() => sel.toggle(r.id)} />
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm font-medium text-navy font-body">{r.title}</td>
                    <td className="px-4 py-3 text-[13px] text-navy-light/70 font-body">{r.committee_name}</td>
                    <td className="px-4 py-3 text-[13px] text-navy-light/70 font-body">{r.slots_total}</td>
                    <td className="px-4 py-3 text-[13px] text-navy-light/70 font-body">
                      {r.application_count > 0 ? (
                        <Link href={`/servidores/vacantes/${r.id}`} className="text-navy underline underline-offset-2 hover:text-coral-deep">{r.application_count}</Link>
                      ) : '0'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold font-display', VACANCY_STATE_BADGE[r.status])}>
                        {VACANCY_STATE_LABEL[r.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmación bulk */}
      {confirm && (
        <Modal onClose={() => !busy && setConfirm(null)} titleId="confirm-vac-title" width={420}>
          <div className="p-6 space-y-4">
            <h3 id="confirm-vac-title" className="text-base font-bold text-navy font-display">Cambiar estado</h3>
            <p className="text-sm text-navy-light/70 font-body">
              <strong className="text-navy">{sel.count}</strong> vacante{sel.count !== 1 ? 's' : ''} pasará{sel.count !== 1 ? 'n' : ''} a <strong className="text-navy">{VACANCY_STATE_LABEL[confirm]}</strong>.
            </p>
            <div className="flex gap-2 pt-1">
              <button onClick={() => runBulk(confirm)} disabled={busy} className={cn('flex-1 rounded-full px-4 py-2.5 text-sm text-white transition-colors font-body inline-flex items-center justify-center gap-2', confirm === 'denegado' ? 'bg-coral hover:bg-coral-deep' : 'bg-teal-deep hover:opacity-90', busy && 'opacity-60 cursor-not-allowed')}>
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
