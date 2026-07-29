'use client'

// PAG-1: lista de pagos/cobros de un miembro con botón de pago (subir
// comprobante) para matrícula y eventos. Extraída de MemberParticipationTab
// para reutilizarla en /mis-pagos. `highlightId` (deep link ?pago=<id> de las
// notificaciones) resalta y hace scroll al pago indicado.

import { useState, useEffect, useRef } from 'react'
import { Check, CreditCard, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate, formatMoney } from '@/lib/format'
import type { MemberPaymentRow } from '@/lib/supabase/queries/payments'
import { Modal } from '@/components/shared/Modal'

/** Estado visual de un pago del miembro. */
export function paymentBadge(p: MemberPaymentRow): { label: string; cls: string } {
  if (p.queue_status === 'en_revision') return { label: 'En revisión', cls: 'bg-amber-50 text-amber-700' }
  if (p.queue_status === 'pendiente') return { label: 'Pendiente', cls: 'bg-coral/10 text-coral' }
  if (p.status === 'paid') return { label: 'Pagado', cls: 'bg-teal-soft/30 text-teal-deep' }
  if (p.status === 'refunded' || p.status === 'partial_refund') return { label: 'Devuelto', cls: 'bg-navy/5 text-navy-light/70' }
  return { label: 'Cancelado', cls: 'bg-surface-low text-navy-light/60' }
}

/** Lista los pagos del miembro (fetch propio). Los pendientes de matrícula/
 *  evento muestran botón para pagar. Gate en el endpoint: el propio miembro,
 *  su familia o el staff de finanzas. */
