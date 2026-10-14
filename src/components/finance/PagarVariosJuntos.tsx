'use client'

/**
 * PAG-5 · «Tengo tres cobros y una sola transferencia».
 *
 * La barra que aparece cuando hay más de un cobro pendiente y la ventana que
 * sube UN comprobante para todos los seleccionados.
 *
 * Esta pantalla NO decide nada: qué se puede seleccionar, cuánto suma y por
 * qué una selección no sirve sale de `lib/finance/comprobante-multiple`, que
 * es el mismo módulo que usa el servidor. Si la pantalla se escribiera sus
 * propias reglas, en un mes diría que se puede algo que el servidor rechaza
 * —que es exactamente el error que se repitió con los permisos de eventos.
 */
import { useState } from 'react'
import { Loader2, Receipt, X } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/shared/Button'
import { formatMoney } from '@/lib/format'
import { evaluarSeleccion, type CobroSeleccionable } from '@/lib/finance/comprobante-multiple'

export function BarraDePagoJunto({ memberId, seleccionados, onCancelar, onListo }: {
  memberId: string
  seleccionados: CobroSeleccionable[]
  onCancelar: () => void
  onListo: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const veredicto = evaluarSeleccion(seleccionados, memberId)

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--outline-variant)] bg-teal-soft/15 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-navy font-display">
            {seleccionados.length === 0
              ? 'Elegí los cobros que cubre tu transferencia'
              : `${seleccionados.length} ${seleccionados.length === 1 ? 'cobro elegido' : 'cobros elegidos'}`}
          </p>
          <p className="text-[13px] text-navy-light/80 font-body">
            {veredicto.ok
              ? <>Total a transferir: <strong className="text-navy">{formatMoney(veredicto.total, veredicto.currency)}</strong></>
              : veredicto.error.mensaje}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-full border border-navy/15 px-3.5 py-1.5 text-[13px] text-navy-light hover:text-navy hover:border-navy/30 transition-colors font-body"
          >
            Cancelar
          </button>
          <Button
            type="button" variante="primario" tamano="sm"
            disabled={!veredicto.ok}
            onClick={() => setAbierto(true)}
          >
            <Receipt size={14} aria-hidden="true" /> Subir un comprobante
          </Button>
        </div>
      </div>
      {abierto && veredicto.ok && (
        <ModalDeComprobanteJunto
          memberId={memberId}
          ids={veredicto.ids}
          total={veredicto.total}
          currency={veredicto.currency}
          cuantos={seleccionados.length}
          onCerrar={() => setAbierto(false)}
          onListo={() => { setAbierto(false); onListo() }}
        />
      )}
    </>
  )
}

function ModalDeComprobanteJunto({ memberId, ids, total, currency, cuantos, onCerrar, onListo }: {
  memberId: string
  ids: string[]
  total: number
  currency: string
  cuantos: number
  onCerrar: () => void
  onListo: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function enviar() {
    if (!file) { setError('Falta el comprobante.'); return }
    setBusy(true); setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('reference', reference)
      fd.append('member_id', memberId)
      fd.append('payment_ids', JSON.stringify(ids))
      const res = await fetch('/api/payments/receipts', { method: 'POST', body: fd })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudo enviar el comprobante.')
      onListo()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar el comprobante.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal onClose={() => !busy && onCerrar()} titleId="pago-junto-title" width={440}>
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="pago-junto-title" className="text-base font-bold text-navy font-display">
              Un comprobante para {cuantos} cobros
            </h2>
            <p className="text-[13px] text-navy-light/80 font-body">
              Subí el comprobante de la transferencia por{' '}
              <strong className="text-navy">{formatMoney(total, currency)}</strong>. Se aplica a los
              {' '}{cuantos} cobros que elegiste.
            </p>
          </div>
          <button
            type="button" onClick={() => !busy && onCerrar()} aria-label="Cerrar"
            className="rounded-full p-1 text-navy-light/80 hover:text-navy transition-colors"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="comprobante-junto" className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
            Comprobante (imagen)
          </label>
          <input
            id="comprobante-junto" type="file" accept="image/*,application/pdf"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-[13px] text-navy-light font-body file:mr-3 file:rounded-full file:border-0 file:bg-navy/5 file:px-3 file:py-1.5 file:text-[13px] file:text-navy file:font-display"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="referencia-junto" className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
            Número de referencia
          </label>
          <input
            id="referencia-junto" type="text" value={reference}
            onChange={e => setReference(e.target.value)}
            placeholder="El de la transferencia o el SINPE"
            className="w-full rounded-xl border border-navy/15 px-3 py-2 text-[13px] text-navy font-body focus:border-coral focus:outline-none focus:ring-1 focus:ring-coral"
          />
        </div>

        {error && <p className="text-[13px] text-coral-deep font-body">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button" onClick={() => !busy && onCerrar()} disabled={busy}
            className="rounded-full border border-navy/15 px-4 py-2 text-[13px] text-navy-light hover:text-navy transition-colors font-body disabled:opacity-50"
          >
            Cancelar
          </button>
          <Button type="button" variante="primario" tamano="sm" onClick={enviar} disabled={busy || !file}>
            {busy ? <><Loader2 size={15} className="animate-spin" aria-hidden="true" /> Enviando…</> : 'Enviar comprobante'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
