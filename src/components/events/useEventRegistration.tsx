'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, Check, Loader2 } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { PaymentMethodSelector, type PaymentMethodValue } from '@/components/shared/PaymentMethodSelector'
import { ScholarshipRequestModal } from '@/components/finance/ScholarshipRequestModal'
import { cn } from '@/lib/utils'
import { formatDateLong, formatCRC } from '@/lib/format'
import type { EventEligibilityResult } from '@/lib/events/eligibility'
import { montoAPagar, comprobanteRequerido } from '@/lib/events/registration-payment'

type ApplicableScholarship = { id: string; discount_type: 'percentage' | 'fixed'; discount_value: number }

/** Confirmar + comprobante + beca de un evento, disponible desde cualquier
 *  vista (calendario, lista, cuadrícula) — antes vivía solo en /mis-eventos. */
export function useEventRegistration(memberId: string | null, onRegistered?: () => void) {
  const [confirmEvent, setConfirmEvent] = useState<EventEligibilityResult | null>(null)
  const [pendingReceipt, setPendingReceipt] = useState<{ registrationId: string; eventTitle: string; amount: number } | null>(null)
  const [successEvent, setSuccessEvent] = useState<string | null>(null)
  const [scholarshipTarget, setScholarshipTarget] = useState<{ entity_type: 'event'; id: string; name: string } | null>(null)
  const [registerError, setRegisterError] = useState<string | null>(null)

  /** Inscribe. Si el evento tiene costo, el COMPROBANTE VIAJA EN ESTA MISMA
   *  llamada (multipart): la inscripción no existe sin él. Antes se creaba la
   *  inscripción y el comprobante se pedía en un segundo modal que se podía
   *  cerrar con "Más tarde", así que quedaba gente con el cupo tomado sin pagar. */
  async function handleRegister(extra?: {
    scholarship_id?: string; coupon_code?: string
    file?: File | null; reference?: string
  }) {
    if (!confirmEvent || !memberId) return
    setRegisterError(null)
    try {
      let res: Response
      if (extra?.file) {
        const fd = new FormData()
        fd.append('member_id', memberId)
        if (extra.scholarship_id) fd.append('scholarship_id', extra.scholarship_id)
        if (extra.coupon_code) fd.append('coupon_code', extra.coupon_code)
        fd.append('file', extra.file)
        fd.append('reference', extra.reference ?? '')
        res = await fetch(`/api/events/${confirmEvent.event_id}/register`, { method: 'POST', body: fd })
      } else {
        res = await fetch(`/api/events/${confirmEvent.event_id}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            member_id: memberId,
            scholarship_id: extra?.scholarship_id,
            coupon_code: extra?.coupon_code,
          }),
        })
      }
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudo completar la inscripción.')
      setConfirmEvent(null)
      setSuccessEvent(confirmEvent.title)
      onRegistered?.()
    } catch (err) {
      setRegisterError(err instanceof Error ? err.message : 'No se pudo completar la inscripción.')
    }
  }

  const modals = (
    <>
      {confirmEvent && (
        <ConfirmModal
          event={confirmEvent}
          memberId={memberId}
          error={registerError}
          onCancel={() => { setConfirmEvent(null); setRegisterError(null) }}
          onConfirm={handleRegister}
        />
      )}
      {pendingReceipt && (
        <ReceiptModal
          registrationId={pendingReceipt.registrationId}
          eventTitle={pendingReceipt.eventTitle}
          amount={pendingReceipt.amount}
          onDone={() => setPendingReceipt(null)}
        />
      )}
      {scholarshipTarget && memberId && (
        <ScholarshipRequestModal
          memberId={memberId}
          fixedTarget={scholarshipTarget}
          onClose={() => setScholarshipTarget(null)}
        />
      )}
    </>
  )

  return {
    openRegister: (ev: EventEligibilityResult) => setConfirmEvent(ev),
    /** Reabre el modal del comprobante de una inscripción YA hecha que quedó con
     *  el pago pendiente. Existe porque el botón "Más tarde" del modal dejaba a
     *  la persona sin ninguna salida: la tarjeta solo decía "Ya inscrito/a" y el
     *  pago no aparece en /mis-pagos hasta que se sube el comprobante — o sea
     *  que "más tarde" era en realidad "nunca". */
    openReceipt: (ev: EventEligibilityResult) => {
      if (!ev.registration_id) return
      setPendingReceipt({ registrationId: ev.registration_id, eventTitle: ev.title, amount: ev.price })
    },
    requestScholarship: (ev: EventEligibilityResult) => setScholarshipTarget({ entity_type: 'event', id: ev.event_id, name: ev.title }),
    successEvent,
    clearSuccess: () => setSuccessEvent(null),
    modals,
  }
}

function ConfirmModal({ event, memberId, error, onCancel, onConfirm }: {
  event: EventEligibilityResult
  memberId: string | null
  error: string | null
  onCancel: () => void
  onConfirm: (extra?: { scholarship_id?: string; coupon_code?: string; file?: File | null; reference?: string }) => void
}) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>('sinpe')
  const requiresPayment = event.requires_payment && !event.exempt

  const [comprobante, setComprobante] = useState<File | null>(null)
  const [referencia, setReferencia] = useState('')
  const [applicable, setApplicable] = useState<ApplicableScholarship | null>(null)
  const [useScholarship, setUseScholarship] = useState(true)
  const [couponCode, setCouponCode] = useState('')

  useEffect(() => {
    if (!memberId || !requiresPayment) return
    fetch(`/api/scholarships/applicable?member_id=${memberId}&entity_type=event&entity_id=${event.event_id}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => setApplicable(d?.scholarship ?? null))
      .catch(() => setApplicable(null))
  }, [memberId, requiresPayment, event.event_id])

  const discountedAmount = applicable
    ? Math.max(0, applicable.discount_type === 'percentage'
      ? Math.round(event.price * (1 - applicable.discount_value / 100))
      : Math.round(event.price - applicable.discount_value))
    : null

  /** Lo que la persona realmente paga: si tiene beca marcada, el monto con
   *  descuento. Si eso queda en ₡0 no se pide comprobante — y el servidor aplica
   *  el mismo criterio, así que la pantalla no puede pedir algo que la API no
   *  exige, ni al revés. */
  const montoEfectivo = montoAPagar(
    { requiresPayment: event.requires_payment, exempt: event.exempt, price: event.price },
    applicable && useScholarship
      ? { discount_type: applicable.discount_type, discount_value: applicable.discount_value }
      : null,
  )
  const pideComprobante = comprobanteRequerido(montoEfectivo)

  function handleConfirm() {
    if (pideComprobante && !comprobante) return
    const pago = pideComprobante ? { file: comprobante, reference: referencia.trim() } : {}
    if (applicable && useScholarship) onConfirm({ scholarship_id: applicable.id, ...pago })
    else if (couponCode.trim()) onConfirm({ coupon_code: couponCode.trim(), ...pago })
    else onConfirm(pago)
  }

  return (
    <Modal onClose={onCancel} titleId="confirmar-evento-title" width={448}>
      <div className="p-6 space-y-5">
        <p id="confirmar-evento-title" className="text-base font-bold text-navy font-display">Confirmar inscripción</p>
        <div className="rounded-xl space-y-0 overflow-hidden border border-outline">
          {[
            { label: 'Evento', value: event.title },
            { label: 'Fecha', value: formatDateLong(event.starts_at) },
            { label: 'Costo', value: requiresPayment ? formatCRC(event.price) : 'Gratuito' },
          ].map(({ label, value }, i) => (
            <div key={label} className={cn('flex items-center gap-3 px-4 py-2.5', i > 0 && 'border-t', 'border-outline')}>
              <span className="w-24 text-[13px] text-navy-light/80 uppercase tracking-wider shrink-0 font-display">{label}</span>
              <span className="text-[13px] font-medium text-navy font-body">{value}</span>
            </div>
          ))}
        </div>
        <div className="flex items-start gap-2.5 rounded-xl px-3 py-3 bg-coral/7 border border-coral/20">
          <AlertCircle size={14} className="text-coral shrink-0 mt-0.5" />
          <p className="text-[13px] text-navy-light/80 font-body">
            {pideComprobante
              ? 'Este evento tiene costo: la inscripción se completa con el comprobante. Al confirmar queda hecha y un revisor aprueba el pago.'
              : 'Al confirmar, tu inscripción queda lista de una vez.'}
          </p>
        </div>
        {requiresPayment && (
          <div className="space-y-2">
            {applicable ? (
              <label className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 bg-teal-soft/10 border border-teal-deep/20 cursor-pointer">
                <input type="checkbox" checked={useScholarship} onChange={e => setUseScholarship(e.target.checked)} />
                <span className="text-[13px] text-navy font-body">
                  Usar mi beca ({applicable.discount_type === 'percentage' ? `${applicable.discount_value}%` : `${formatCRC(applicable.discount_value)}`} de descuento)
                  {discountedAmount != null && <span className="block text-[13px] text-teal-deep font-semibold">Nuevo total: {formatCRC(discountedAmount)}</span>}
                </span>
              </label>
            ) : (
              <div className="space-y-1">
                <label htmlFor="coupon-code-evento" className="text-[13px] uppercase tracking-widest text-navy-light/80 font-display">¿Tenés un código de descuento?</label>
                <input
                  id="coupon-code-evento" value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Opcional"
                  className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
                />
              </div>
            )}
          </div>
        )}
        {requiresPayment && <PaymentMethodSelector value={paymentMethod} onChange={setPaymentMethod} />}
        {pideComprobante && (
          <div className="space-y-3 rounded-xl border border-outline p-3">
            <div className="space-y-1">
              <label htmlFor="insc-comprobante" className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
                Comprobante de {formatCRC(montoEfectivo)} (imagen)
              </label>
              <input
                id="insc-comprobante" type="file" accept="image/*"
                aria-label="Comprobante de pago"
                onChange={e => setComprobante(e.target.files?.[0] ?? null)}
                className="w-full text-[13px] text-navy-light/80 font-body file:mr-3 file:rounded-full file:border-0 file:bg-surface-low file:px-3 file:py-1.5 file:text-[13px] file:text-navy"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="insc-referencia" className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">Número de referencia</label>
              <input
                id="insc-referencia" value={referencia} onChange={e => setReferencia(e.target.value)}
                placeholder="Ej. 2026070212345"
                className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
              />
            </div>
          </div>
        )}
        {error && <p className="text-[13px] text-coral font-body">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} className="flex-1 rounded-xl border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors border-outline font-body">Cancelar</button>
          <button
            onClick={handleConfirm}
            disabled={pideComprobante && !comprobante}
            className={cn('flex-1 rounded-xl bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-medium font-body', pideComprobante && !comprobante && 'opacity-50 cursor-not-allowed')}
          >
            {pideComprobante ? 'Confirmar y enviar comprobante' : 'Confirmar inscripción'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function ReceiptModal({ registrationId, eventTitle, amount, onDone }: {
  registrationId: string; eventTitle: string; amount: number; onDone: () => void
}) {
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
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally { setBusy(false) }
  }

  return (
    <Modal onClose={() => !busy && onDone()} titleId="comprobante-evento-title" width={420}>
      <div className="p-6 space-y-4">
        {done ? (
          <div className="text-center space-y-3 py-4">
            <div className="flex justify-center">
              <div className="h-14 w-14 rounded-2xl flex items-center justify-center bg-teal/15">
                <Check size={26} className="text-teal-deep" />
              </div>
            </div>
            <p className="text-base font-bold text-navy font-display">Comprobante enviado</p>
            <p className="text-[13px] text-navy-light/80 font-body">
              Tu inscripción a {eventTitle} quedó pendiente de aprobación de pago. Te avisamos si hay algún problema.
            </p>
            <button onClick={onDone} className="rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body">Listo</button>
          </div>
        ) : (
          <>
            <h3 id="comprobante-evento-title" className="text-base font-bold text-navy font-display">Pagar inscripción</h3>
            <p className="text-[13px] text-navy-light/80 font-body">
              {eventTitle} — {`${formatCRC(amount)}`}. Subí el comprobante (screenshot del SINPE o transferencia) y el número de referencia.
            </p>
            <div className="space-y-1">
              <label htmlFor="comprobante-imagen" className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">Comprobante (imagen)</label>
              <input id="comprobante-imagen"
                type="file"
                accept="image/*"
                aria-label="Comprobante de pago"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-[13px] text-navy-light/80 font-body file:mr-3 file:rounded-full file:border-0 file:bg-surface-low file:px-3 file:py-1.5 file:text-[13px] file:text-navy"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="ev-pay-ref" className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">Número de referencia</label>
              <input
                id="ev-pay-ref"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="Ej. 2026070212345"
                className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
              />
            </div>
            {error && <p className="text-[13px] text-coral font-body">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={submit}
                disabled={busy || !file}
                className={cn('flex-1 rounded-full px-4 py-2.5 text-sm text-white transition-colors font-body inline-flex items-center justify-center gap-2 bg-coral hover:bg-coral-deep', (busy || !file) && 'opacity-50 cursor-not-allowed')}
              >
                {busy ? <><Loader2 size={15} className="animate-spin" /> Enviando…</> : 'Enviar comprobante'}
              </button>
              <button onClick={onDone} disabled={busy} className="rounded-full border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body">
                Más tarde
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
