'use client'

import { useState, useMemo, useEffect } from 'react'
import { Calendar, DollarSign, X, AlertCircle, CheckCircle2, Loader2, Check } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { MemberCombobox } from '@/components/shared/MemberCombobox'
import { PaymentMethodSelector, type PaymentMethodValue } from '@/components/shared/PaymentMethodSelector'
import { ScholarshipRequestModal } from '@/components/finance/ScholarshipRequestModal'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { formatDateLong } from '@/lib/format'
import type { EventEligibilityResult } from '@/lib/events/eligibility'

function formatCRC(amount: number): string {
  return `₡${amount.toLocaleString('es-CR')}`
}

type RegisterResult = { id: string; amount: number; pricing: { requiresPayment: boolean; exempt: boolean } }

export default function MisEventosPage() {
  const { user } = useAuth()
  const userRoles = user?.roles ?? []
  const isAdminView = userRoles.some(r => ['admin', 'direccion'].includes(r))

  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string } | null>(null)
  const effectiveMemberId = selectedMember?.id ?? user?.member_id ?? null
  const effectiveName = selectedMember?.name ?? user?.name ?? 'miembro'

  const [eligibility, setEligibility] = useState<EventEligibilityResult[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  const [confirmEvent, setConfirmEvent] = useState<EventEligibilityResult | null>(null)
  const [pendingReceipt, setPendingReceipt] = useState<{ registrationId: string; eventTitle: string; amount: number } | null>(null)
  const [successEvent, setSuccessEvent] = useState<string | null>(null)
  const [scholarshipTarget, setScholarshipTarget] = useState<{ entity_type: 'event'; id: string; name: string } | null>(null)
  const [registerError, setRegisterError] = useState<string | null>(null)

  useEffect(() => {
    if (!effectiveMemberId) { setLoading(false); return }
    let alive = true
    setLoading(true)
    setLoadError(false)
    fetch(`/api/eventos/elegibilidad?member_id=${effectiveMemberId}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(d => { if (alive) { setEligibility(d?.eligibility ?? []); setLoading(false) } })
      .catch(() => { if (alive) { setLoadError(true); setLoading(false) } })
    return () => { alive = false }
  }, [effectiveMemberId, retryKey])

  const availableCount = useMemo(() => eligibility.filter(e => e.is_eligible).length, [eligibility])

  async function handleRegister(scholarship?: { scholarship_id?: string; coupon_code?: string }) {
    if (!confirmEvent || !effectiveMemberId) return
    setRegisterError(null)
    try {
      const res = await fetch(`/api/events/${confirmEvent.event_id}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: effectiveMemberId, ...scholarship }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudo completar la inscripción.')
      const result = data as RegisterResult
      setConfirmEvent(null)
      if (result.pricing.requiresPayment && !result.pricing.exempt) {
        // amount: el monto real a cobrar (ya con descuento de beca/cupón aplicado
        // si corresponde) — nunca el precio de lista del evento.
        setPendingReceipt({ registrationId: result.id, eventTitle: confirmEvent.title, amount: result.amount })
      } else {
        setSuccessEvent(confirmEvent.title)
      }
      setRetryKey(k => k + 1)
    } catch (err) {
      console.error('No se pudo inscribir:', err)
      setRegisterError(err instanceof Error ? err.message : 'No se pudo completar la inscripción.')
    }
  }

  if (!effectiveMemberId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-navy-light/60 font-body">No hay un miembro asociado a tu cuenta.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header strip */}
      <div className="rounded-2xl px-6 py-5 bg-navy shadow-card">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Calendar size={18} className="text-white/60" />
              <span className="text-xs uppercase tracking-widest text-white/70 font-display">
                Inscripción a eventos
              </span>
            </div>
            <h1 className="text-2xl text-white font-display font-extrabold tracking-[-0.02em]">
              Mis eventos
            </h1>
            <p className="mt-0.5 text-sm text-white/60 font-body">
              Hola, <span className="text-white font-medium">{effectiveName}</span>
              {' · '}{availableCount} evento{availableCount !== 1 ? 's' : ''} disponible{availableCount !== 1 ? 's' : ''}
            </p>
          </div>

          {isAdminView && (
            <div className="flex flex-col gap-1 w-64">
              <label className="text-[10px] uppercase tracking-widest text-white/70 font-display">
                Ver disponibilidad como:
              </label>
              {selectedMember ? (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm text-white">
                  <span className="truncate font-body">{selectedMember.name}</span>
                  <button onClick={() => setSelectedMember(null)} aria-label="Quitar miembro seleccionado" className="text-white/60 hover:text-white shrink-0"><X size={14} /></button>
                </div>
              ) : (
                <MemberCombobox
                  dropdown
                  variant="onDark"
                  pageSize={6}
                  placeholder="Buscar miembro…"
                  onSelect={m => setSelectedMember({ id: m.id, name: `${m.first_name} ${m.last_name}` })}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirmación de éxito (gratis/exento) */}
      {successEvent && (
        <div className="rounded-2xl p-5 flex items-start gap-3 bg-teal/10 border border-teal-deep/20">
          <CheckCircle2 size={20} className="text-teal-deep shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-navy font-body">¡Inscripción confirmada!</p>
            <p className="text-[13px] text-navy-light/70 font-body">Quedaste inscrito/a en {successEvent}.</p>
          </div>
          <button onClick={() => setSuccessEvent(null)} className="ml-auto text-navy-light/60 hover:text-navy"><X size={16} /></button>
        </div>
      )}

      {/* Lista de eventos */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 rounded-full border-2 border-coral border-t-transparent animate-spin" />
        </div>
      ) : loadError ? (
        <div className="rounded-2xl p-12 text-center bg-surface-card shadow-card border border-coral/30">
          <AlertCircle size={28} className="text-coral mx-auto mb-3" />
          <p className="text-sm font-semibold text-navy font-body">No se pudo cargar la inscripción. Probá de nuevo.</p>
          <button
            onClick={() => setRetryKey(k => k + 1)}
            className="mt-4 inline-flex items-center rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors font-body"
          >
            Reintentar
          </button>
        </div>
      ) : eligibility.length === 0 ? (
        <div className="rounded-2xl p-12 text-center bg-surface-card shadow-card">
          <Calendar size={28} className="text-navy-light/60 mx-auto mb-3" />
          <p className="text-sm font-semibold text-navy-light/60 font-body">
            Por ahora no hay eventos con inscripción abierta
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {eligibility.map(ev => (
            <EventCard
              key={ev.event_id}
              event={ev}
              onRegister={() => setConfirmEvent(ev)}
              onRequestScholarship={() => setScholarshipTarget({ entity_type: 'event', id: ev.event_id, name: ev.title })}
            />
          ))}
        </div>
      )}

      {/* Modal de confirmación de inscripción */}
      {confirmEvent && (
        <ConfirmModal
          event={confirmEvent}
          memberId={effectiveMemberId}
          error={registerError}
          onCancel={() => { setConfirmEvent(null); setRegisterError(null) }}
          onConfirm={handleRegister}
        />
      )}

      {/* Formulario de comprobante inmediato tras inscribirse (evento pago) */}
      {pendingReceipt && (
        <ReceiptModal
          registrationId={pendingReceipt.registrationId}
          eventTitle={pendingReceipt.eventTitle}
          amount={pendingReceipt.amount}
          onDone={() => setPendingReceipt(null)}
        />
      )}

      {scholarshipTarget && effectiveMemberId && (
        <ScholarshipRequestModal
          memberId={effectiveMemberId}
          fixedTarget={scholarshipTarget}
          onClose={() => setScholarshipTarget(null)}
        />
      )}
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function EventCard({ event, onRegister, onRequestScholarship }: {
  event: EventEligibilityResult; onRegister: () => void; onRequestScholarship: () => void
}) {
  return (
    <div className={cn('rounded-2xl overflow-hidden p-5 space-y-3 bg-surface-card shadow-card', !event.is_eligible && 'opacity-60')}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-base font-bold text-navy leading-snug font-display">{event.title}</p>
        {event.already_registered && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-teal-soft/30 text-teal-deep font-display shrink-0">
            Ya inscrito/a
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-[12px] text-navy-light/60 font-body">
        <span className="flex items-center gap-1"><Calendar size={12} /> {formatDateLong(event.starts_at)}</span>
        {event.requires_payment && !event.exempt ? (
          <span className="flex items-center gap-1 text-coral"><DollarSign size={12} /> {formatCRC(event.price)}</span>
        ) : (
          <span className="flex items-center gap-1 text-teal-deep"><DollarSign size={12} /> Gratuito</span>
        )}
        {event.requires_payment && !event.exempt && (
          <button
            type="button"
            onClick={onRequestScholarship}
            className="ml-auto text-[11px] text-coral hover:text-coral-deep transition-colors font-body underline decoration-dotted"
          >
            ¿Necesitás ayuda para pagar? Solicitar beca
          </button>
        )}
      </div>
      {event.spots_available != null && (
        <p className="text-[11px] text-navy-light/60 font-body">{event.spots_available} cupo{event.spots_available !== 1 ? 's' : ''} disponible{event.spots_available !== 1 ? 's' : ''}</p>
      )}
      {event.reasons_blocked.length > 0 && (
        <p className="text-[12px] text-navy-light/60 font-body">{event.reasons_blocked[0]}</p>
      )}
      {event.is_eligible && (
        <button
          onClick={onRegister}
          className="w-full rounded-xl bg-coral/10 hover:bg-coral/20 px-4 py-2.5 text-[13px] font-medium text-coral transition-colors font-body"
        >
          Inscribirme
        </button>
      )}
    </div>
  )
}

type ApplicableScholarship = { id: string; discount_type: 'percentage' | 'fixed'; discount_value: number }

function ConfirmModal({ event, memberId, error, onCancel, onConfirm }: {
  event: EventEligibilityResult
  memberId: string | null
  error: string | null
  onCancel: () => void
  onConfirm: (scholarship?: { scholarship_id?: string; coupon_code?: string }) => void
}) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>('sinpe')
  const requiresPayment = event.requires_payment && !event.exempt

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

  function handleConfirm() {
    if (applicable && useScholarship) onConfirm({ scholarship_id: applicable.id })
    else if (couponCode.trim()) onConfirm({ coupon_code: couponCode.trim() })
    else onConfirm()
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
              <span className="w-24 text-[11px] text-navy-light/60 uppercase tracking-wider shrink-0 font-display">{label}</span>
              <span className="text-[13px] font-medium text-navy font-body">{value}</span>
            </div>
          ))}
        </div>
        <div className="flex items-start gap-2.5 rounded-xl px-3 py-3 bg-coral/7 border border-coral/20">
          <AlertCircle size={14} className="text-coral shrink-0 mt-0.5" />
          <p className="text-[12px] text-navy-light/70 font-body">
            {requiresPayment
              ? 'Al confirmar, tu cupo queda reservado mientras subís el comprobante y un revisor lo aprueba.'
              : 'Al confirmar, tu inscripción queda lista de una vez.'}
          </p>
        </div>
        {requiresPayment && (
          <div className="space-y-2">
            {applicable ? (
              <label className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 bg-teal-soft/10 border border-teal-deep/20 cursor-pointer">
                <input type="checkbox" checked={useScholarship} onChange={e => setUseScholarship(e.target.checked)} />
                <span className="text-[13px] text-navy font-body">
                  Usar mi beca ({applicable.discount_type === 'percentage' ? `${applicable.discount_value}%` : `₡${applicable.discount_value.toLocaleString('es-CR')}`} de descuento)
                  {discountedAmount != null && <span className="block text-[11px] text-teal-deep font-semibold">Nuevo total: {formatCRC(discountedAmount)}</span>}
                </span>
              </label>
            ) : (
              <div className="space-y-1">
                <label htmlFor="coupon-code-evento" className="text-[11px] uppercase tracking-widest text-navy-light/60 font-display">¿Tenés un código de descuento?</label>
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
        {error && <p className="text-[13px] text-coral font-body">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} className="flex-1 rounded-xl border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors border-outline font-body">Cancelar</button>
          <button onClick={handleConfirm} className="flex-1 rounded-xl bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-medium font-body">Confirmar inscripción</button>
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
            <p className="text-[13px] text-navy-light/70 font-body">
              Tu inscripción a {eventTitle} quedó pendiente de aprobación de pago. Te avisamos si hay algún problema.
            </p>
            <button onClick={onDone} className="rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body">Listo</button>
          </div>
        ) : (
          <>
            <h3 id="comprobante-evento-title" className="text-base font-bold text-navy font-display">Pagar inscripción</h3>
            <p className="text-[13px] text-navy-light/70 font-body">
              {eventTitle} — {`₡${amount.toLocaleString('es-CR')}`}. Subí el comprobante (screenshot del SINPE o transferencia) y el número de referencia.
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
              <label htmlFor="ev-pay-ref" className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display">Número de referencia</label>
              <input
                id="ev-pay-ref"
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
