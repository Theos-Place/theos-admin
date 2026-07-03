'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { AccessDenied } from '@/components/shared/AccessDenied'
import { EmptyState } from '@/components/shared/EmptyState'
import { Modal } from '@/components/shared/Modal'
import { cn } from '@/lib/utils'
import { CreditCard, Loader2, Check, AlertTriangle, Image as ImageIcon } from 'lucide-react'

type QueueRow = {
  id: string
  member_id: string
  member_name: string
  concept: 'matricula' | 'folletos' | null
  amount: number
  currency: string
  reference_code: string | null
  receipt_path: string | null
  created_at: string
  duplicate_reference: boolean
}

const CONCEPT_LABEL: Record<string, string> = { matricula: 'Matrícula', folletos: 'Folletos' }

function money(amount: number, currency: string) {
  return `${currency === 'USD' ? '$' : '₡'}${amount.toLocaleString('es-CR')}`
}

export default function RevisionPagosPage() {
  const { can } = usePermissions()
  const canView = can('revision_pagos', 'view')
  const canReview = can('revision_pagos', 'edit')

  const [rows, setRows] = useState<QueueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [reject, setReject] = useState<QueueRow | null>(null)
  const [reason, setReason] = useState('')
  const [receipt, setReceipt] = useState<{ row: QueueRow; url: string | null; loading: boolean } | null>(null)

  const refetch = useCallback(() => {
    setLoading(true)
    fetch('/api/payments/queue')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: QueueRow[]) => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { if (canView) refetch() }, [canView, refetch])

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
    setBusyId(row.id); setMsg(null)
    try {
      const res = await fetch(`/api/payments/${row.id}/review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'No se pudo aprobar.')
      setMsg(`Pago de ${row.member_name} aprobado.`)
      refetch()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error desconocido')
    } finally { setBusyId(null) }
  }

  async function doReject() {
    if (!reject || busyId || !reason.trim()) return
    setBusyId(reject.id); setMsg(null)
    try {
      const res = await fetch(`/api/payments/${reject.id}/review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reason: reason.trim() }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'No se pudo rechazar.')
      setMsg(`Pago de ${reject.member_name} rechazado. Se avisó a la persona.`)
      setReject(null); setReason(''); refetch()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error desconocido')
    } finally { setBusyId(null) }
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
            <h1 className="text-2xl text-white font-display font-extrabold tracking-[-0.02em]">Revisión de pagos</h1>
            <p className="mt-0.5 text-sm text-white/70 font-body">{rows.length} pago{rows.length !== 1 ? 's' : ''} en revisión</p>
          </div>
        </div>
      </div>

      {msg && (
        <p className="rounded-xl bg-surface-low px-4 py-2 text-sm text-navy-light/80 font-body inline-flex items-center gap-1.5">
          <Check size={14} className="text-teal-deep" /> {msg}
        </p>
      )}

      <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
        {loading ? (
          <p className="px-4 py-10 text-center text-sm text-navy-light/60 font-body inline-flex items-center gap-2 justify-center w-full"><Loader2 size={15} className="animate-spin" /> Cargando…</p>
        ) : rows.length === 0 ? (
          <EmptyState icon={CreditCard} title="No hay pagos en revisión" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Persona', 'Concepto', 'Monto esperado', 'Referencia', 'Comprobante', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] tracking-widest uppercase text-navy-light/60 font-display whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={r.id} className={cn('transition-colors', idx % 2 === 1 ? 'bg-surface-low/40' : '')}>
                    <td className="px-4 py-3 text-sm font-medium text-navy font-body">{r.member_name}</td>
                    <td className="px-4 py-3 text-[13px] text-navy-light/80 font-body">{r.concept ? CONCEPT_LABEL[r.concept] : '—'}</td>
                    <td className="px-4 py-3 text-sm text-navy font-body tabular-nums">{money(r.amount, r.currency)}</td>
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
                      {canReview && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => approve(r)}
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
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
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
    </div>
  )
}
