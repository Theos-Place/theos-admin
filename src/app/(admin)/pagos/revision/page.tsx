'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { useRowSelection } from '@/hooks/useRowSelection'
import { BulkActionBar } from '@/components/shared/BulkActionBar'
import { AccessDenied } from '@/components/shared/AccessDenied'
import { EmptyState } from '@/components/shared/EmptyState'
import { Modal } from '@/components/shared/Modal'
import { useToast } from '@/components/shared/Toast'
import { cn } from '@/lib/utils'
import { CreditCard, Loader2, AlertTriangle, Image as ImageIcon } from 'lucide-react'

type PaymentConcept = 'matricula' | 'folletos' | 'evento'
type QueueStatus = 'pendiente' | 'en_revision' | 'cerrado'

type QueueRow = {
  id: string
  member_id: string
  member_name: string
  concept: PaymentConcept | null
  description: string
  amount: number
  currency: string
  reference_code: string | null
  receipt_path: string | null
  created_at: string
  reviewed_at: string | null
  queue_status: QueueStatus
  duplicate_reference: boolean
}

const CONCEPT_LABEL: Record<string, string> = { matricula: 'Matrícula', folletos: 'Folletos', evento: 'Evento' }
type ConceptFilter = 'all' | PaymentConcept

// 'all' = lo accionable (pendiente + en_revision) — mismo criterio del backend
// cuando no se manda status. 'cerrado' es historial, acotado server-side.
type StatusTab = 'all' | QueueStatus
const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: 'Todos los activos' },
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'en_revision', label: 'En revisión' },
  { key: 'cerrado', label: 'Cerrados' },
]
const QUEUE_STATUS_BADGE: Record<QueueStatus, { label: string; cls: string }> = {
  pendiente: { label: 'Pendiente', cls: 'bg-amber-50 text-amber-700' },
  en_revision: { label: 'En revisión', cls: 'bg-coral/10 text-coral' },
  cerrado: { label: 'Cerrado', cls: 'bg-teal-soft/30 text-teal-deep' },
}

function money(amount: number, currency: string) {
  return `${currency === 'USD' ? '$' : '₡'}${amount.toLocaleString('es-CR')}`
}

