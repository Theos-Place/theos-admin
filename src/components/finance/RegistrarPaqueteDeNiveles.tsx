'use client'

/**
 * Registrar que la persona pagó un PAQUETE de niveles (esquema viejo), sobre
 * el cobro pendiente del nivel actual (2026-10-19). El cobro queda pagado por
 * el monto del paquete y los niveles siguientes quedan prepagados: al cerrar
 * el grupo, el sucesor no los cobra. La regla y el permiso viven en
 * `paquete-de-niveles.ts` y en el endpoint, no acá.
 */
import { useState } from 'react'
import { Loader2, Layers } from 'lucide-react'
import { Button } from '@/components/shared/Button'
import { useToast } from '@/components/shared/Toast'
import { levelLabel } from '@/lib/studies/folletos'
import { todayCR } from '@/lib/format'

const inputCls = 'w-full rounded-xl bg-surface-card px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'
const labelCls = 'text-[11px] tracking-widest uppercase text-navy-light/80 font-display'

export function RegistrarPaqueteDeNiveles({ pagoId, onRegistrado }: { pagoId: string; onRegistrado: () => void }) {
  const toast = useToast()
  const [abierto, setAbierto] = useState(false)
  const [cadena, setCadena] = useState<string[] | null>(null)
  const [hasta, setHasta] = useState(0)
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(todayCR())
  const [referencia, setReferencia] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function abrir() {
    setAbierto(true); setError(null); setCadena(null)
    const d = await fetch(`/api/payments/${pagoId}/level-package`).then(r => (r.ok ? r.json() : null)).catch(() => null)
    const niveles: string[] = d?.admite ? d.niveles : []
    setCadena(niveles)
    setHasta(Math.max(1, niveles.length - 1))
  }

  const elegidos = (cadena ?? []).slice(0, hasta + 1)
  const listo = elegidos.length >= 2 && Number(monto) > 0 && !!fecha && !!referencia.trim() && !!file

  async function registrar() {
    if (!listo || enviando) return
    setEnviando(true); setError(null)
    try {
      const fd = new FormData()
      fd.append('niveles', JSON.stringify(elegidos))
      fd.append('amount', String(Number(monto)))
      fd.append('payment_date', fecha)
      fd.append('reference_code', referencia.trim())
      fd.append('file', file!)
      const res = await fetch(`/api/payments/${pagoId}/level-package`, { method: 'POST', body: fd })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.error ?? `No se pudo registrar (${res.status}).`)
      toast(`Paquete registrado: ${elegidos.map(levelLabel).join(', ')}.`, 'success')
      onRegistrado()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar.')
      setEnviando(false)
    }
  }

  if (!abierto) {
    return (
      <button type="button" onClick={abrir}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-navy underline font-body">
        <Layers size={14} aria-hidden="true" /> Pagó un paquete de niveles
      </button>
    )
  }

  if (cadena === null) {
    return <p className="flex items-center gap-1.5 text-[13px] text-navy-light/80 font-body"><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Revisando el cobro…</p>
  }
  if (cadena.length < 2) {
    return <p className="text-[13px] text-navy-light/80 font-body">Este cobro no admite paquete: solo matrículas pendientes de grupos del esquema viejo, con un nivel siguiente.</p>
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] font-semibold text-navy font-body">Paquete de niveles</p>
      <div className="space-y-1">
        <label htmlFor={`paq-hasta-${pagoId}`} className={labelCls}>Cubre hasta</label>
        <select id={`paq-hasta-${pagoId}`} value={hasta} onChange={e => setHasta(Number(e.target.value))} className={inputCls}>
          {cadena.slice(1).map((c, i) => (
            <option key={c} value={i + 1}>{cadena.slice(0, i + 2).map(levelLabel).join(' + ')}</option>
          ))}
        </select>
        <p className="text-[13px] text-navy-light/80 font-body">Al cerrar el grupo, los niveles siguientes no se le cobran.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor={`paq-monto-${pagoId}`} className={labelCls}>Monto pagado</label>
          <input id={`paq-monto-${pagoId}`} type="number" min={1} inputMode="numeric" value={monto} onChange={e => setMonto(e.target.value)} placeholder="13000" className={inputCls} />
        </div>
        <div className="space-y-1">
          <label htmlFor={`paq-fecha-${pagoId}`} className={labelCls}>Fecha del pago</label>
          <input id={`paq-fecha-${pagoId}`} type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} />
        </div>
      </div>
      <div className="space-y-1">
        <label htmlFor={`paq-ref-${pagoId}`} className={labelCls}>Referencia</label>
        <input id={`paq-ref-${pagoId}`} value={referencia} onChange={e => setReferencia(e.target.value)} className={inputCls} />
      </div>
      <div className="space-y-1">
        <label htmlFor={`paq-file-${pagoId}`} className={labelCls}>Comprobante</label>
        <input id={`paq-file-${pagoId}`} type="file" accept="image/*,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-[13px] text-navy-light/80 font-body file:mr-3 file:rounded-full file:border-0 file:bg-surface-card file:px-3 file:py-1.5 file:text-[13px] file:text-navy" />
      </div>
      {error && <p className="text-[13px] text-coral-deep font-body" role="alert">{error}</p>}
      <div className="flex gap-2">
        <Button variante="navy" tamano="sm" onClick={registrar} disabled={!listo || enviando}>
          {enviando ? <><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Registrando…</> : 'Registrar paquete'}
        </Button>
        <Button variante="secundario" tamano="sm" onClick={() => setAbierto(false)} disabled={enviando}>Cancelar</Button>
      </div>
    </div>
  )
}
