'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * El formulario de «subí el comprobante y la referencia», UNA sola vez
 * (2026-10-15). Lo usaban, copiado, el modal de pagos de la ficha
 * (`PagarConComprobante`, matrícula e inscripción) y el de la inscripción a
 * eventos (`ReceiptModal`). Cada uno conserva lo suyo alrededor —las
 * instrucciones de pago, el detalle del cobro, la beca, la pantalla de
 * «enviado»—; esto es solo el archivo, la referencia, el envío y los botones.
 */
export function FormularioDeComprobante({ id, enviar, onEnviado, onCancelar, textoCancelar = 'Cancelar', antesDelEnvio, onOcupado }: {
  /** Prefijo de los ids de los campos: dos formularios en la misma página no chocan. */
  id: string
  /** A qué URL va el POST y qué campos lleva además del archivo y la referencia. */
  enviar: { url: string; campos?: Record<string, string> }
  onEnviado: () => void
  onCancelar: () => void
  textoCancelar?: string
  /** Lo que va entre la referencia y el botón de enviar (la beca, en matrícula). */
  antesDelEnvio?: React.ReactNode
  /** Avisa mientras envía, para que el modal no se cierre a mitad. */
  onOcupado?: (ocupado: boolean) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [reference, setReference] = useState('')
  const [busy, setBusyState] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setBusy = (b: boolean) => { setBusyState(b); onOcupado?.(b) }

  async function submit() {
    if (busy || !file) return
    setBusy(true); setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      for (const [k, v] of Object.entries(enviar.campos ?? {})) fd.append(k, v)
      fd.append('reference', reference.trim())
      const res = await fetch(enviar.url, { method: 'POST', body: fd })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudo enviar el comprobante.')
      onEnviado()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally { setBusy(false) }
  }

  return (
    <>
      <div className="space-y-1">
        <label htmlFor={`${id}-imagen`} className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">Comprobante (imagen)</label>
        <input id={`${id}-imagen`}
          type="file"
          accept="image/*"
          aria-label="Comprobante de pago"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-[13px] text-navy-light/80 font-body file:mr-3 file:rounded-full file:border-0 file:bg-surface-low file:px-3 file:py-1.5 file:text-[13px] file:text-navy"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor={`${id}-ref`} className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">Número de referencia</label>
        <input
          id={`${id}-ref`}
          value={reference}
          onChange={e => setReference(e.target.value)}
          placeholder="Ej. 2026070212345"
          className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
        />
      </div>
      {antesDelEnvio}
      {error && <p className="text-[13px] text-coral-deep font-body">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button
          onClick={submit}
          disabled={busy || !file}
          className={cn('flex-1 rounded-full px-4 py-2.5 text-sm text-white transition-colors font-body inline-flex items-center justify-center gap-2 bg-coral shadow-[var(--shadow-pulse-sm)] hover:bg-coral-deep', (busy || !file) && 'opacity-50 cursor-not-allowed')}
        >
          {busy ? <><Loader2 size={15} className="animate-spin" /> Enviando…</> : 'Enviar comprobante'}
        </button>
        <button onClick={onCancelar} disabled={busy} className="rounded-full border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body">
          {textoCancelar}
        </button>
      </div>
    </>
  )
}
