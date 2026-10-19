'use client'

// PAG-1: lista de pagos/cobros de un miembro con botón de pago (subir
// comprobante) para matrícula y eventos. Extraída de MemberParticipationTab
// para reutilizarla en /mis-pagos. `highlightId` (deep link ?pago=<id> de las
// notificaciones) resalta y hace scroll al pago indicado.

import { useState, useEffect, useRef, useCallback } from 'react'
import { Check, CreditCard, Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/shared/Button'
import { formatDate, formatMoney, ymdCR } from '@/lib/format'
import { useAuth } from '@/hooks/useAuth'
import { puedeAplicarBeca, cobroAdmiteBeca } from '@/lib/finance/quien-aplica-beca'
import { AplicarBecaEnCobro } from '@/components/finance/AplicarBecaEnCobro'
import { RegistrarPaqueteDeNiveles } from '@/components/finance/RegistrarPaqueteDeNiveles'
import { puedeRegistrarPaquete } from '@/lib/finance/paquete-de-niveles'
import {
  isOverdue, planInstallments, MIN_INSTALLMENTS, MAX_INSTALLMENTS, type PlanFrequency,
} from '@/lib/finance/installments'
import { opcionesPermitidas } from '@/lib/finance/limites-de-arreglo'
import type { MemberPaymentRow } from '@/lib/supabase/queries/payments'
import { Modal } from '@/components/shared/Modal'
import { FormularioDeComprobante } from '@/components/finance/FormularioDeComprobante'
import { BarraDePagoJunto } from '@/components/finance/PagarVariosJuntos'
import { ofrecerPagoJunto, sePuedeIncluir } from '@/lib/finance/comprobante-multiple'

/** Estado visual de un pago del miembro. */
export function paymentBadge(p: MemberPaymentRow): { label: string; cls: string } {
  if (p.queue_status === 'en_revision') return { label: 'En revisión', cls: 'bg-amber-50 text-amber-700' }
  if (p.queue_status === 'pendiente') return { label: 'Pendiente', cls: 'bg-coral/10 text-coral-deep' }
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
  if (p.status === 'paid') return { label: 'Pagado', cls: 'bg-teal-soft/30 text-teal-ink' }
  if (p.status === 'refunded' || p.status === 'partial_refund') return { label: 'Devuelto', cls: 'bg-navy/5 text-navy-light/80' }
  return { label: 'Cancelado', cls: 'bg-surface-low text-navy-light/80' }
}

/** Lista los pagos del miembro (fetch propio). Los pendientes de matrícula/
 *  evento muestran botón para pagar. Gate en el endpoint: el propio miembro,
 *  su familia o el staff de finanzas. */
export function MemberPaymentsList({ memberId, highlightId, onlyActionable = false, permitirPagoJunto = false }: {
  memberId: string
  /** Pago a resaltar (deep link de notificaciones: /mis-pagos?pago=<id>). */
  highlightId?: string | null
  /** Solo pendientes + en revisión (la vista "mis pagos" esconde el historial cerrado). */
  onlyActionable?: boolean
  /** PAG-5 · Ofrecer «pagar varios con un comprobante». Solo en Mis pagos:
   *  en la ficha de un miembro quien mira es staff y tiene otras vías. */
  permitirPagoJunto?: boolean
}) {
  // PAG-5 · null = modo normal; un Set = modo selección (puede estar vacío).
  const [seleccion, setSeleccion] = useState<Set<string> | null>(null)
  const [rows, setRows] = useState<MemberPaymentRow[] | null>(null)
  // El mensaje y no un booleano: ver si fue permiso o caída cambia a quién llamar.
  const [error, setError] = useState<string | null>(null)
  const highlightRef = useRef<HTMLDivElement | null>(null)

  // Si memberId puede cambiar (pestañas de familia en /mis-pagos), remontar
  // con key={memberId} — acá no se resetea estado en el effect.
  const cargar = useCallback(() => {
    fetch(`/api/members/${memberId}/payments`)
      .then(async r => {
        if (!r.ok) {
          const { mensajeDeLaRespuesta } = await import('@/lib/api/mensaje-del-error')
          throw new Error(await mensajeDeLaRespuesta(r, 'No se pudieron cargar los pagos.'))
        }
        return r.json()
      })
      .then((d: MemberPaymentRow[]) => setRows(d))
      .catch((e: Error) => setError(e.message || 'No se pudieron cargar los pagos.'))
  }, [memberId])
  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    if (rows && highlightId) highlightRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [rows, highlightId])

  if (error) return <p className="px-4 py-3 text-[13px] text-coral-deep font-body">{error}</p>
  if (!rows) return <p className="px-4 py-6 text-center text-[13px] text-navy-light/80 font-body">Cargando…</p>

  const visible = onlyActionable ? rows.filter(p => p.queue_status === 'pendiente' || p.queue_status === 'en_revision') : rows
  const ofreceJunto = permitirPagoJunto && ofrecerPagoJunto(visible)
  const enSeleccion = seleccion !== null
  const elegidos = visible.filter(p => seleccion?.has(p.id))
  if (visible.length === 0) {
    return <p className="px-4 py-6 text-center text-[13px] text-navy-light/80 font-body">{onlyActionable ? 'Sin pagos pendientes. 🎉' : 'Sin pagos ni cobros registrados.'}</p>
  }

  // Corte en hora de Costa Rica: con UTC un tracto podía verse vencido de noche.
  const todayYmd = ymdCR()

  return (
    <div className="divide-y divide-[var(--outline-variant)]">
      {/* PAG-5 · La entrada al modo. Solo si de verdad hay dos pendientes:
          un botón que lleva a una pantalla donde no se puede hacer nada es
          peor que no tenerlo. */}
      {ofreceJunto && !enSeleccion && (
        <div className="flex justify-end px-4 py-2">
          <button
            type="button"
            onClick={() => setSeleccion(new Set())}
            className="inline-flex items-center gap-1.5 text-[13px] text-navy-light/80 hover:text-coral-deep transition-colors font-body"
          >
            <Receipt size={13} aria-hidden="true" /> Pagué varios con una sola transferencia
          </button>
        </div>
      )}
      {visible.map(p => {
        const badge = paymentBadge(p)
        const canPay = p.queue_status === 'pendiente'
        const highlighted = p.id === highlightId
        const seleccionable = enSeleccion && sePuedeIncluir(p)
        return (
          <div
            key={p.id}
            ref={highlighted ? highlightRef : undefined}
            className={cn('flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3', highlighted && 'ring-2 ring-coral/50 rounded-xl bg-coral/5')}
          >
            {/* PAG-5 · El monto va en la etiqueta porque la descripción se
                repite: dos inscripciones a eventos distintos dicen las dos
                «Evento», y con lector de pantalla quedaban dos casillas
                idénticas. */}
            {enSeleccion && (
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 accent-coral sm:mt-0"
                checked={!!seleccion?.has(p.id)}
                disabled={!seleccionable}
                aria-label={`Incluir ${p.description} de ${formatMoney(p.amount, p.currency)} en el comprobante`}
                onChange={e => setSeleccion(prev => {
                  const s = new Set(prev)
                  if (e.target.checked) s.add(p.id); else s.delete(p.id)
                  return s
                })}
              />
            )}
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
              {!enSeleccion && canPay && p.payment_plan_enabled && !p.payment_plan_id && (
                <BotonAcogerseAlArreglo pago={p} onHecho={cargar} />
              )}
              {!enSeleccion && canPay && p.enrollment_id && <PayMatriculaButton enrollmentId={p.enrollment_id} retry={false} cobro={p} />}
              {!enSeleccion && canPay && !p.enrollment_id && p.event_registration_id && <PayEventRegistrationButton registrationId={p.event_registration_id} retry={false} cobro={p} />}
            </div>
          </div>
        )
      })}
      {enSeleccion && (
        <BarraDePagoJunto
          memberId={memberId}
          seleccionados={elegidos}
          onCancelar={() => setSeleccion(null)}
          onListo={() => { setSeleccion(null); cargar() }}
        />
      )}
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
      /**
       * El silencio acá SÍ es a propósito, a diferencia del resto de la
       * tanda del 2026-10-13: esta consulta solo ENRIQUECE el modal con el
       * cobro que ya se está mirando. Si falla, el modal sigue funcionando
       * con lo que recibió por props; un mensaje de error encima de un
       * modal que anda bien sería ruido.
       */
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

// ── Pagar con comprobante ───────────────────────────────────────────────────
/**
 * El modal de «subí el comprobante y la referencia», UNA vez (QA-3 tanda 4,
 * 2026-10-15). Matrícula e inscripción a evento eran dos copias de casi cien
 * líneas cada una; solo cambian el texto, a dónde se manda y que matrícula
 * puede aplicar una beca adentro (`extra`).
 */
function PagarConComprobante({ id, titulo, etiqueta, retry, enviar, cobro, memberId, buscar, extra }: {
  /** Prefijo de los ids de los campos: dos modales en la misma página no chocan. */
  id: string
  titulo: string
  etiqueta: string
  retry: boolean
  /** Arma el POST: a qué URL y qué campos además del archivo y la referencia. */
  enviar: { url: string; campos?: Record<string, string> }
  /** El cobro, si quien llama ya lo tiene; si no, se busca AL ABRIR. */
  cobro?: MemberPaymentRow
  memberId?: string
  buscar: (r: MemberPaymentRow) => boolean
  /** Lo que va entre la referencia y el botón (la beca, en matrícula). Recibe
   *  el cobro y cómo cerrar el modal. */
  extra?: (detalle: MemberPaymentRow | null, cerrar: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  // Solo al abrir: una lista con veinte cobros no hace veinte consultas.
  const detalle = useCobro({ open, cobro, memberId, buscar })
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

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
        className="inline-flex items-center gap-1 rounded-full border border-coral/40 text-coral-deep px-2.5 py-1 text-[13px] hover:bg-coral/5 transition-colors whitespace-nowrap font-body"
      >
        <CreditCard size={12} /> {retry ? 'Reintentar pago' : etiqueta}
      </button>
      {open && (
        <Modal onClose={() => !busy && setOpen(false)} titleId={`${id}-title`} width={420}>
          <div className="p-6 space-y-4">
            <h3 id={`${id}-title`} className="text-base font-bold text-navy font-display">{titulo}</h3>
            <p className="text-[13px] text-navy-light/80 font-body">
              Subí el comprobante (screenshot del SINPE o transferencia) y el número de referencia. Un revisor lo verificará.
            </p>
            {detalle && <DetalleDelCobro p={detalle} />}
            <FormularioDeComprobante
              id={id} enviar={enviar}
              onEnviado={() => { setDone(true); setOpen(false) }}
              onCancelar={() => setOpen(false)}
              onOcupado={setBusy}
              antesDelEnvio={extra?.(detalle, () => setOpen(false))}
            />
          </div>
        </Modal>
      )}
    </>
  )
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
  /**
   * Este modal se abre también desde «mis pagos», donde lo usa la propia
   * persona. Sin este corte, cualquiera se aplicaría una beca a sí mismo. La
   * regla se comparte con la cola de finanzas en vez de reescribirse acá.
   */
  const { user } = useAuth()
  const puedeBeca = puedeAplicarBeca(user?.roles)
  const puedePaquete = puedeRegistrarPaquete(user?.roles)
  return (
    <PagarConComprobante
      id="pay" titulo="Pagar matrícula" etiqueta="Pagar matrícula" retry={retry}
      enviar={{ url: '/api/payments', campos: { enrollment_id: enrollmentId } }}
      cobro={cobro} memberId={memberId} buscar={r => r.enrollment_id === enrollmentId}
      /**
       * BEC-1 · Aplicar beca, DENTRO del modal (Floriana, 2026-10-09: «en el
       * modal de los pagos de estudios, aún no me da la opción de aplicar
       * beca»). Va acá y no al lado del botón de la lista: la fila del
       * HISTORIAL DE ESTUDIOS no pasa por `MemberPaymentsList`, llama a este
       * botón directo. Si la beca cubre todo, el cobro queda aprobado y el
       * modal se cierra: pedirle el comprobante después sería pedirle que
       * pruebe un pago que no tiene que hacer.
       */
      extra={(detalle, cerrar) => detalle && (
        <>
          {puedeBeca && cobroAdmiteBeca(detalle) && (
            <div className="rounded-xl bg-surface-low p-3">
              <AplicarBecaEnCobro
                pagoId={detalle.id}
                monto={detalle.amount}
                currency={detalle.currency ?? 'CRC'}
                onAplicada={cerrar}
              />
            </div>
          )}
          {/* 2026-10-19 · Paquete de niveles (legacy): el servidor dice si
              este cobro lo admite; acá solo se ofrece a quien revisa pagos. */}
          {puedePaquete && cobroAdmiteBeca(detalle) && (
            <div className="rounded-xl bg-surface-low p-3">
              <RegistrarPaqueteDeNiveles pagoId={detalle.id} onRegistrado={cerrar} />
            </div>
          )}
        </>
      )}
    />
  )
}

// ── Botón de pago de inscripción a evento por comprobante ────────────────────
export function PayEventRegistrationButton({ registrationId, retry, cobro, memberId }: {
  registrationId: string
  retry: boolean
  cobro?: MemberPaymentRow
  memberId?: string
}) {
  return (
    <PagarConComprobante
      id="pay-event" titulo="Pagar inscripción" etiqueta="Pagar inscripción" retry={retry}
      enviar={{ url: `/api/event-registrations/${registrationId}/comprobante` }}
      cobro={cobro} memberId={memberId} buscar={r => r.event_registration_id === registrationId}
    />
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
