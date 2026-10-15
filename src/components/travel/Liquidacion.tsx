'use client'

/**
 * FIN-11 fase B · La liquidación (ANX-03).
 *
 * Quien viajó carga los gastos con su comprobante y firma la declaración
 * jurada; finanzas la mira y la cierra. La cuenta de quién le debe a quién
 * sale de `lib/travel/liquidacion`, el mismo módulo que usa el servidor.
 *
 * LA TABLA ES DE SOLO LECTURA SALVO MIENTRAS SE LIQUIDA. No es un detalle de
 * UI: una vez enviada, la liquidación es lo que finanzas revisó, y dejarla
 * editable sería aprobar una cosa y guardar otra.
 */
import { useState } from 'react'
import { Loader2, Paperclip, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/shared/Button'
import { useToast } from '@/components/shared/Toast'
import { formatDate, formatMoney } from '@/lib/format'
import { RUBROS, NOMBRE_DEL_RUBRO, MONEDAS, type Moneda, type Rubro } from '@/lib/travel/presupuesto'
import {
  saldos, revisarGastos, aReintegrar, aReembolsar,
  TEXTO_DECLARACION_JURADA, type GastoEjecutado,
} from '@/lib/travel/liquidacion'

type GastoEnPantalla = GastoEjecutado & { sin_comprobante_motivo?: string | null }

const etiqueta = 'text-[11px] tracking-widest uppercase text-navy-light/80 font-display'
const campo = 'w-full rounded-xl border border-navy/15 px-3 py-2 text-[13px] text-navy font-body focus:border-coral focus:outline-none focus:ring-1 focus:ring-coral'

export function Liquidacion({ viajeId, editable, gastosIniciales, anticipo, fechasRaras, onCambio }: {
  viajeId: string
  /** Solo quien viajó y solo en `liquidacion_pendiente`. */
  editable: boolean
  gastosIniciales: Array<GastoEnPantalla & { id?: string }>
  anticipo: { monto: number; moneda: Moneda } | null
  /** Índices con fecha lejana al viaje: aviso, no bloqueo. */
  fechasRaras: number[]
  onCambio: () => void
}) {
  const [gastos, setGastos] = useState<GastoEnPantalla[]>(gastosIniciales)
  const [declaro, setDeclaro] = useState(false)
  const [notas, setNotas] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const cuenta = saldos(gastos, anticipo)
  const problemas = revisarGastos(gastos, {
    sinComprobante: Object.fromEntries(gastos.map((g, i) => [i, g.sin_comprobante_motivo])),
  })
  const devuelve = aReintegrar(cuenta)
  const lePagan = aReembolsar(cuenta)

  const set = (i: number, patch: Partial<GastoEnPantalla>) =>
    setGastos(p => p.map((g, j) => j === i ? { ...g, ...patch } : g))

  async function subir(i: number, file: File) {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/travel-requests/${viajeId}/receipts`, { method: 'POST', body: fd })
    const d = await res.json().catch(() => null)
    if (!res.ok) { toast(d?.error || 'No se pudo subir el archivo.', 'error'); return }
    set(i, { receipt_path: d.receipt_path })
    toast('Comprobante adjunto.', 'success')
  }

  async function guardar() {
    setBusy(true)
    try {
      const res = await fetch(`/api/travel-requests/${viajeId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'gastos', gastos }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'No se pudo guardar.')
      toast('Gastos guardados.', 'success')
      onCambio()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar.', 'error')
    } finally { setBusy(false) }
  }

  async function enviar() {
    setBusy(true)
    try {
      // Se guardan los gastos ANTES de firmar: firmar una tabla que todavía
      // está en la pantalla y no en la base es firmar otra cosa.
      const g = await fetch(`/api/travel-requests/${viajeId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'gastos', gastos }),
      })
      if (!g.ok) throw new Error((await g.json().catch(() => null))?.error || 'No se pudo guardar.')
      const res = await fetch(`/api/travel-requests/${viajeId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enviar_liquidacion', declaro: true, notas: notas.trim() || null }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'No se pudo enviar.')
      toast('Liquidación enviada.', 'success')
      onCambio()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo enviar.', 'error')
    } finally { setBusy(false) }
  }

  return (
    <section className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-bold text-navy font-display">Liquidación</h2>
          <p className="text-[13px] text-navy-light/80 font-body">
            {anticipo
              ? <>Anticipo recibido: <strong className="text-navy">{formatMoney(anticipo.monto, anticipo.moneda)}</strong></>
              : 'Sin anticipo.'}
          </p>
        </div>
        {editable && (
          <Button type="button" variante="secundario" tamano="sm"
            onClick={() => setGastos(p => [...p, {
              fecha: '', rubro: 'alimentacion' as Rubro, monto: 0, moneda: 'CRC' as Moneda,
              proveedor: '', numero_comprobante: '', receipt_path: null, sin_comprobante_motivo: '',
            }])}>
            <Plus size={14} aria-hidden="true" /> Agregar gasto
          </Button>
        )}
      </div>

      {gastos.length === 0 ? (
        <p className="text-[13px] text-navy-light/80 font-body">Todavía no hay gastos cargados.</p>
      ) : editable ? (
        <div className="space-y-2">
          {gastos.map((g, i) => (
            <div key={i} className="space-y-2 rounded-xl bg-surface-low p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                <div className="space-y-1 sm:col-span-2">
                  <label htmlFor={`g-fecha-${i}`} className={etiqueta}>Fecha</label>
                  <input id={`g-fecha-${i}`} type="date" className={campo} value={g.fecha}
                    onChange={e => set(i, { fecha: e.target.value })} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label htmlFor={`g-rubro-${i}`} className={etiqueta}>Rubro</label>
                  <select id={`g-rubro-${i}`} className={campo} value={g.rubro}
                    onChange={e => set(i, { rubro: e.target.value as Rubro })}>
                    {RUBROS.map(r => <option key={r} value={r}>{NOMBRE_DEL_RUBRO[r]}</option>)}
                  </select>
                </div>
                <div className="space-y-1 sm:col-span-3">
                  <label htmlFor={`g-prov-${i}`} className={etiqueta}>Proveedor</label>
                  <input id={`g-prov-${i}`} className={campo} value={g.proveedor ?? ''}
                    onChange={e => set(i, { proveedor: e.target.value })} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label htmlFor={`g-num-${i}`} className={etiqueta}>N° comprobante</label>
                  <input id={`g-num-${i}`} className={campo} value={g.numero_comprobante ?? ''}
                    onChange={e => set(i, { numero_comprobante: e.target.value })} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label htmlFor={`g-monto-${i}`} className={etiqueta}>Monto</label>
                  <input id={`g-monto-${i}`} type="number" min={0} step="any" className={campo}
                    value={g.monto} onChange={e => set(i, { monto: Number(e.target.value) })} />
                </div>
                <div className="space-y-1 sm:col-span-1">
                  <label htmlFor={`g-mon-${i}`} className={etiqueta}>Moneda</label>
                  <select id={`g-mon-${i}`} className={campo} value={g.moneda}
                    onChange={e => set(i, { moneda: e.target.value as Moneda })}>
                    {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] text-navy-light hover:text-coral-deep transition-colors font-body">
                  <Paperclip size={14} aria-hidden="true" />
                  {g.receipt_path ? 'Cambiar comprobante' : 'Adjuntar comprobante'}
                  <input type="file" accept="image/*,application/pdf" className="sr-only"
                    aria-label={`Comprobante del gasto ${i + 1}`}
                    onChange={e => { const f = e.target.files?.[0]; if (f) subir(i, f) }} />
                </label>
                {g.receipt_path && <span className="text-[13px] text-success-deep font-body">Adjunto ✓</span>}
                {!g.receipt_path && (
                  <input className={`${campo} max-w-xs`} value={g.sin_comprobante_motivo ?? ''}
                    aria-label={`Por qué el gasto ${i + 1} no tiene comprobante`}
                    placeholder="Si no hay factura, ¿por qué?"
                    onChange={e => set(i, { sin_comprobante_motivo: e.target.value })} />
                )}
                <button type="button" aria-label={`Quitar el gasto ${i + 1}`}
                  onClick={() => setGastos(p => p.filter((_, j) => j !== i))}
                  className="ml-auto rounded-full p-1.5 text-navy-light/80 hover:text-coral-deep transition-colors">
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-[var(--outline-variant)]">
          {gastos.map((g, i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-[13px] text-navy font-body">
                  {NOMBRE_DEL_RUBRO[g.rubro]}{g.proveedor ? ` · ${g.proveedor}` : ''}
                </p>
                <p className="text-[13px] text-navy-light/80 font-body truncate">
                  {g.fecha ? formatDate(g.fecha) : 'sin fecha'}
                  {g.numero_comprobante ? ` · N° ${g.numero_comprobante}` : ''}
                  {g.receipt_path ? ' · con comprobante' : ` · SIN comprobante: ${g.sin_comprobante_motivo ?? '—'}`}
                  {fechasRaras.includes(i) ? ' · ⚠ fecha lejana al viaje' : ''}
                </p>
              </div>
              <span className="shrink-0 text-[13px] font-semibold text-navy font-display">
                {formatMoney(g.monto, g.moneda)}
              </span>
            </div>
          ))}
        </div>
      )}

      {editable && problemas.length > 0 && (
        <ul className="space-y-0.5 text-[13px] text-coral-deep font-body">
          {problemas.map((p, i) => (
            <li key={i}>{p.indice >= 0 ? `Gasto ${p.indice + 1}: ` : ''}{p.mensaje}</li>
          ))}
        </ul>
      )}

      {cuenta.length > 0 && (
        <div className="space-y-2 border-t border-[var(--outline-variant)] pt-3">
          {cuenta.map(s => (
            <div key={s.moneda} className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className={etiqueta}>{s.moneda}</span>
              <span className="text-[13px] text-navy-light/80 font-body">
                Gastado {formatMoney(s.gastado, s.moneda)} · Anticipo {formatMoney(s.anticipo, s.moneda)}
              </span>
              <span className="text-[13px] font-semibold text-navy font-display">
                {s.resultado === 'reintegrar' ? `Devuelve ${formatMoney(s.diferencia, s.moneda)}`
                  : s.resultado === 'reembolsar' ? `Se le reembolsan ${formatMoney(-s.diferencia, s.moneda)}`
                    : 'Cuadra'}
              </span>
            </div>
          ))}
          {/* Cada moneda por su lado, también acá: un anticipo en dólares y
              gastos en colones NO se compensan entre sí. */}
          {(devuelve.length > 0 || lePagan.length > 0) && (
            <p className="text-[13px] text-navy-light/80 font-body">
              {devuelve.length > 0 && <>A reintegrar a la Asociación: {devuelve.map(d => formatMoney(d.monto, d.moneda)).join(' y ')}. </>}
              {lePagan.length > 0 && <>A reembolsar a la persona: {lePagan.map(d => formatMoney(d.monto, d.moneda)).join(' y ')}.</>}
            </p>
          )}
        </div>
      )}

      {editable && (
        <div className="space-y-3 border-t border-[var(--outline-variant)] pt-3">
          <div className="space-y-1.5">
            <label htmlFor="liq-notas" className={etiqueta}>Observaciones (opcional)</label>
            <textarea id="liq-notas" rows={2} className={campo} value={notas} onChange={e => setNotas(e.target.value)} />
          </div>
          <label className="flex items-start gap-2 text-[13px] text-navy font-body">
            <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-coral"
              checked={declaro} onChange={e => setDeclaro(e.target.checked)} />
            <span>{TEXTO_DECLARACION_JURADA}</span>
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variante="secundario" tamano="sm" onClick={guardar} disabled={busy}>
              {busy ? <><Loader2 size={15} className="animate-spin" aria-hidden="true" /> …</> : 'Guardar sin enviar'}
            </Button>
            <Button type="button" variante="primario" tamano="sm" onClick={enviar}
              disabled={busy || !declaro || problemas.length > 0}>
              Firmar y enviar liquidación
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
