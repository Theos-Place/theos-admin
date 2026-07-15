'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { GraduationCap, Plus, Loader2, AlertTriangle } from 'lucide-react'
import { usePermissions } from '@/hooks/usePermissions'
import { useRowSelection } from '@/hooks/useRowSelection'
import { BulkActionBar } from '@/components/shared/BulkActionBar'
import { AccessDenied } from '@/components/shared/AccessDenied'
import { EmptyState } from '@/components/shared/EmptyState'
import { DeleteConfirmModal } from '@/components/shared/DeleteConfirmModal'
import { ActiveWarningModal } from '@/components/shared/ActiveWarningModal'
import { Modal } from '@/components/shared/Modal'
import { useToast } from '@/components/shared/Toast'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import type { FinanceRequest } from '@/types/finance'

type Scholarship = {
  id: string
  kind: 'asignada' | 'generica'
  member_id: string | null
  member_name: string | null
  entity_type: 'study_plan' | 'event'
  entity_name: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  code: string | null
  expires_at: string | null
  approval_type: 'total' | 'parcial' | null
  status: 'active' | 'used' | 'revoked'
  used_count: number
  created_at: string
}

function formatDiscount(type: 'percentage' | 'fixed', value: number): string {
  return type === 'percentage' ? `${value}%` : `₡${value.toLocaleString('es-CR')}`
}

const STATUS_LABEL: Record<string, string> = { active: 'Activa', used: 'Usada', revoked: 'Revocada' }
const STATUS_BADGE: Record<string, string> = {
  active: 'bg-teal-soft/30 text-teal-deep', used: 'bg-navy/10 text-navy', revoked: 'bg-coral-soft/20 text-coral',
}