export default function RevisionPagosPage() {
  const { can } = usePermissions()
  const toast = useToast()
  const canView = can('revision_pagos', 'view')
  const canReview = can('revision_pagos', 'edit')

  const [rows, setRows] = useState<QueueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusTab>('all')
  const [conceptFilter, setConceptFilter] = useState<ConceptFilter>('all')
  // REV-1: filtros por plan y dirigente del grupo (solo aplican a matrícula).
  const [planFilter, setPlanFilter] = useState('all')
  const [leaderFilter, setLeaderFilter] = useState('all')
  const [options, setOptions] = useState<{ plans: { id: string; name: string }[]; leaders: { id: string; name: string }[] }>({ plans: [], leaders: [] })
  const [busyId, setBusyId] = useState<string | null>(null)
  const [approveTarget, setApproveTarget] = useState<QueueRow | null>(null)
  const [reject, setReject] = useState<QueueRow | null>(null)
  const [reason, setReason] = useState('')
  const [receipt, setReceipt] = useState<{ row: QueueRow; url: string | null; loading: boolean } | null>(null)

  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | null>(null)
  const [bulkReason, setBulkReason] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)

  // Detalle del tiquete (Fase 3b) + cierre manual con motivo.
  const [detail, setDetail] = useState<QueueRow | null>(null)
  const [closeTarget, setCloseTarget] = useState<QueueRow | null>(null)
  const [closeReason, setCloseReason] = useState('')

  const refetch = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (conceptFilter !== 'all') params.set('concept', conceptFilter)
    if (conceptFilter === 'matricula') {
      if (planFilter !== 'all') params.set('planId', planFilter)
      if (leaderFilter !== 'all') params.set('leaderId', leaderFilter)
    }
    fetch(`/api/payments/queue?${params.toString()}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: QueueRow[]) => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [statusFilter, conceptFilter, planFilter, leaderFilter])
  useEffect(() => { if (canView) refetch() }, [canView, refetch])

  // Opciones de los filtros de matrícula (planes activos + dirigentes con grupo).
  useEffect(() => {
    if (!canView) return
    fetch('/api/payments/queue/options')
      .then(r => (r.ok ? r.json() : { plans: [], leaders: [] }))
      .then(d => setOptions({ plans: d.plans ?? [], leaders: d.leaders ?? [] }))
      .catch(() => {})
  }, [canView])

  // La selección en lote solo tiene sentido sobre lo que se puede aprobar/rechazar.
  const filtered = rows
  const selectableIds = useMemo(() => filtered.filter(r => r.queue_status === 'en_revision').map(r => r.id), [filtered])
  const sel = useRowSelection(selectableIds)

  const openReceipt = useCallback(async (row: QueueRow) => {
    setReceipt({ row, url: null, loading: true })
    try {
      const res = await fetch(`/api/payments/${row.id}/receipt`)
      const data = await res.json().catch(() => null)
      setReceipt({ row, url: res.ok ? data?.url ?? null : null, loading: false })
    } catch {
      setReceipt({ row, url: null, loading: false })
    }
  }, [])

  async function approve(row: QueueRow) {
    if (busyId) return
    setBusyId(row.id)
    try {
      const res = await fetch(`/api/payments/${row.id}/review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'No se pudo aprobar.')
      toast(`Pago de ${row.member_name} aprobado.`, 'success')
      setApproveTarget(null)
      refetch()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error desconocido', 'error')
    } finally { setBusyId(null) }
  }

  async function doReject() {
    if (!reject || busyId || !reason.trim()) return
    setBusyId(reject.id)
    try {
      const res = await fetch(`/api/payments/${reject.id}/review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reason: reason.trim() }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'No se pudo rechazar.')
      toast(`Pago de ${reject.member_name} rechazado. Se avisó a la persona.`, 'success')
      setReject(null); setReason(''); refetch()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error desconocido', 'error')
    } finally { setBusyId(null) }
  }

  // Transición de estado sin motivo (poner en revisión / devolver a pendiente).
  async function transition(row: QueueRow, action: 'start_review' | 'reopen') {
    if (busyId) return
    setBusyId(row.id)
    try {
      const res = await fetch(`/api/payments/${row.id}/review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'No se pudo cambiar el estado.')
      toast(action === 'start_review' ? `Tiquete de ${row.member_name} puesto en revisión.` : `Tiquete de ${row.member_name} devuelto a pendiente.`, 'success')
      setDetail(null)
      refetch()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error desconocido', 'error')
    } finally { setBusyId(null) }
  }

  // Cierre manual sin cobro (status=failed) con motivo obligatorio.
  async function doClose() {
    if (!closeTarget || busyId || !closeReason.trim()) return
    setBusyId(closeTarget.id)
    try {
      const res = await fetch(`/api/payments/${closeTarget.id}/review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close', reason: closeReason.trim() }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'No se pudo cerrar el tiquete.')
      toast(`Tiquete de ${closeTarget.member_name} cerrado sin cobro.`, 'success')
      setCloseTarget(null); setCloseReason(''); setDetail(null); refetch()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error desconocido', 'error')
    } finally { setBusyId(null) }
  }

  async function doBulk() {
    if (!bulkAction || bulkBusy) return
    if (bulkAction === 'reject' && !bulkReason.trim()) return
    setBulkBusy(true)
    try {
      const res = await fetch('/api/payments/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: sel.selectedIds, action: bulkAction, reason: bulkAction === 'reject' ? bulkReason.trim() : undefined }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudo completar la acción en lote.')
      const okCount = bulkAction === 'approve' ? data.approved : data.rejected
      const failCount = (data.failed ?? []).length
      toast(
        failCount > 0
          ? `${okCount} pago${okCount !== 1 ? 's' : ''} ${bulkAction === 'approve' ? 'aprobado' : 'rechazado'}${okCount !== 1 ? 's' : ''}, ${failCount} no se pudo${failCount !== 1 ? 'ieron' : ''} procesar.`
          : `${okCount} pago${okCount !== 1 ? 's' : ''} ${bulkAction === 'approve' ? 'aprobado' : 'rechazado'}${okCount !== 1 ? 's' : ''}.`,
        failCount > 0 ? 'error' : 'success',
      )
      setBulkAction(null); setBulkReason(''); sel.clear(); refetch()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error desconocido', 'error')
    } finally { setBulkBusy(false) }
  }

  if (!canView) return <AccessDenied />

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-navy px-5 sm:px-6 py-5 shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
            <CreditCard size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl text-white font-display font-extrabold tracking-[-0.02em]">Pagos pendientes</h1>
            <p className="mt-0.5 text-sm text-white/70 font-body">
              {rows.length} pago{rows.length !== 1 ? 's' : ''} · {STATUS_TABS.find(t => t.key === statusFilter)?.label.toLowerCase()}
            </p>
          </div>
        </div>
      </div>

      {/* Filtro por estado de la cola */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setStatusFilter(t.key)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-[12px] font-medium border transition-all font-display',
              statusFilter === t.key ? 'bg-navy text-white border-navy' : 'text-navy-light/60 hover:text-navy border-transparent hover:border-navy/20',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filtro por concepto + filtros de matrícula (plan/dirigente, REV-1) */}
      <div className="flex items-center gap-2 flex-wrap">
        {([['all', 'Todos'], ['matricula', 'Matrícula'], ['evento', 'Evento'], ['folletos', 'Folletos']] as [ConceptFilter, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setConceptFilter(id)}
            className={cn(
              'rounded-full px-3 py-1 text-[11px] font-medium border transition-all font-display',
              conceptFilter === id ? 'bg-navy/80 text-white border-navy/80' : 'text-navy-light/60 hover:text-navy border-transparent hover:border-navy/20',
            )}
          >
            {label}
          </button>
        ))}
        <select
          aria-label="Filtrar por estudio o capacitación"
          value={planFilter}
          onChange={e => setPlanFilter(e.target.value)}
          disabled={conceptFilter !== 'matricula'}
          title={conceptFilter !== 'matricula' ? 'Disponible con el concepto Matrícula' : undefined}
          className="rounded-full border border-navy/15 bg-surface-card px-3 py-1 text-[11px] text-navy outline-none focus:border-navy/30 font-body disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <option value="all">Todos los estudios</option>
          {options.plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select
          aria-label="Filtrar por dirigente del grupo"
          value={leaderFilter}
          onChange={e => setLeaderFilter(e.target.value)}
          disabled={conceptFilter !== 'matricula'}
          title={conceptFilter !== 'matricula' ? 'Disponible con el concepto Matrícula' : undefined}
          className="rounded-full border border-navy/15 bg-surface-card px-3 py-1 text-[11px] text-navy outline-none focus:border-navy/30 font-body disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <option value="all">Todos los dirigentes</option>
          {options.leaders.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {canReview && sel.count > 0 && (
        <BulkActionBar count={sel.count} onClear={sel.clear} noun="pagos">
          <button
            onClick={() => setBulkAction('approve')}
            className="rounded-full bg-teal-deep px-3.5 py-1.5 text-[12px] text-white hover:opacity-90 transition-opacity font-body"
          >
            Aprobar seleccionados
          </button>
          <button
            onClick={() => { setBulkAction('reject'); setBulkReason('') }}
            className="rounded-full border border-white/25 text-white px-3.5 py-1.5 text-[12px] hover:bg-white/10 transition-colors font-body"
          >
            Rechazar seleccionados
          </button>
        </BulkActionBar>
      )}

      <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
        {loading ? (
          <p className="px-4 py-10 text-center text-sm text-navy-light/60 font-body inline-flex items-center gap-2 justify-center w-full"><Loader2 size={15} className="animate-spin" /> Cargando…</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon={CreditCard} title="No hay pagos con estos filtros" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {canReview && (
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        aria-label="Seleccionar todos"
                        checked={sel.allSelected}
                        ref={el => { if (el) el.indeterminate = sel.someSelected }}
                        onChange={sel.toggleAll}
                        disabled={selectableIds.length === 0}
                      />
                    </th>
                  )}
                  {['Persona', 'Descripción', 'Monto esperado', 'Estado', 'Referencia', 'Comprobante', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] tracking-widest uppercase text-navy-light/60 font-display whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => {
                  const badge = QUEUE_STATUS_BADGE[r.queue_status]
                  return (
                  <tr key={r.id} className={cn('transition-colors', idx % 2 === 1 ? 'bg-surface-low/40' : '')}>
                    {canReview && (
                      <td className="px-4 py-3">
                        {r.queue_status === 'en_revision' && (
                          <input type="checkbox" aria-label={`Seleccionar pago de ${r.member_name}`} checked={sel.isSelected(r.id)} onChange={() => sel.toggle(r.id)} />
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm font-medium text-navy font-body">{r.member_name}</td>
                    <td className="px-4 py-3 text-[13px] text-navy-light/80 font-body">
                      {r.concept && (
                        <span className="mr-1.5 inline-flex items-center rounded-md bg-navy/6 px-1.5 py-0.5 text-[10px] font-semibold text-navy font-display align-middle">
                          {CONCEPT_LABEL[r.concept]}
                        </span>
                      )}
                      {r.description}
                    </td>
                    <td className="px-4 py-3 text-sm text-navy font-body tabular-nums">{money(r.amount, r.currency)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold font-body', badge.cls)}>{badge.label}</span>
                    </td>
                    <td className="px-4 py-3 text-[13px] font-body">
                      <span className="text-navy-light/80">{r.reference_code ?? '—'}</span>
                      {r.duplicate_reference && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-[10px] font-semibold font-display align-middle" title="Este número de referencia aparece en otro pago — posible comprobante reutilizado.">
                          <AlertTriangle size={11} /> Referencia duplicada
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openReceipt(r)}
                        disabled={!r.receipt_path}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--outline-variant)] px-2.5 py-1 text-[11px] text-navy-light hover:bg-surface-low transition-colors disabled:opacity-40 font-body"
                      >
                        <ImageIcon size={12} /> Ver comprobante
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canReview && r.queue_status === 'en_revision' && (
                          <>
                            <button
                              onClick={() => setApproveTarget(r)}
                              disabled={busyId === r.id}
                              className="rounded-full bg-teal-deep px-3.5 py-1.5 text-[12px] text-white hover:opacity-90 transition-opacity disabled:opacity-50 font-body"
                            >
                              {busyId === r.id ? '…' : 'Aprobar'}
                            </button>
                            <button
                              onClick={() => { setReject(r); setReason('') }}
                              disabled={busyId === r.id}
                              className="rounded-full border border-coral/40 text-coral px-3.5 py-1.5 text-[12px] hover:bg-coral/5 transition-colors disabled:opacity-50 font-body"
                            >
                              Rechazar
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setDetail(r)}
                          className="rounded-full border border-[var(--outline-variant)] px-3 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors font-body"
                        >
                          Abrir
                        </button>
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

      {/* Comprobante (imagen vía URL firmada) */}
      {receipt && (
        <Modal onClose={() => setReceipt(null)} titleId="receipt-title" width={560}>
          <div className="p-5 space-y-3">
            <h3 id="receipt-title" className="text-base font-bold text-navy font-display">Comprobante · {receipt.row.member_name}</h3>
            {receipt.loading ? (
              <p className="text-sm text-navy-light/60 font-body inline-flex items-center gap-2 py-8"><Loader2 size={15} className="animate-spin" /> Cargando comprobante…</p>
            ) : receipt.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={receipt.url} alt="Comprobante de pago" className="w-full rounded-xl border border-[var(--outline-variant)]" />
            ) : (
              <p className="text-sm text-coral font-body py-6">No se pudo cargar el comprobante.</p>
            )}
          </div>
        </Modal>
      )}

      {/* Detalle del tiquete + transiciones de estado (Fase 3b) */}
      {detail && (() => {
        const badge = QUEUE_STATUS_BADGE[detail.queue_status]
        const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleString('es-CR', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
        const rows2: [string, string][] = [
          ['Persona', detail.member_name],
          ['Origen', detail.concept ? CONCEPT_LABEL[detail.concept] : 'Pago'],
          ['Descripción', detail.description],
          ['Monto esperado', money(detail.amount, detail.currency)],
          ['Referencia', detail.reference_code ?? '—'],
          ['Creado', fmtDate(detail.created_at)],
          ['Última gestión', fmtDate(detail.reviewed_at)],
        ]
        return (
        <Modal onClose={() => !busyId && setDetail(null)} titleId="detail-title" width={480}>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 id="detail-title" className="text-base font-bold text-navy font-display">Tiquete de pago</h3>
              <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold font-body', badge.cls)}>{badge.label}</span>
            </div>

            <div className="rounded-xl border border-outline overflow-hidden">
              {rows2.map(([label, value], i) => (
                <div key={label} className={cn('flex gap-3 px-4 py-2.5', i > 0 && 'border-t border-outline')}>
                  <span className="w-32 shrink-0 text-[11px] uppercase tracking-wider text-navy-light/60 font-display">{label}</span>
                  <span className="text-[13px] text-navy font-body">{value}</span>
                </div>
              ))}
            </div>

            {detail.receipt_path && (
              <button
                onClick={() => openReceipt(detail)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--outline-variant)] px-2.5 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors font-body"
              >
                <ImageIcon size={13} /> Ver comprobante
              </button>
            )}

            {canReview ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {detail.queue_status === 'pendiente' && (
                  <button
                    onClick={() => transition(detail, 'start_review')}
                    disabled={busyId === detail.id}
                    className="rounded-full bg-navy px-3.5 py-1.5 text-[12px] text-white hover:opacity-90 transition-opacity disabled:opacity-50 font-body"
                  >
                    {busyId === detail.id ? '…' : 'Poner en revisión'}
                  </button>
                )}
                {detail.queue_status === 'en_revision' && (
                  <>
                    <button
                      onClick={() => { const r = detail; setDetail(null); setApproveTarget(r) }}
                      disabled={busyId === detail.id}
                      className="rounded-full bg-teal-deep px-3.5 py-1.5 text-[12px] text-white hover:opacity-90 transition-opacity disabled:opacity-50 font-body"
                    >
                      Aprobar
                    </button>
                    <button
                      onClick={() => { const r = detail; setDetail(null); setReject(r); setReason('') }}
                      disabled={busyId === detail.id}
                      className="rounded-full border border-coral/40 text-coral px-3.5 py-1.5 text-[12px] hover:bg-coral/5 transition-colors disabled:opacity-50 font-body"
                    >
                      Rechazar
                    </button>
                    <button
                      onClick={() => transition(detail, 'reopen')}
                      disabled={busyId === detail.id}
                      className="rounded-full border border-[var(--outline-variant)] px-3.5 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors disabled:opacity-50 font-body"
                    >
                      Devolver a pendiente
                    </button>
                  </>
                )}
                {detail.queue_status !== 'cerrado' && (
                  <button
                    onClick={() => { setCloseTarget(detail); setCloseReason('') }}
                    disabled={busyId === detail.id}
                    className="rounded-full border border-[var(--outline-variant)] px-3.5 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors disabled:opacity-50 font-body"
                  >
                    Cerrar sin cobro
                  </button>
                )}
                {detail.queue_status === 'cerrado' && (
                  <p className="text-[13px] text-navy-light/60 font-body">Este tiquete ya está cerrado.</p>
                )}
              </div>
            ) : (
              <p className="text-[13px] text-navy-light/60 font-body">Solo lectura: no tenés permiso para gestionar pagos.</p>
            )}
          </div>
        </Modal>
        )
      })()}

      {/* Cierre manual sin cobro (motivo obligatorio) */}
      {closeTarget && (
        <Modal onClose={() => !busyId && setCloseTarget(null)} titleId="close-title" width={440}>
          <div className="p-6 space-y-3">
            <h3 id="close-title" className="text-base font-bold text-navy font-display">Cerrar tiquete sin cobro</h3>
            <p className="text-sm text-navy-light/70 font-body">
              El tiquete de <strong className="text-navy">{closeTarget.member_name}</strong> se cierra sin registrar pago
              (no activa matrícula ni inscripción). Queda en el historial con el motivo.
            </p>
            <textarea
              autoFocus
              value={closeReason}
              onChange={e => setCloseReason(e.target.value)}
              rows={3}
              placeholder="Motivo del cierre (obligatorio)…"
              aria-label="Motivo del cierre"
              className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 resize-none font-body"
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={doClose}
                disabled={!closeReason.trim() || !!busyId}
                className={cn('flex-1 rounded-full px-4 py-2.5 text-sm text-white transition-colors font-body inline-flex items-center justify-center gap-2 bg-coral hover:bg-coral-deep', (!closeReason.trim() || !!busyId) && 'opacity-50 cursor-not-allowed')}
              >
                {busyId ? <><Loader2 size={15} className="animate-spin" /> Cerrando…</> : 'Cerrar tiquete'}
              </button>
              <button onClick={() => setCloseTarget(null)} disabled={!!busyId} className="rounded-full border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body">Cancelar</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmación de aprobación (simétrico al rechazo: es la acción que
          activa la matrícula/pedido pagado y no tiene deshacer). */}
      {approveTarget && (
        <Modal onClose={() => !busyId && setApproveTarget(null)} titleId="approve-title" width={440}>
          <div className="p-6 space-y-3">
            <h3 id="approve-title" className="text-base font-bold text-navy font-display">Aprobar pago</h3>
            <p className="text-sm text-navy-light/70 font-body">
              ¿Aprobar el pago de <strong className="text-navy">{approveTarget.member_name}</strong>
              {approveTarget.concept ? ` (${CONCEPT_LABEL[approveTarget.concept]})` : ''} por {money(approveTarget.amount, approveTarget.currency)}?
              El pago quedará como pagado y activará lo que corresponda (p. ej. la matrícula o la inscripción al evento).
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => approve(approveTarget)}
                disabled={!!busyId}
                className={cn('flex-1 rounded-full px-4 py-2.5 text-sm text-white transition-opacity font-body inline-flex items-center justify-center gap-2 bg-teal-deep hover:opacity-90', !!busyId && 'opacity-50 cursor-not-allowed')}
              >
                {busyId ? <><Loader2 size={15} className="animate-spin" /> Aprobando…</> : 'Aprobar pago'}
              </button>
              <button onClick={() => setApproveTarget(null)} disabled={!!busyId} className="rounded-full border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body">Cancelar</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Rechazo con motivo */}
      {reject && (
        <Modal onClose={() => !busyId && setReject(null)} titleId="reject-title" width={440}>
          <div className="p-6 space-y-3">
            <h3 id="reject-title" className="text-base font-bold text-navy font-display">Rechazar pago</h3>
            <p className="text-sm text-navy-light/70 font-body">
              Se avisará a <strong className="text-navy">{reject.member_name}</strong> con el motivo para que vuelva a subir el comprobante.
            </p>
            <textarea
              autoFocus
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Motivo del rechazo (obligatorio)…"
              aria-label="Motivo del rechazo"
              className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 resize-none font-body"
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={doReject}
                disabled={!reason.trim() || !!busyId}
                className={cn('flex-1 rounded-full px-4 py-2.5 text-sm text-white transition-colors font-body inline-flex items-center justify-center gap-2 bg-coral hover:bg-coral-deep', (!reason.trim() || !!busyId) && 'opacity-50 cursor-not-allowed')}
              >
                {busyId ? <><Loader2 size={15} className="animate-spin" /> Rechazando…</> : 'Rechazar y avisar'}
              </button>
              <button onClick={() => setReject(null)} disabled={!!busyId} className="rounded-full border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body">Cancelar</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmación de acción en lote (aprobar/rechazar seleccionados) */}
      {bulkAction && (
        <Modal onClose={() => !bulkBusy && setBulkAction(null)} titleId="bulk-title" width={440}>
          <div className="p-6 space-y-3">
            <h3 id="bulk-title" className="text-base font-bold text-navy font-display">
              {bulkAction === 'approve' ? 'Aprobar' : 'Rechazar'} {sel.count} pago{sel.count !== 1 ? 's' : ''}
            </h3>
            <p className="text-sm text-navy-light/70 font-body">
              {bulkAction === 'approve'
                ? 'Cada pago quedará como pagado y activará lo que corresponda (matrícula, inscripción a evento, etc.).'
                : 'Se avisará a cada persona con el mismo motivo para que vuelva a subir el comprobante.'}
              {' '}Si algún pago ya fue procesado por otro revisor mientras tanto, se reporta sin afectar al resto.
            </p>
            {bulkAction === 'reject' && (
              <textarea
                autoFocus
                value={bulkReason}
                onChange={e => setBulkReason(e.target.value)}
                rows={3}
                placeholder="Motivo del rechazo (obligatorio, aplica a todos los seleccionados)…"
                aria-label="Motivo del rechazo en lote"
                className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 resize-none font-body"
              />
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={doBulk}
                disabled={bulkBusy || (bulkAction === 'reject' && !bulkReason.trim())}
                className={cn(
                  'flex-1 rounded-full px-4 py-2.5 text-sm text-white transition-colors font-body inline-flex items-center justify-center gap-2',
                  bulkAction === 'approve' ? 'bg-teal-deep hover:opacity-90' : 'bg-coral hover:bg-coral-deep',
                  (bulkBusy || (bulkAction === 'reject' && !bulkReason.trim())) && 'opacity-50 cursor-not-allowed',
                )}
              >
                {bulkBusy ? <><Loader2 size={15} className="animate-spin" /> Procesando…</> : `${bulkAction === 'approve' ? 'Aprobar' : 'Rechazar'} seleccionados`}
              </button>
              <button onClick={() => setBulkAction(null)} disabled={bulkBusy} className="rounded-full border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body">Cancelar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
