'use client'

// Comprobante de una matrícula con costo.
//
// REGLA (2026-08-06): SIEMPRE se pide. La matrícula ya quedó efectiva —el pago
// va por su carril y no la deshace— pero el comprobante se pide en el momento,
// que es cuando la persona tiene la captura a mano. Esc y el fondo no cierran:
// abren el aviso de MAT-3, que dice el estado real (matrícula viva, pendiente,
// con fecha de vencimiento) y desde ahí se puede volver o cancelar.
//
// Vive acá (y no dentro de la pantalla de matrícula) porque lo usan los DOS
// caminos: el autoservicio de /matricula y el staff agregando a alguien desde
// la ficha del grupo.
import { useEffect, useState } from 'react'
import { Check, Loader2, AlertCircle, TriangleAlert } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { formatMoney, amountStep } from '@/lib/format'
import { declaredAmountMismatch } from '@/lib/finance/payment-breakdown'
import { cn } from '@/lib/utils'
import { PaymentInstructions } from '@/components/finance/PaymentInstructions'
import { avisoDeSalidaSinComprobante, AVISO_AL_CERRAR_PESTANA } from '@/lib/studies/salir-sin-comprobante'

export function StudyReceiptModal({ enrollmentId, groupId, memberId, studyName, memberName, amount, currency = 'CRC', onDone, onCancelada }: {
  enrollmentId: string
  /** Para poder CANCELAR la matrícula desde acá (retiro). Sin esto la única
   *  salida del modal era subir el comprobante. */
  groupId?: string
  /** A quién se retira. Sin él, el endpoint retira a la sesión — correcto en
   *  autoservicio, insuficiente cuando el staff matricula a un tercero. */
  memberId?: string | null
  studyName: string
  /** Persona INSCRITA, para armarle el detalle de la transferencia. Opcional:
   *  sin ella las instrucciones salen igual, solo que genéricas. */
  memberName?: string | null
  /** Monto FINAL a pagar (ya con la beca aplicada, si había). */
  amount: number
  /** Moneda del cobro (INT-3). Sin esto el monto se mostraba siempre en colones. */
  currency?: string | null
  onDone: () => void
  /** Se llama tras cancelar, para que la pantalla se refresque. */
  onCancelada?: () => void
}) {
  // Cancelar la matrícula sin comprobante. Existe porque no había salida: la
  // persona que se arrepentía en esta pantalla quedaba matriculada y con un
  // cobro abierto, y alguien del staff tenía que retirarla a mano. Pasó con
  // Alexandra Forero.
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)

  // MAT-3 · Cerrar la pestaña era el ÚNICO camino que no avisaba nada, y es
  // justo por donde se pierde la gente: Mariel González cerró dos veces y las
  // dos perdió el cupo. El navegador muestra su propio texto, pero el diálogo
  // solo sale si se le devuelve una cadena no vacía.
  useEffect(() => {
    if (done) return
    const alSalir = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = AVISO_AL_CERRAR_PESTANA
      return AVISO_AL_CERRAR_PESTANA
    }
    window.addEventListener('beforeunload', alSalir)
    return () => window.removeEventListener('beforeunload', alSalir)
  })
  const [cancelando, setCancelando] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [reference, setReference] = useState('')
  // FIN-3: el monto declarado es solo para AVISAR si no coincide con el
  // calculado — nunca bloquea; finanzas decide al revisar el comprobante.
  const [declared, setDeclared] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mismatch = declaredAmountMismatch(declared, amount, currency)

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
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally { setBusy(false) }
  }

  async function cancelarMatricula() {
    if (!groupId || cancelando) return
    setCancelando(true); setError(null)
    try {
      const res = await fetch(`/api/studies/groups/${groupId}/enrollments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(memberId ? { member_id: memberId } : {}),
          // El motivo es obligatorio (EST-14) y este es el real: sirve después
          // para saber por qué el cupo se liberó.
          reason: 'La persona canceló la matrícula sin enviar el comprobante',
        }),
      })
      if (!res.ok) throw new Error('No se pudo cancelar la matrícula.')
      // withdrawMember cancela también el pago pendiente sin comprobante, así
      // que no queda un cobro huérfano.
      onCancelada?.()
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cancelar la matrícula.')
      setConfirmarCancelar(false)
    } finally {
      setCancelando(false)
    }
  }

  return (
    <Modal
      // La X y el Esc: ya enviado, cierran. Sin enviar, ABREN la confirmación
      // de cancelar en vez de no hacer nada.
      //
      // Antes la X estaba ahí y era INERTE — parecía que se podía cerrar y no
      // se cerraba, que es peor que no tenerla. Es lo que se reportó: "quería
      // cerrar la pantalla y el sistema no tiene esa opción".
      onClose={() => { if (done) onDone(); else if (groupId) setConfirmarCancelar(true) }}
      titleId="comprobante-matricula-title" width={420}
    >
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
              Ya quedaste matriculado en {studyName}. Finanzas revisa el comprobante
              aparte; te avisamos si hay algún problema con el pago.
            </p>
            <button onClick={onDone} className="rounded-full bg-coral shadow-[var(--shadow-pulse-sm)] px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body">Listo</button>
          </div>
        ) : (
          <>
            <h3 id="comprobante-matricula-title" className="text-base font-bold text-navy font-display">Pagar matrícula</h3>
            <p className="text-[13px] text-navy-light/80 font-body">
              <strong className="text-navy">La matrícula de {studyName} ya quedó hecha.</strong>{' '}
              Falta el pago de <strong className="text-navy">{formatMoney(amount, currency)}</strong>:
              subí acá el comprobante (screenshot del SINPE o transferencia) y el número de
              referencia. Hacelo ahora, con el pago recién hecho — es el momento en que tenés
              la captura a mano.
            </p>
            <PaymentInstructions concepto={studyName} nombre={memberName} />
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
              <label htmlFor="mat-pay-ref" className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">Número de referencia</label>
              <input
                id="mat-pay-ref"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="Ej. 2026070212345"
                className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="mat-pay-amount" className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
                Monto que transferiste
              </label>
              <input
                id="mat-pay-amount"
                type="number"
                min={0}
                step={amountStep(currency)}
                value={declared}
                onChange={e => setDeclared(e.target.value)}
                placeholder={String(amount)}
                aria-describedby={mismatch ? 'mat-pay-amount-aviso' : undefined}
                className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
              />
              {mismatch && (
                <p
                  id="mat-pay-amount-aviso"
                  className="flex items-start gap-1.5 text-[13px] text-coral-deep font-body"
                  role="alert"
                >
                  <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden />
                  <span>
                    Nos da <strong>{formatMoney(amount, currency)}</strong> a pagar. Podés enviarlo
                    igual: finanzas lo revisa con el comprobante.
                  </span>
                </p>
              )}
            </div>
            {error && <p className="text-[13px] text-coral-deep font-body">{error}</p>}
            <div className="pt-1">
              <button
                onClick={submit}
                disabled={busy || !file}
                className={cn('w-full rounded-full px-4 py-2.5 text-sm text-white transition-colors font-body inline-flex items-center justify-center gap-2 bg-coral shadow-[var(--shadow-pulse)] hover:bg-coral-deep', (busy || !file) && 'opacity-50 cursor-not-allowed')}
              >
                {busy ? <><Loader2 size={15} className="animate-spin" /> Enviando…</> : 'Enviar comprobante'}
              </button>
            </div>

            {/* La salida. Va abajo y en tono discreto: el camino que queremos
                es enviar el comprobante, pero tiene que EXISTIR una salida —
                antes la única forma de arrepentirse era cerrar el navegador y
                quedaba la matrícula viva con su cobro abierto. */}
            {groupId && (
              confirmarCancelar ? (
                <div className="rounded-xl bg-[rgba(214,62,61,0.08)] border-2 border-[rgba(214,62,61,0.35)] px-3.5 py-3.5 space-y-3">
                  {/* MAT-3 · Antes esto solo ofrecía cancelar, sin decir qué
                      pasaba si simplemente se iba. El estado real —matrícula
                      viva, pendiente, con fecha de vencimiento— es el dato que
                      le faltaba a la gente que perdía el cupo sin enterarse. */}
                  <div className="flex items-start gap-2">
                    <TriangleAlert size={18} className="shrink-0 mt-0.5 text-coral-deep" aria-hidden="true" />
                    <div className="space-y-1.5">
                      <p className="text-sm font-bold text-coral-deep font-display">
                        {avisoDeSalidaSinComprobante(studyName).titulo}
                      </p>
                      <p className="text-[13px] text-navy font-body">
                        {avisoDeSalidaSinComprobante(studyName).cuerpo}
                      </p>
                      <p className="text-[13px] font-bold text-coral-deep font-body">
                        {avisoDeSalidaSinComprobante(studyName).plazo}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setConfirmarCancelar(false)}
                    disabled={cancelando}
                    className="w-full rounded-full bg-coral shadow-[var(--shadow-pulse-sm)] px-3.5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-50 font-body"
                  >
                    Subir el comprobante ahora
                  </button>
                  <div className="pt-0.5 border-t border-[rgba(214,62,61,0.2)]">
                    <p className="text-[13px] text-navy-light/80 font-body pt-2.5">
                      ¿Ya no querés el campo? Se cancela la matrícula y se anula el cobro;
                      podés volver a matricularte después si hay campo.
                    </p>
                    <button
                      onClick={cancelarMatricula}
                      disabled={cancelando}
                      className="mt-1.5 inline-flex items-center gap-1.5 text-[13px] text-navy-light/80 hover:text-coral-deep underline transition-colors disabled:opacity-50 font-body"
                    >
                      {cancelando ? <><Loader2 size={14} className="animate-spin" /> Cancelando…</> : 'Cancelar la matrícula'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmarCancelar(true)}
                  className="w-full text-center text-[13px] text-navy-light/80 hover:text-coral-deep transition-colors font-body"
                >
                  Cancelar la matrícula
                </button>
              )
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
