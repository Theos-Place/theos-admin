'use client'

/**
 * BEC-5 punto 6 · «Ofrecer arreglo de pago en su lugar», en el tiquete de beca.
 *
 * NO ES UN RECHAZO, y por eso vive al lado de Resolver y Rechazar en vez de
 * dentro del rechazo: «no te damos la beca» y «no hay beca pero podés pagarlo
 * en partes» son dos mensajes distintos, y el segundo deja a la persona
 * adentro. El endpoint resuelve la solicitud con la nota de la conversión.
 *
 * El arreglo lo arma el servidor con createPaymentPlan, el mismo camino de
 * FIN-8/FIN-13: acá solo se eligen tractos, frecuencia y primer vencimiento.
 */

import { useState } from 'react'
import { HandCoins, Loader2 } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/shared/Button'
import { useToast } from '@/components/shared/Toast'
import {
  MIN_INSTALLMENTS, MAX_INSTALLMENTS, FREQUENCY_LABEL, type PlanFrequency,
} from '@/lib/finance/installments'
import { NOTA_DE_CONVERSION, sigueAbierta } from '@/lib/finance/solicitud-de-beca'
import type { FinanceRequest } from '@/types/finance'

export function OfrecerArregloButton({ req, onDone }: {
  req: FinanceRequest
  onDone: (actualizada: FinanceRequest) => void
}) {
  const toast = useToast()
  const [abierto, setAbierto] = useState(false)
  const [tractos, setTractos] = useState(2)
  const [frecuencia, setFrecuencia] = useState<PlanFrequency>('mensual')
  const [primerVencimiento, setPrimerVencimiento] = useState('')
  const [notas, setNotas] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Solo sobre becas vivas. En una devolución no tiene sentido, y sobre una
  // cerrada sería reabrir algo ya decidido.
  if (req.request_type !== 'scholarship' || !sigueAbierta(req.status)) return null

  async function enviar() {
    if (enviando || !primerVencimiento) return
    setEnviando(true)
    try {
      const res = await fetch(`/api/finance/requests/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'offer_plan',
          installments: tractos,
          frequency: frecuencia,
          first_due: primerVencimiento,
          ...(notas.trim() ? { review_notes: notas.trim() } : {}),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudo crear el arreglo.')
      toast(`Arreglo de ${tractos} tractos creado. Se le avisó a la persona.`, 'success')
      setAbierto(false)
      if (data?.solicitud) onDone(data.solicitud as FinanceRequest)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo crear el arreglo.', 'error')
    } finally {
      setEnviando(false)
    }
  }

  const opciones = Array.from(
    { length: MAX_INSTALLMENTS - MIN_INSTALLMENTS + 1 },
    (_, i) => MIN_INSTALLMENTS + i,
  )

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        disabled={enviando}
        className="inline-flex items-center gap-1.5 rounded-full border border-navy/20 px-4 py-1.5 text-[13px] text-navy font-body hover:bg-navy/5 transition-colors disabled:opacity-60"
      >
        <HandCoins size={13} aria-hidden="true" />
        Ofrecer arreglo de pago
      </button>

      {abierto && (
        <Modal onClose={() => !enviando && setAbierto(false)} titleId="ofrecer-arreglo-title" width={460}>
          <div className="p-6 space-y-4">
            <h3 id="ofrecer-arreglo-title" className="text-base font-bold text-navy font-display">
              Ofrecer arreglo de pago
            </h3>
            <p className="text-[13px] text-navy-light/80 font-body">
              En vez de la beca, el cobro pendiente de {req.member_name} se parte en tractos.
              La solicitud queda resuelta —no rechazada— y se le avisa.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="arreglo-tractos" className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
                  Tractos
                </label>
                <select
                  id="arreglo-tractos"
                  value={tractos}
                  onChange={e => setTractos(Number(e.target.value))}
                  className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
                >
                  {opciones.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="arreglo-frecuencia" className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
                  Frecuencia
                </label>
                <select
                  id="arreglo-frecuencia"
                  value={frecuencia}
                  onChange={e => setFrecuencia(e.target.value as PlanFrequency)}
                  className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
                >
                  {(Object.keys(FREQUENCY_LABEL) as PlanFrequency[]).map(f => (
                    <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="arreglo-primer-vencimiento" className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
                Vence el primer tracto
              </label>
              <input
                id="arreglo-primer-vencimiento"
                type="date"
                value={primerVencimiento}
                onChange={e => setPrimerVencimiento(e.target.value)}
                className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="arreglo-notas" className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
                Notas (opcional)
              </label>
              <textarea
                id="arreglo-notas"
                value={notas}
                onChange={e => setNotas(e.target.value)}
                rows={2}
                placeholder={NOTA_DE_CONVERSION}
                className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body resize-none"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variante="navy"
                ancho="flex"
                onClick={enviar}
                disabled={enviando || !primerVencimiento}
              >
                {enviando ? <><Loader2 size={15} className="animate-spin" /> Creando…</> : 'Crear el arreglo'}
              </Button>
              <button
                onClick={() => setAbierto(false)}
                disabled={enviando}
                className="rounded-full border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
              >
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
