'use client'

/**
 * Cancelar una beca o un cupón que todavía no se usó.
 *
 * El motivo es obligatorio y se guarda con el nombre de quien cancela. No es
 * burocracia: la beca del 50% de María José Ruiz se emitió por error y hubo que
 * cerrarla por script, sin ningún lugar donde dejar la explicación. Dentro de
 * seis meses, una beca cancelada y muda no le sirve a nadie.
 *
 * Sirve para una beca o para varias a la vez (la selección múltiple de cupones):
 * el motivo es uno solo para todo el lote, que es como se cancelan de verdad
 * —"se rehizo la campaña"— y no una excusa distinta por cupón.
 */

import { useState } from 'react'
import { Modal } from '@/components/shared/Modal'
import { MOTIVO_MINIMO, motivoNormalizado } from '@/lib/finance/cancelacion-de-beca'

export function CancelarBecaModal({ titulo, detalle, cuantas = 1, onClose, onConfirmar }: {
  titulo: string
  /** Qué se está cancelando, en una línea (la persona y el descuento, o el código). */
  detalle: string
  cuantas?: number
  onClose: () => void
  /** Devuelve el mensaje de error si algo falló, o null si salió bien. */
  onConfirmar: (motivo: string) => Promise<string | null>
}) {
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const limpio = motivoNormalizado(motivo)
  const faltan = MOTIVO_MINIMO - (motivo.trim().replace(/\s+/g, ' ').length)

  async function confirmar() {
    if (!limpio || guardando) return
    setGuardando(true); setError(null)
    const err = await onConfirmar(limpio)
    if (err) { setError(err); setGuardando(false) }
  }

  return (
    <Modal onClose={onClose} titleId="cancelar-beca-title" width={520}>
      <div className="p-6 space-y-5">
        <div>
          <h2 id="cancelar-beca-title" className="text-base font-bold text-navy font-display">{titulo}</h2>
          <p className="text-[13px] text-navy-light/80 mt-1 font-body">{detalle}</p>
        </div>

        <div>
          <label htmlFor="motivo-cancelar" className="text-[11px] uppercase tracking-widest mb-2 block font-display text-navy-light/80">
            Por qué se cancela
          </label>
          <textarea
            id="motivo-cancelar"
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            rows={3}
            autoFocus
            placeholder="Se emitió por error: lo que pedía era trasladar la beca que ya tenía."
            aria-describedby="motivo-cancelar-ayuda"
            className="w-full rounded-xl border border-outline bg-surface-card px-3 py-2.5 text-sm text-navy font-body resize-none"
          />
          <p id="motivo-cancelar-ayuda" className="text-[13px] text-navy-light/80 mt-1.5 font-body">
            {limpio
              ? 'Queda guardado con tu nombre y la fecha.'
              : `Faltan ${faltan} caracteres. Queda guardado con tu nombre y la fecha.`}
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-coral-soft/20 px-3 py-2.5 text-[13px] text-coral-deep font-body">{error}</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
          >
            Mejor no
          </button>
          <button
            onClick={confirmar}
            disabled={!limpio || guardando}
            className="flex-1 rounded-full bg-coral shadow-[var(--shadow-pulse-sm)] py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body disabled:opacity-50"
          >
            {guardando ? 'Cancelando…' : cuantas > 1 ? `Cancelar ${cuantas}` : 'Cancelar la beca'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