export function MemberPaymentsList({ memberId, highlightId, onlyActionable = false }: {
  memberId: string
  /** Pago a resaltar (deep link de notificaciones: /mis-pagos?pago=<id>). */
  highlightId?: string | null
  /** Solo pendientes + en revisión (la vista "mis pagos" esconde el historial cerrado). */
  onlyActionable?: boolean
}) {
  const [rows, setRows] = useState<MemberPaymentRow[] | null>(null)
  const [error, setError] = useState(false)
  const highlightRef = useRef<HTMLDivElement | null>(null)

  // Si memberId puede cambiar (pestañas de familia en /mis-pagos), remontar
  // con key={memberId} — acá no se resetea estado en el effect.
  useEffect(() => {
    let alive = true
    fetch(`/api/members/${memberId}/payments`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: MemberPaymentRow[]) => { if (alive) setRows(d) })
      .catch(() => { if (alive) setError(true) })
    return () => { alive = false }
  }, [memberId])

  useEffect(() => {
    if (rows && highlightId) highlightRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [rows, highlightId])

  if (error) return <p className="px-4 py-3 text-[13px] text-coral font-body">No se pudieron cargar los pagos.</p>
  if (!rows) return <p className="px-4 py-6 text-center text-[13px] text-navy-light/50 font-body">Cargando…</p>

  const visible = onlyActionable ? rows.filter(p => p.queue_status === 'pendiente' || p.queue_status === 'en_revision') : rows
  if (visible.length === 0) {
    return <p className="px-4 py-6 text-center text-[13px] text-navy-light/50 font-body">{onlyActionable ? 'Sin pagos pendientes. 🎉' : 'Sin pagos ni cobros registrados.'}</p>
  }

  return (
    <div className="divide-y divide-[var(--outline-variant)]">
      {visible.map(p => {
        const badge = paymentBadge(p)
        const canPay = p.queue_status === 'pendiente'
        const highlighted = p.id === highlightId
        return (
          <div
            key={p.id}
            ref={highlighted ? highlightRef : undefined}
            className={cn('flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3', highlighted && 'ring-2 ring-coral/50 rounded-xl bg-coral/5')}
          >
            <div className="min-w-0">
              <p className="text-[13px] text-navy font-body truncate">{p.description}</p>
              <p className="text-[11px] text-navy-light/60 font-body">
                {formatMoney(p.amount, p.currency)} · {formatDate(p.created_at)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold font-display', badge.cls)}>{badge.label}</span>
              {canPay && p.enrollment_id && <PayMatriculaButton enrollmentId={p.enrollment_id} retry={false} />}
              {canPay && !p.enrollment_id && p.event_registration_id && <PayEventRegistrationButton registrationId={p.event_registration_id} retry={false} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Botón de pago de matrícula por comprobante ───────────────────────────────
export function PayMatriculaButton({ enrollmentId, retry }: { enrollmentId: string; retry: boolean }) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (busy || !file) return
    setBusy(true); setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('enrollment_id', enrollmentId)
      fd.append('reference', reference.trim())
      const res = await fetch('/api/payments', { method: 'POST', body: fd })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudo enviar el comprobante.')
      setDone(true); setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally { setBusy(false) }
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2.5 py-0.5 text-[11px] font-semibold font-display">
        <Check size={11} /> Comprobante enviado
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-coral/40 text-coral px-2.5 py-1 text-[11px] hover:bg-coral/5 transition-colors whitespace-nowrap font-body"
      >
        <CreditCard size={12} /> {retry ? 'Reintentar pago' : 'Pagar matrícula'}
      </button>
      {open && (
        <Modal onClose={() => !busy && setOpen(false)} titleId="pay-title" width={420}>
          <div className="p-6 space-y-4">
            <h3 id="pay-title" className="text-base font-bold text-navy font-display">Pagar matrícula</h3>
            <p className="text-[13px] text-navy-light/70 font-body">
              Subí el comprobante (screenshot del SINPE o transferencia) y el número de referencia. Un revisor lo verificará.
            </p>
            <div className="space-y-1">
              <label className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display">Comprobante (imagen)</label>
              <input
                type="file"
                accept="image/*"
                aria-label="Comprobante de pago"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-[13px] text-navy-light/80 font-body file:mr-3 file:rounded-full file:border-0 file:bg-surface-low file:px-3 file:py-1.5 file:text-[12px] file:text-navy"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="pay-ref" className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display">Número de referencia</label>
              <input
                id="pay-ref"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="Ej. 2026070212345"
                className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
              />
            </div>
            {error && <p className="text-[12px] text-coral font-body">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={submit}
                disabled={busy || !file}
                className={cn('flex-1 rounded-full px-4 py-2.5 text-sm text-white transition-colors font-body inline-flex items-center justify-center gap-2 bg-coral hover:bg-coral-deep', (busy || !file) && 'opacity-50 cursor-not-allowed')}
              >
                {busy ? <><Loader2 size={15} className="animate-spin" /> Enviando…</> : 'Enviar comprobante'}
              </button>
              <button onClick={() => setOpen(false)} disabled={busy} className="rounded-full border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body">Cancelar</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

// ── Botón de pago de inscripción a evento por comprobante (clon de PayMatriculaButton) ──
export function PayEventRegistrationButton({ registrationId, retry }: { registrationId: string; retry: boolean }) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (busy || !file) return
    setBusy(true); setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('reference', reference.trim())
      const res = await fetch(`/api/event-registrations/${registrationId}/comprobante`, { method: 'POST', body: fd })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudo enviar el comprobante.')
      setDone(true); setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally { setBusy(false) }
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2.5 py-0.5 text-[11px] font-semibold font-display">
        <Check size={11} /> Comprobante enviado
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-coral/40 text-coral px-2.5 py-1 text-[11px] hover:bg-coral/5 transition-colors whitespace-nowrap font-body"
      >
        <CreditCard size={12} /> {retry ? 'Reintentar pago' : 'Pagar inscripción'}
      </button>
      {open && (
        <Modal onClose={() => !busy && setOpen(false)} titleId="pay-event-title" width={420}>
          <div className="p-6 space-y-4">
            <h3 id="pay-event-title" className="text-base font-bold text-navy font-display">Pagar inscripción</h3>
            <p className="text-[13px] text-navy-light/70 font-body">
              Subí el comprobante (screenshot del SINPE o transferencia) y el número de referencia. Un revisor lo verificará.
            </p>
            <div className="space-y-1">
              <label className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display">Comprobante (imagen)</label>
              <input
                type="file"
                accept="image/*"
                aria-label="Comprobante de pago"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-[13px] text-navy-light/80 font-body file:mr-3 file:rounded-full file:border-0 file:bg-surface-low file:px-3 file:py-1.5 file:text-[12px] file:text-navy"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="pay-event-ref" className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display">Número de referencia</label>
              <input
                id="pay-event-ref"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="Ej. 2026070212345"
                className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
              />
            </div>
            {error && <p className="text-[12px] text-coral font-body">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={submit}
                disabled={busy || !file}
                className={cn('flex-1 rounded-full px-4 py-2.5 text-sm text-white transition-colors font-body inline-flex items-center justify-center gap-2 bg-coral hover:bg-coral-deep', (busy || !file) && 'opacity-50 cursor-not-allowed')}
              >
                {busy ? <><Loader2 size={15} className="animate-spin" /> Enviando…</> : 'Enviar comprobante'}
              </button>
              <button onClick={() => setOpen(false)} disabled={busy} className="rounded-full border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body">Cancelar</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
