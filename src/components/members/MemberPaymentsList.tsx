'use client'

// PAG-1: lista de pagos/cobros de un miembro con botón de pago (subir
// comprobante) para matrícula y eventos. Extraída de MemberParticipationTab
// para reutilizarla en /mis-pagos. `highlightId` (deep link ?pago=<id> de las
// notificaciones) resalta y hace scroll al pago indicado.

import { useState, useEffect, useRef, useCallback } from 'react'
import { Check, CreditCard, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/shared/Button'
import { formatDate, formatMoney, ymdCR } from '@/lib/format'
import { useAuth } from '@/hooks/useAuth'
import { puedeAplicarBeca, cobroAdmiteBeca } from '@/lib/finance/quien-aplica-beca'
import { AplicarBecaEnCobro } from '@/components/finance/AplicarBecaEnCobro'
import {
  isOverdue, planInstallments, MIN_INSTALLMENTS, MAX_INSTALLMENTS, type PlanFrequency,
} from '@/lib/finance/installments'
import { opcionesPermitidas } from '@/lib/finance/limites-de-arreglo'
import type { MemberPaymentRow } from '@/lib/supabase/queries/payments'
import { Modal } from '@/components/shared/Modal'

/** Estado visual de un pago del miembro. */
export function paymentBadge(p: MemberPaymentRow): { label: string; cls: string } {
  if (p.queue_status === 'en_revision') return { label: 'En revisión', cls: 'bg-amber-50 text-amber-700' }
  if (p.queue_status === 'pendiente') return { label: 'Pendiente', cls: 'bg-coral/10 text-coral' }
  /**
   * PAG-6 · Acá dice «Pagado» A PROPÓSITO, aunque en las pantallas de
   * finanzas el mismo estado se escriba «Cancelado».
   *
   * No es una inconsistencia olvidada: en contabilidad «cancelar» es pagar,
   * pero para la persona que mira su propio cobro «Cancelado» significa que
   * se lo anularon — lo contrario. Decidido con Floriana el 2026-10-05.
   * Si esto se "arregla" para que coincida, se le va a estar diciendo a la
   * gente que su pago no existe.
   */
  if (p.status === 'paid') return { label: 'Pagado', cls: 'bg-teal-soft/30 text-teal-deep' }
  if (p.status === 'refunded' || p.status === 'partial_refund') return { label: 'Devuelto', cls: 'bg-navy/5 text-navy-light/80' }
  return { label: 'Cancelado', cls: 'bg-surface-low text-navy-light/80' }
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
  const cargar = useCallback(() => {
    fetch(`/api/members/${memberId}/payments`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: MemberPaymentRow[]) => setRows(d))
      .catch(() => setError(true))
  }, [memberId])
  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    if (rows && highlightId) highlightRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [rows, highlightId])

  if (error) return <p className="px-4 py-3 text-[13px] text-coral font-body">No se pudieron cargar los pagos.</p>
  if (!rows) return <p className="px-4 py-6 text-center text-[13px] text-navy-light/80 font-body">Cargando…</p>

  const visible = onlyActionable ? rows.filter(p => p.queue_status === 'pendiente' || p.queue_status === 'en_revision') : rows
  if (visible.length === 0) {
    return <p className="px-4 py-6 text-center text-[13px] text-navy-light/80 font-body">{onlyActionable ? 'Sin pagos pendientes. 🎉' : 'Sin pagos ni cobros registrados.'}</p>
  }

  // Corte en hora de Costa Rica: con UTC un tracto podía verse vencido de noche.
  const todayYmd = ymdCR()

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
              <p className="text-[13px] text-navy-light/80 font-body">
                {formatMoney(p.amount, p.currency)} · {formatDate(p.created_at)}
              </p>
              {/* FIN-4: un tracto muestra SU vencimiento, y avisa si ya pasó —
                  un tracto vencido bloquea matricularse y otros eventos. */}
              {p.due_date && (
                <p className={cn(
                  'text-[13px] font-body',
                  isOverdue({ due_date: p.due_date, status: p.status }, todayYmd)
                    ? 'text-coral-deep font-medium'
                    : 'text-navy-light/80',
                )}>
                  {isOverdue({ due_date: p.due_date, status: p.status }, todayYmd)
                    ? `Venció el ${formatDate(p.due_date)}`
                    : `Vence el ${formatDate(p.due_date)}`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={cn('rounded-full px-2.5 py-0.5 text-[13px] font-semibold font-display', badge.cls)}>{badge.label}</span>
              {/* FIN-13 · La opción de arreglo aparece SOLO si finanzas se
                  la habilitó a esta persona sobre este cobro. No hay botón
                  público: el de becas nunca se promocionó y la gente curiosa
                  lo encontró igual, así que uno abierto volvería la excepción
                  la vía normal de pago. */}
              {canPay && p.payment_plan_enabled && !p.payment_plan_id && (
                <BotonAcogerseAlArreglo pago={p} onHecho={cargar} />
              )}
              {canPay && p.enrollment_id && <PayMatriculaButton enrollmentId={p.enrollment_id} retry={false} cobro={p} />}
              {canPay && !p.enrollment_id && p.event_registration_id && <PayEventRegistrationButton registrationId={p.event_registration_id} retry={false} cobro={p} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * El cobro que se va a pagar: el que ya traía quien llama, o el que se busca
 * al abrir la ventana.
 *
 * Devuelve `null` mientras no haya nada que mostrar, y la ventana sale sin la
 * tabla. NO se bloquea el formulario esperando: el comprobante se puede subir
 * igual, y trabar el pago por un detalle informativo sería cambiar un
 * problema chico por uno grande.
 */
function useCobro({ open, cobro, memberId, buscar }: {
  open: boolean
  cobro?: MemberPaymentRow
  memberId?: string
  buscar: (r: MemberPaymentRow) => boolean
}): MemberPaymentRow | null {
  const [traido, setTraido] = useState<MemberPaymentRow | null>(null)
  const yaLoTengo = !!cobro
  useEffect(() => {
    if (!open || yaLoTengo || !memberId) return
    let vivo = true
    fetch(`/api/members/${memberId}/payments`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: MemberPaymentRow[]) => { if (vivo) setTraido(d.find(buscar) ?? null) })
      .catch(() => {})
    return () => { vivo = false }
    // `buscar` se recrea en cada render; la dependencia real es a quién y
    // cuándo, no la identidad de la función.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, yaLoTengo, memberId])
  return cobro ?? traido
}

/**
 * El detalle del cobro, igual al que ve finanzas en su tiquete.
 *
 * POR QUÉ SE REPITE ACÁ (2026-10-05). La ventana de pago de la ficha pedía
 * el comprobante sin decir de qué: ni monto, ni origen, ni desde cuándo está
 * abierto el cobro. Quien la abría tenía que cerrarla para ir a leer el monto
 * en la lista de atrás y volver. Finanzas ya mostraba las siete líneas; la
 * persona merecía las mismas.
 *
 * LO QUE NO SE COPIA, a propósito: el arreglo de pago. Acá el único camino es
 * pagar. El arreglo no es una opción que la persona elige desde esta ventana
 * —finanzas lo habilita caso por caso (FIN-13)— y ponerlo al lado del botón
 * de pagar lo volvería la vía normal.
 */
export function DetalleDelCobro({ p: cobro }: { p: MemberPaymentRow }) {
  const fecha = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('es-CR', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
  const filas: [string, string][] = [
    ['Persona', cobro.member_name],
    ['Origen', CONCEPTO_LABEL[cobro.concept ?? ''] ?? 'Pago'],
    ['Descripción', cobro.description],
    ['Monto esperado', formatMoney(cobro.amount, cobro.currency)],
    ['Referencia', cobro.reference_code ?? '—'],
    ['Creado', fecha(cobro.created_at)],
    ['Última gestión', fecha(cobro.reviewed_at)],
  ]
  return (
    <div className="rounded-xl border border-outline overflow-hidden">
      {filas.map(([label, valor], i) => (
        <div key={label} className={cn('flex gap-3 px-4 py-2.5', i > 0 && 'border-t border-outline')}>
          <span className="w-32 shrink-0 text-[13px] uppercase tracking-wider text-navy-light/80 font-display">{label}</span>
          <span className="text-[13px] text-navy font-body">{valor}</span>
        </div>
      ))}
    </div>
  )
}

/** El mismo texto que usa la cola de finanzas para el origen del cobro. */
const CONCEPTO_LABEL: Record<string, string> = {
  matricula: 'Matrícula',
  evento: 'Evento',
  folletos: 'Folleto',
  prematrimonial: 'Prematrimonial',
  donacion: 'Donación',
}

// ── Botón de pago de matrícula por comprobante ───────────────────────────────
export function PayMatriculaButton({ enrollmentId, retry, cobro, memberId }: {
  enrollmentId: string
  retry: boolean
  /** La fila del cobro, cuando quien llama ya la tiene (la lista de pagos). */
  cobro?: MemberPaymentRow
  /** Si no la tiene (la fila de estudios de la ficha), de acá se busca al
   *  abrir. Una sola consulta, y solo cuando la ventana se abre. */
  memberId?: string
}) {
  const [open, setOpen] = useState(false)
  const detalle = useCobro({ open, cobro, memberId, buscar: r => r.enrollment_id === enrollmentId })
  /**
   * Este modal se abre también desde «mis pagos», donde lo usa la propia
   * persona. Sin este corte, cualquiera se aplicaría una beca a sí mismo. La
   * regla se comparte con la cola de finanzas en vez de reescribirse acá.
   */
  const { user } = useAuth()
  const puedeBeca = puedeAplicarBeca(user?.roles)
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
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2.5 py-0.5 text-[13px] font-semibold font-display">
        <Check size={11} /> Comprobante enviado
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-coral/40 text-coral px-2.5 py-1 text-[13px] hover:bg-coral/5 transition-colors whitespace-nowrap font-body"
      >
        <CreditCard size={12} /> {retry ? 'Reintentar pago' : 'Pagar matrícula'}
      </button>
      {open && (
        <Modal onClose={() => !busy && setOpen(false)} titleId="pay-title" width={420}>
          <div className="p-6 space-y-4">
            <h3 id="pay-title" className="text-base font-bold text-navy font-display">Pagar matrícula</h3>
            <p className="text-[13px] text-navy-light/80 font-body">
              Subí el comprobante (screenshot del SINPE o transferencia) y el número de referencia. Un revisor lo verificará.
            </p>
            {detalle && <DetalleDelCobro p={detalle} />}
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
              <label htmlFor="pay-ref" className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">Número de referencia</label>
              <input
                id="pay-ref"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="Ej. 2026070212345"
                className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
              />
            </div>
            {/**
              * BEC-1 · Aplicar beca, DENTRO del modal (Floriana, 2026-10-09:
              * «en el modal de los pagos de estudios, aún no me da la opción
              * de aplicar beca»).
              *
              * Va acá y no al lado del botón de la lista, que fue mi primer
              * intento: la fila del HISTORIAL DE ESTUDIOS —que es desde donde
              * ella lo abrió— no pasa por `MemberPaymentsList`, llama a este
              * botón directo. En el modal lo ven los DOS caminos, y además es
              * el único lugar donde ya está cargado el cobro con su id.
              *
              * Si la beca cubre todo, el cobro queda aprobado y el modal se
              * cierra: pedirle el comprobante después sería pedirle que
              * pruebe un pago que no tiene que hacer.
              */}
            {puedeBeca && detalle && cobroAdmiteBeca(detalle) && (
              <div className="rounded-xl bg-surface-low p-3">
                <AplicarBecaEnCobro
                  pagoId={detalle.id}
                  monto={detalle.amount}
                  currency={detalle.currency ?? 'CRC'}
                  onAplicada={() => setOpen(false)}
                />
              </div>
            )}
            {error && <p className="text-[13px] text-coral font-body">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={submit}
                disabled={busy || !file}
                className={cn('flex-1 rounded-full px-4 py-2.5 text-sm text-white transition-colors font-body inline-flex items-center justify-center gap-2 bg-coral shadow-[var(--shadow-pulse-sm)] hover:bg-coral-deep', (busy || !file) && 'opacity-50 cursor-not-allowed')}
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
export function PayEventRegistrationButton({ registrationId, retry, cobro, memberId }: {
  registrationId: string
  retry: boolean
  cobro?: MemberPaymentRow
  memberId?: string
}) {
  const [open, setOpen] = useState(false)
  const detalle = useCobro({ open, cobro, memberId, buscar: r => r.event_registration_id === registrationId })
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
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2.5 py-0.5 text-[13px] font-semibold font-display">
        <Check size={11} /> Comprobante enviado
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-coral/40 text-coral px-2.5 py-1 text-[13px] hover:bg-coral/5 transition-colors whitespace-nowrap font-body"
      >
        <CreditCard size={12} /> {retry ? 'Reintentar pago' : 'Pagar inscripción'}
      </button>
      {open && (
        <Modal onClose={() => !busy && setOpen(false)} titleId="pay-event-title" width={420}>
          <div className="p-6 space-y-4">
            <h3 id="pay-event-title" className="text-base font-bold text-navy font-display">Pagar inscripción</h3>
            <p className="text-[13px] text-navy-light/80 font-body">
              Subí el comprobante (screenshot del SINPE o transferencia) y el número de referencia. Un revisor lo verificará.
            </p>
            {detalle && <DetalleDelCobro p={detalle} />}
            <div className="space-y-1">
              <label htmlFor="comprobante-imagen-2" className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">Comprobante (imagen)</label>
              <input id="comprobante-imagen-2"
                type="file"
                accept="image/*"
                aria-label="Comprobante de pago"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-[13px] text-navy-light/80 font-body file:mr-3 file:rounded-full file:border-0 file:bg-surface-low file:px-3 file:py-1.5 file:text-[13px] file:text-navy"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="pay-event-ref" className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">Número de referencia</label>
              <input
                id="pay-event-ref"
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
                className={cn('flex-1 rounded-full px-4 py-2.5 text-sm text-white transition-colors font-body inline-flex items-center justify-center gap-2 bg-coral shadow-[var(--shadow-pulse-sm)] hover:bg-coral-deep', (busy || !file) && 'opacity-50 cursor-not-allowed')}
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

/**
 * FIN-13 · «Pagar en tractos», del lado de la persona.
 *
 * Solo se monta si finanzas habilitó ESTE cobro para ELLA. Lo que elige es
 * nada más la cantidad de tractos: la frecuencia y la fecha tope las decide
 * el tipo de objeto —una actividad va quincenal y tiene que quedar cobrada
 * antes de arrancar— y pedírselas a la persona sería ofrecerle combinaciones
 * que el servidor va a rechazar.
 *
 * Los vencimientos se muestran ANTES de confirmar, calculados con la misma
 * función del servidor. Comprometerse a tractos sin ver las fechas es
 * firmar en blanco, y deshacerlo no es gratis: el primer tracto REUSA el
 * pago original.
 */
function BotonAcogerseAlArreglo({ pago, onHecho }: {
  pago: MemberPaymentRow
  onHecho: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [tractos, setTractos] = useState(2)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Una matrícula es de estudio; lo demás, de actividad. La frecuencia la
  // impone esa diferencia (FIN-13), no una preferencia.
  const esEvento = !pago.enrollment_id
  const frequency: PlanFrequency = esEvento ? 'quincenal' : 'mensual'
  const maxTractos = opcionesPermitidas(esEvento ? 'evento' : 'estudio', MAX_INSTALLMENTS).maxTractos
  const hoy = ymdCR()
  const cuotas = planInstallments({
    total: pago.amount, count: tractos, firstDue: hoy,
    currency: pago.currency, frequency,
  })

  async function confirmar() {
    if (enviando) return
    setEnviando(true); setError(null)
    try {
      const res = await fetch(`/api/payments/${pago.id}/payment-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installments: tractos, first_due: hoy, frequency }),
      })
      const data = await res.json().catch(() => null)
      // El mensaje del servidor dice QUÉ regla no se cumplió (la fecha, los
      // tractos). Reemplazarlo por uno genérico dejaría a la persona sin
      // saber qué cambiar.
      if (!res.ok) throw new Error(data?.error || 'No se pudo crear el arreglo.')
      setAbierto(false)
      onHecho()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el arreglo.')
    } finally {
      setEnviando(false)
    }
  }

  if (!abierto) {
    return (
      <Button variante="secundario" tamano="sm" onClick={() => setAbierto(true)}>
        Pagar en tractos
      </Button>
    )
  }

  return (
    <div className="w-full rounded-xl border border-navy/15 p-3 space-y-2 sm:w-80">
      <p className="text-[13px] font-semibold text-navy font-display">Pagar en tractos</p>
      <p className="text-[13px] text-navy-light/80 font-body">
        {formatMoney(pago.amount, pago.currency)} se parte en partes que suman lo mismo.
        No es un descuento: es el mismo monto, repartido.
      </p>
      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <label htmlFor={`tractos-${pago.id}`} className="block text-[13px] text-navy-light/80 font-display">
            Tractos
          </label>
          <input
            id={`tractos-${pago.id}`}
            type="number"
            min={MIN_INSTALLMENTS}
            max={maxTractos}
            value={tractos}
            onChange={e => setTractos(Number(e.target.value))}
            className="w-20 rounded-xl bg-surface-low px-3 py-1.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
          />
        </div>
        <p className="pb-2 text-[13px] text-navy-light/80 font-body">de {MIN_INSTALLMENTS} a {maxTractos}</p>
      </div>
      {cuotas.length > 0 && (
        <div className="rounded-xl bg-surface-low/60 px-3 py-2">
          <p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display mb-1">
            Cuándo vence cada uno
          </p>
          <ul className="space-y-0.5">
            {cuotas.map(c => (
              <li key={c.number} className="text-[13px] text-navy font-body">
                {formatDate(c.due_date)} · {formatMoney(c.amount, pago.currency)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <p className="text-[13px] text-coral-deep font-body">{error}</p>}
      <div className="flex gap-2">
        <Button
          variante="navy" tamano="sm"
          onClick={confirmar}
          disabled={enviando || cuotas.length === 0}
        >
          {enviando ? '…' : 'Confirmar'}
        </Button>
        <Button
          variante="secundario" tamano="sm"
          onClick={() => { setAbierto(false); setError(null) }}
          disabled={enviando}
        >
          Cancelar
        </Button>
      </div>
    </div>
  )
}
