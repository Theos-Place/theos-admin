'use client'

import { useState } from 'react'
import { Loader2, GraduationCap } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/shared/Button'
import { useToast } from '@/components/shared/Toast'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/format'
import { avisoDeBecaQueNoCalza, type BecaAjena } from '@/lib/finance/beca-que-no-calza'

/**
 * BEC-1 · Aplicarle una beca o un cupón a UN cobro, desde el perfil de la
 * persona (pedido de Floriana, 2026-10-09: «en el modal de los pagos de
 * estudios, aún no me da la opción de aplicar beca»).
 *
 * LA ACCIÓN YA EXISTÍA, solo que únicamente en la cola de finanzas. Quien
 * atiende a alguien en su perfil tenía que irse a buscar el mismo cobro a
 * otra pantalla. Acá se usan EL MISMO endpoint y EL MISMO permiso
 * (`puedeAplicarBeca`), no una copia: si mañana se aprieta uno, se aprieta
 * el otro.
 *
 * LO QUE NO SE COMPARTE es el dibujo. La cola lo resuelve con un panel
 * dentro del detalle del tiquete; acá es un modal sobre la fila. Unificar el
 * render obligaría a partir un componente de mil líneas en medio de una
 * jornada de arreglos, y lo que importa —a quién se deja, contra qué
 * endpoint, qué pasa después— ya es uno solo.
 */
type BecaAsignada = { id: string; amount: number; currency?: string | null; reason?: string | null }

export function AplicarBecaEnCobro({ pagoId, monto, currency, onAplicada }: {
  pagoId: string
  monto: number
  currency: string
  onAplicada: () => void
}) {
  const toast = useToast()
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [asignada, setAsignada] = useState<BecaAsignada | null>(null)
  /** Becas activas que la persona SÍ tiene pero que no sirven para este cobro. */
  const [otras, setOtras] = useState<BecaAjena[]>([])
  const [codigo, setCodigo] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function abrir() {
    setAbierto(true)
    setCargando(true)
    setAsignada(null)
    setOtras([])
    setCodigo('')
    try {
      // El MISMO endpoint que usa la cola de finanzas para buscar qué becas
      // tiene la persona.
      const res = await fetch(`/api/payments/${pagoId}/scholarship-options`)
      const d = await res.json().catch(() => null)
      setAsignada(res.ok ? d?.scholarship ?? null : null)
      setOtras(res.ok && Array.isArray(d?.otras) ? d.otras : [])
    } catch {
      setAsignada(null)
      setOtras([])
    } finally {
      setCargando(false)
    }
  }

  async function aplicar(body: { scholarship_id?: string; coupon_code?: string }) {
    if (enviando) return
    setEnviando(true)
    try {
      const res = await fetch(`/api/payments/${pagoId}/apply-scholarship`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.error || 'No se pudo aplicar la beca.')
      // El mensaje distingue los dos resultados, que para la persona son muy
      // distintos: con la beca completa ya no tiene que pagar nada.
      toast(
        d.covered
          ? 'Cubierto por beca: el cobro quedó aprobado y no hace falta comprobante.'
          : `Beca aplicada. Queda pendiente ${formatMoney(d.amount, currency)}.`,
        'success',
      )
      setAbierto(false)
      onAplicada()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo aplicar la beca.', 'error')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="inline-flex items-center gap-1.5 rounded-full border border-navy/20 px-3 py-1.5 text-[13px] text-navy hover:bg-navy/5 transition-colors font-body"
      >
        <GraduationCap size={13} aria-hidden="true" />
        Aplicar beca
      </button>

      {abierto && (
        <Modal onClose={() => !enviando && setAbierto(false)} titleId="beca-cobro" width={440}>
          <div className="p-6 space-y-4">
            <h2 id="beca-cobro" className="pr-6 text-lg font-display font-extrabold text-navy">
              Aplicar beca o cupón
            </h2>
            <p className="text-[13px] text-navy-light/80 font-body">
              Cobro pendiente de {formatMoney(monto, currency)}.
            </p>

            {cargando ? (
              <p className="text-sm text-navy-light/80 font-body inline-flex items-center gap-2 py-4">
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                Buscando becas de la persona…
              </p>
            ) : (
              <>
                {asignada ? (
                  <div className="rounded-xl bg-surface-low p-3 space-y-2">
                    <p className="text-[13px] text-navy font-body">
                      Tiene una beca asignada de{' '}
                      <strong>{formatMoney(asignada.amount, asignada.currency ?? currency)}</strong>
                      {asignada.reason ? ` · ${asignada.reason}` : ''}
                    </p>
                    <Button
                      tamano="sm"
                      disabled={enviando}
                      onClick={() => aplicar({ scholarship_id: asignada.id })}
                    >
                      {enviando ? 'Aplicando…' : 'Usar esta beca'}
                    </Button>
                  </div>
                ) : (
                  /**
                   * Se DICE qué pasa, en vez de mostrar solo el campo del
                   * cupón. Y cuando tiene becas que no calzan se nombra PARA
                   * QUÉ son: a William Castro le habían aprobado una de
                   * Nivel 3 sobre un cobro de Nivel 2, y «no tiene una beca
                   * asignada para este cobro» se leyó como un bug del
                   * sistema (Floriana, 2026-10-09).
                   */
                  <p className={cn(
                    'text-[13px] font-body',
                    otras.length ? 'rounded-xl bg-amber-50 px-3 py-2 text-amber-800' : 'text-navy-light/80',
                  )}>
                    {avisoDeBecaQueNoCalza(otras)
                      ?? 'Esta persona no tiene una beca asignada para este cobro.'}
                  </p>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="cupon-beca" className="block text-[13px] font-medium text-navy-light/80 font-body">
                    …o un código de cupón
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="cupon-beca"
                      value={codigo}
                      onChange={e => setCodigo(e.target.value)}
                      disabled={enviando}
                      maxLength={60}
                      className="flex-1 rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
                    />
                    <Button
                      tamano="sm"
                      variante="secundario"
                      disabled={enviando || !codigo.trim()}
                      onClick={() => aplicar({ coupon_code: codigo.trim() })}
                    >
                      Aplicar
                    </Button>
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end pt-1">
              <Button variante="fantasma" onClick={() => setAbierto(false)} disabled={enviando}>
                Cancelar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