export default function BecasPage() {
  const { can } = usePermissions()
  const canView = can('becas', 'view')
  const canEdit = can('becas', 'edit')
  const toast = useToast()

  const [tab, setTab] = useState<'cupones' | 'solicitudes'>('cupones')

  // ── Cupones/becas ────────────────────────────────────────────────────────
  const [coupons, setCoupons] = useState<Scholarship[]>([])
  const [couponsLoading, setCouponsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'used' | 'revoked'>('all')

  const refetchCoupons = useCallback(() => {
    setCouponsLoading(true)
    fetch('/api/scholarships/coupons?kind=generica')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => setCoupons(d?.items ?? []))
      .catch(() => setCoupons([]))
      .finally(() => setCouponsLoading(false))
  }, [])
  useEffect(() => { if (canView && tab === 'cupones') refetchCoupons() }, [canView, tab, refetchCoupons])

  const filteredCoupons = useMemo(
    () => (statusFilter === 'all' ? coupons : coupons.filter(c => c.status === statusFilter)),
    [coupons, statusFilter],
  )
  const sel = useRowSelection(filteredCoupons.filter(c => c.status === 'active').map(c => c.id))

  const [confirmRevoke, setConfirmRevoke] = useState<Scholarship | null>(null)
  const [warnUsed, setWarnUsed] = useState<Scholarship | null>(null)
  const [bulkRevoking, setBulkRevoking] = useState(false)

  function requestRevoke(c: Scholarship) {
    if (c.used_count > 0) { setWarnUsed(c); return }
    setConfirmRevoke(c)
  }
  async function doRevoke() {
    if (!confirmRevoke) return
    const res = await fetch(`/api/scholarships/${confirmRevoke.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json().catch(() => null)
      toast(d?.error ?? 'No se pudo revocar.', 'error')
    } else {
      toast('Cupón revocado.', 'success')
      refetchCoupons()
    }
    setConfirmRevoke(null)
  }
  async function bulkRevoke() {
    setBulkRevoking(true)
    let ok = 0, failed = 0
    for (const id of sel.selectedIds) {
      const res = await fetch(`/api/scholarships/${id}`, { method: 'DELETE' })
      if (res.ok) ok++; else failed++
    }
    toast(failed > 0 ? `${ok} revocados, ${failed} no se pudieron revocar.` : `${ok} cupones revocados.`, failed > 0 ? 'error' : 'success')
    sel.clear()
    setBulkRevoking(false)
    refetchCoupons()
  }

  // ── Solicitudes de beca ──────────────────────────────────────────────────
  const [requests, setRequests] = useState<FinanceRequest[]>([])
  const [requestsLoading, setRequestsLoading] = useState(true)
  const refetchRequests = useCallback(() => {
    setRequestsLoading(true)
    fetch('/api/finance/requests?type=scholarship')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: FinanceRequest[]) => setRequests(Array.isArray(d) ? d : []))
      .catch(() => setRequests([]))
      .finally(() => setRequestsLoading(false))
  }, [])
  useEffect(() => { if (canView && tab === 'solicitudes') refetchRequests() }, [canView, tab, refetchRequests])

  const [reviewTarget, setReviewTarget] = useState<FinanceRequest | null>(null)

  if (!canView) return <AccessDenied />

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-navy px-5 sm:px-6 py-5 shadow-[var(--shadow-md)]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
              <GraduationCap size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl text-white font-display font-extrabold tracking-[-0.02em]">Becas</h1>
              <p className="mt-0.5 text-sm text-white/70 font-body">Cupones genéricos y solicitudes asignadas</p>
            </div>
          </div>
          {canEdit && tab === 'cupones' && (
            <Link
              href="/finanzas/becas/nueva"
              className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors font-body"
            >
              <Plus size={15} /> Crear cupón
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {([['cupones', 'Cupones genéricos'], ['solicitudes', 'Solicitudes asignadas']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'rounded-full px-4 py-2 text-[13px] font-medium border transition-all font-display',
              tab === id ? 'bg-navy text-white border-navy' : 'text-navy-light/60 hover:text-navy border-transparent hover:border-navy/20',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'cupones' && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            {([['all', 'Todos'], ['active', 'Activos'], ['used', 'Usados'], ['revoked', 'Revocados']] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setStatusFilter(id)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-[12px] font-medium border transition-all font-display',
                  statusFilter === id ? 'bg-navy text-white border-navy' : 'text-navy-light/60 hover:text-navy border-transparent hover:border-navy/20',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {canEdit && sel.count > 0 && (
            <BulkActionBar count={sel.count} onClear={sel.clear} noun="cupones">
              <button
                onClick={bulkRevoke}
                disabled={bulkRevoking}
                className="rounded-full border border-white/25 text-white px-3.5 py-1.5 text-[12px] hover:bg-white/10 transition-colors font-body disabled:opacity-50"
              >
                {bulkRevoking ? 'Revocando…' : 'Revocar seleccionados'}
              </button>
            </BulkActionBar>
          )}

          <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
            {couponsLoading ? (
              <p className="px-4 py-10 text-center text-sm text-navy-light/60 font-body inline-flex items-center gap-2 justify-center w-full"><Loader2 size={15} className="animate-spin" /> Cargando…</p>
            ) : filteredCoupons.length === 0 ? (
              <EmptyState icon={GraduationCap} title="No hay cupones" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {canEdit && (
                        <th className="px-4 py-3 text-left">
                          <input type="checkbox" aria-label="Seleccionar todos" checked={sel.allSelected}
                            ref={el => { if (el) el.indeterminate = sel.someSelected }} onChange={sel.toggleAll} />
                        </th>
                      )}
                      {['Código', 'Destino', 'Descuento', 'Vencimiento', 'Usos', 'Estado', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] tracking-widest uppercase text-navy-light/60 font-display whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCoupons.map((c, idx) => (
                      <tr key={c.id} className={cn('transition-colors', idx % 2 === 1 ? 'bg-surface-low/40' : '')}>
                        {canEdit && (
                          <td className="px-4 py-3">
                            {c.status === 'active' && (
                              <input type="checkbox" aria-label={`Seleccionar ${c.code}`} checked={sel.isSelected(c.id)} onChange={() => sel.toggle(c.id)} />
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm font-mono font-medium text-navy">{c.code}</td>
                        <td className="px-4 py-3 text-[13px] text-navy-light/80 font-body">{c.entity_name}</td>
                        <td className="px-4 py-3 text-sm text-navy font-body">{formatDiscount(c.discount_type, c.discount_value)}</td>
                        <td className="px-4 py-3 text-[13px] text-navy-light/70 font-body">{c.expires_at ? formatDate(c.expires_at) : '—'}</td>
                        <td className="px-4 py-3 text-[13px] text-navy-light/70 font-body">{c.used_count}</td>
                        <td className="px-4 py-3">
                          <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold font-display', STATUS_BADGE[c.status])}>{STATUS_LABEL[c.status]}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canEdit && c.status === 'active' && (
                            <button
                              onClick={() => requestRevoke(c)}
                              className="rounded-full border border-coral/40 text-coral px-3 py-1 text-[12px] hover:bg-coral/5 transition-colors font-body"
                            >
                              Revocar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'solicitudes' && (
        <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
          {requestsLoading ? (
            <p className="px-4 py-10 text-center text-sm text-navy-light/60 font-body inline-flex items-center gap-2 justify-center w-full"><Loader2 size={15} className="animate-spin" /> Cargando…</p>
          ) : requests.length === 0 ? (
            <EmptyState icon={GraduationCap} title="No hay solicitudes de beca" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {['Persona', 'Destino', 'Motivo', 'Estado', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] tracking-widest uppercase text-navy-light/60 font-display whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r, idx) => (
                    <tr key={r.id} className={cn('transition-colors', idx % 2 === 1 ? 'bg-surface-low/40' : '')}>
                      <td className="px-4 py-3 text-sm font-medium text-navy font-body">{r.member_name}</td>
                      <td className="px-4 py-3 text-[13px] text-navy-light/80 font-body">{r.entity_name ?? '—'}</td>
                      <td className="px-4 py-3 text-[13px] text-navy-light/70 font-body max-w-xs truncate" title={r.reason}>{r.reason}</td>
                      <td className="px-4 py-3">
                        <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold font-display',
                          r.status === 'resolved' ? 'bg-teal-soft/30 text-teal-deep'
                          : r.status === 'rejected' ? 'bg-coral-soft/20 text-coral'
                          : 'bg-amber-50 text-amber-700')}>
                          {r.status === 'open' ? 'Abierta' : r.status === 'in_review' ? 'En revisión' : r.status === 'resolved' ? 'Aprobada' : 'Rechazada'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canEdit && (r.status === 'open' || r.status === 'in_review') && (
                          <button
                            onClick={() => setReviewTarget(r)}
                            className="rounded-full bg-navy px-3.5 py-1.5 text-[12px] text-white hover:opacity-90 transition-opacity font-body"
                          >
                            Revisar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <DeleteConfirmModal
        open={!!confirmRevoke}
        title="Revocar cupón"
        description={`Se revocará el cupón "${confirmRevoke?.code}". Esta acción no se puede deshacer.`}
        onConfirm={doRevoke}
        onCancel={() => setConfirmRevoke(null)}
      />
      <ActiveWarningModal
        open={!!warnUsed}
        title="No se puede revocar"
        message={`El cupón "${warnUsed?.code}" ya fue usado ${warnUsed?.used_count} vez/veces. No se puede revocar un cupón con usos registrados.`}
        onClose={() => setWarnUsed(null)}
      />

      {reviewTarget && (
        <ReviewRequestModal
          request={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onDone={() => { setReviewTarget(null); refetchRequests() }}
        />
      )}
    </div>
  )
}

function ReviewRequestModal({ request, onClose, onDone }: {
  request: FinanceRequest; onClose: () => void; onDone: () => void
}) {
  const toast = useToast()
  const [action, setAction] = useState<'approve_total' | 'approve_parcial' | 'reject' | null>(null)
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage')
  const [discountValue, setDiscountValue] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (busy || !action) return
    setBusy(true)
    try {
      const body = action === 'reject'
        ? { action: 'reject', reason: reason.trim() }
        : { action: 'approve', discount_type: discountType, discount_value: Number(discountValue), approval_type: action === 'approve_parcial' ? 'parcial' : 'total' }
      const res = await fetch(`/api/scholarships/requests/${request.id}/review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudo procesar la solicitud.')
      toast('Solicitud procesada.', 'success')
      onDone()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error desconocido', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal onClose={() => !busy && onClose()} titleId="review-request-title" width={460}>
      <div className="p-6 space-y-4">
        <h3 id="review-request-title" className="text-base font-bold text-navy font-display">Revisar solicitud de beca</h3>
        <p className="text-sm text-navy-light/70 font-body">
          <strong className="text-navy">{request.member_name}</strong> solicitó una beca para <strong className="text-navy">{request.entity_name ?? '—'}</strong>.
        </p>
        <p className="text-[13px] text-navy-light/70 font-body italic">&quot;{request.reason}&quot;</p>

        {!action && (
          <div className="grid grid-cols-1 gap-2 pt-1">
            <button onClick={() => setAction('approve_total')} className="rounded-xl bg-teal-deep px-4 py-2.5 text-sm text-white hover:opacity-90 transition-opacity font-body">Aprobar total</button>
            <button onClick={() => setAction('approve_parcial')} className="rounded-xl border border-teal-deep text-teal-deep px-4 py-2.5 text-sm hover:bg-teal-deep/5 transition-colors font-body">Aprobar parcial</button>
            <button onClick={() => setAction('reject')} className="rounded-xl border border-coral/40 text-coral px-4 py-2.5 text-sm hover:bg-coral/5 transition-colors font-body">Rechazar</button>
          </div>
        )}

        {(action === 'approve_total' || action === 'approve_parcial') && (
          <div className="space-y-3">
            {action === 'approve_parcial' && (
              <div className="flex items-start gap-2.5 rounded-xl px-3 py-3 bg-amber-50 border border-amber-200">
                <AlertTriangle size={14} className="text-amber-700 shrink-0 mt-0.5" />
                <p className="text-[12px] text-amber-800 font-body">Estás marcando esta aprobación como <strong>parcial</strong> — el miembro recibirá el email correspondiente.</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDiscountType('percentage')}
                className={cn('rounded-xl border px-3 py-2 text-[13px] font-body', discountType === 'percentage' ? 'border-coral bg-coral/5' : 'border-outline')}
              >Porcentaje</button>
              <button
                onClick={() => setDiscountType('fixed')}
                className={cn('rounded-xl border px-3 py-2 text-[13px] font-body', discountType === 'fixed' ? 'border-coral bg-coral/5' : 'border-outline')}
              >Monto fijo</button>
            </div>
            <input
              type="number" min={0} value={discountValue} onChange={e => setDiscountValue(e.target.value)}
              placeholder={discountType === 'percentage' ? 'Ej. 50' : 'Ej. 10000'}
              className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
            />
            <div className="flex gap-2 pt-1">
              <button onClick={() => setAction(null)} disabled={busy} className="rounded-full border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body">Atrás</button>
              <button
                onClick={submit} disabled={busy || !discountValue || Number(discountValue) <= 0}
                className={cn('flex-1 rounded-full px-4 py-2.5 text-sm text-white transition-colors font-body bg-teal-deep hover:opacity-90', (busy || !discountValue) && 'opacity-50 cursor-not-allowed')}
              >
                {busy ? 'Aprobando…' : `Aprobar ${action === 'approve_parcial' ? 'parcial' : 'total'}`}
              </button>
            </div>
          </div>
        )}

        {action === 'reject' && (
          <div className="space-y-3">
            <textarea
              autoFocus value={reason} onChange={e => setReason(e.target.value)} rows={3}
              placeholder="Motivo del rechazo (obligatorio)…" aria-label="Motivo del rechazo"
              className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 resize-none font-body"
            />
            <div className="flex gap-2 pt-1">
              <button onClick={() => setAction(null)} disabled={busy} className="rounded-full border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body">Atrás</button>
              <button
                onClick={submit} disabled={busy || !reason.trim()}
                className={cn('flex-1 rounded-full px-4 py-2.5 text-sm text-white transition-colors font-body bg-coral hover:bg-coral-deep', (busy || !reason.trim()) && 'opacity-50 cursor-not-allowed')}
              >
                {busy ? 'Rechazando…' : 'Rechazar y avisar'}
              </button>
            </div>
          </div>
        )}

        {!action && (
          <div className="flex justify-end pt-1">
            <button onClick={onClose} className="rounded-full px-4 py-2 text-sm text-navy-light/70 font-body hover:text-navy transition-colors">Cerrar</button>
          </div>
        )}
      </div>
    </Modal>
  )
}
