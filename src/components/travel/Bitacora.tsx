'use client'

/**
 * FIN-11 fase C · Bitácora de kilometraje (ANX-05).
 *
 * Una fila por desplazamiento, con odómetro. Los kilómetros y el monto se
 * calculan: no hay campo donde escribirlos, porque dos lecturas son
 * verificables y un número suelto no.
 *
 * La aprobación del jefe vive acá y no en la liquidación general: es
 * requisito DEL KILOMETRAJE (minuta del 2026-09-29), y ponerla arriba haría
 * creer que se pide siempre.
 */
import { useState } from 'react'
import { Loader2, Paperclip, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/shared/Button'
import { useToast } from '@/components/shared/Toast'
import { formatDate, formatMoney } from '@/lib/format'
import {
  kmDelTramo, kmTotales, montoAReconocer, revisarBitacora, avisosDeBitacora,
  faltaAprobacionDelJefe, type Tramo,
} from '@/lib/travel/kilometraje'
import type { Moneda } from '@/lib/travel/presupuesto'

import { DatePicker } from '@/components/events/DatePicker'
const etiqueta = 'text-[11px] tracking-widest uppercase text-navy-light/80 font-display'
const campo = 'w-full rounded-xl border border-navy/15 px-3 py-2 text-[13px] text-navy font-body focus:border-coral focus:outline-none focus:ring-1 focus:ring-coral'

export function Bitacora({ viajeId, editable, tramosIniciales, tarifa, moneda, aprobacionJefe, onCambio }: {
  viajeId: string
  editable: boolean
  tramosIniciales: Tramo[]
  tarifa: number
  moneda: Moneda
  aprobacionJefe: string | null
  onCambio: () => void
}) {
  const [tramos, setTramos] = useState<Tramo[]>(tramosIniciales)
  const [jefe, setJefe] = useState<string | null>(aprobacionJefe)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const km = kmTotales(tramos)
  const monto = montoAReconocer(km, tarifa)
  const problemas = revisarBitacora(tramos)
  const avisos = avisosDeBitacora(tramos)
  const faltaJefe = tramos.length > 0 && faltaAprobacionDelJefe(jefe)

  const set = (i: number, patch: Partial<Tramo>) =>
    setTramos(p => p.map((t, j) => j === i ? { ...t, ...patch } : t))

  async function subirAprobacion(file: File) {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/travel-requests/${viajeId}/receipts`, { method: 'POST', body: fd })
    const d = await res.json().catch(() => null)
    if (!res.ok) { toast(d?.error || 'No se pudo subir el archivo.', 'error'); return }
    const guardar = await fetch(`/api/travel-requests/${viajeId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'aprobacion_jefe', receipt_path: d.receipt_path }),
    })
    if (!guardar.ok) { toast('No se pudo guardar la aprobación.', 'error'); return }
    setJefe(d.receipt_path)
    toast('Aprobación del jefe adjunta.', 'success')
    onCambio()
  }

  async function guardar() {
    setBusy(true)
    try {
      const res = await fetch(`/api/travel-requests/${viajeId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bitacora', tramos }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'No se pudo guardar.')
      toast('Bitácora guardada.', 'success')
      onCambio()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar.', 'error')
    } finally { setBusy(false) }
  }

  // Sin tramos y sin poder agregarlos, la sección entera sobra: no todo
  // viaje usa carro propio.
  if (!editable && tramos.length === 0) return null

  return (
    <section className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-bold text-navy font-display">Bitácora de kilometraje</h2>
          <p className="text-[13px] text-navy-light/80 font-body">
            Solo si usaste carro propio. Los kilómetros salen del odómetro.
          </p>
        </div>
        {editable && (
          <Button type="button" variante="secundario" tamano="sm"
            onClick={() => setTramos(p => [...p, {
              fecha: '', origen: '', destino: '',
              hora_salida: '', hora_regreso: '',
              // El odómetro arranca donde terminó el tramo anterior: es lo
              // que va a pasar casi siempre y ahorra copiarlo a mano, que es
              // de donde salen las lecturas mal tecleadas.
              km_inicial: p.length ? p[p.length - 1].km_final : 0,
              km_final: p.length ? p[p.length - 1].km_final : 0,
            }])}>
            <Plus size={14} aria-hidden="true" /> Agregar tramo
          </Button>
        )}
      </div>

      {tramos.length === 0 ? (
        <p className="text-[13px] text-navy-light/80 font-body">Sin tramos.</p>
      ) : editable ? (
        <div className="space-y-2">
          {tramos.map((t, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 rounded-xl bg-surface-low p-3 sm:grid-cols-12 sm:items-end">
              <div className="space-y-1 sm:col-span-2">
                <label htmlFor={`t-fecha-${i}`} className={etiqueta}>Fecha</label>
                <DatePicker id={`t-fecha-${i}`} className={campo} value={t.fecha} onChange={v => set(i, { fecha: v })} />
              </div>
              <div className="space-y-1 sm:col-span-3">
                <label htmlFor={`t-org-${i}`} className={etiqueta}>Origen</label>
                <input id={`t-org-${i}`} className={campo} value={t.origen}
                  onChange={e => set(i, { origen: e.target.value })} />
              </div>
              <div className="space-y-1 sm:col-span-3">
                <label htmlFor={`t-des-${i}`} className={etiqueta}>Destino</label>
                <input id={`t-des-${i}`} className={campo} value={t.destino}
                  onChange={e => set(i, { destino: e.target.value })} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label htmlFor={`t-ini-${i}`} className={etiqueta}>Odómetro sale</label>
                <input id={`t-ini-${i}`} type="number" min={0} step="any" className={campo}
                  value={t.km_inicial} onChange={e => set(i, { km_inicial: Number(e.target.value) })} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label htmlFor={`t-fin-${i}`} className={etiqueta}>Odómetro llega</label>
                <input id={`t-fin-${i}`} type="number" min={0} step="any" className={campo}
                  value={t.km_final} onChange={e => set(i, { km_final: Number(e.target.value) })} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label htmlFor={`t-hs-${i}`} className={etiqueta}>Hora salida</label>
                <input id={`t-hs-${i}`} type="time" className={campo} value={t.hora_salida ?? ''}
                  onChange={e => set(i, { hora_salida: e.target.value })} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label htmlFor={`t-hr-${i}`} className={etiqueta}>Hora regreso</label>
                <input id={`t-hr-${i}`} type="time" className={campo} value={t.hora_regreso ?? ''}
                  onChange={e => set(i, { hora_regreso: e.target.value })} />
              </div>
              <div className="flex items-center justify-between gap-2 sm:col-span-8 sm:justify-end">
                <span className="text-[13px] font-semibold text-navy font-display">{kmDelTramo(t)} km</span>
                <button type="button" aria-label={`Quitar el tramo ${i + 1}`}
                  onClick={() => setTramos(p => p.filter((_, j) => j !== i))}
                  className="rounded-full p-1.5 text-navy-light/80 hover:text-coral-deep transition-colors">
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-[var(--outline-variant)]">
          {tramos.map((t, i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-[13px] text-navy font-body truncate">{t.origen} → {t.destino}</p>
                <p className="text-[13px] text-navy-light/80 font-body">
                  {t.fecha ? formatDate(t.fecha) : 'sin fecha'}
                  {t.hora_salida ? ` · ${t.hora_salida}` : ''}{t.hora_regreso ? `–${t.hora_regreso}` : ''}
                  {` · odómetro ${t.km_inicial} → ${t.km_final}`}
                </p>
              </div>
              <span className="shrink-0 text-[13px] font-semibold text-navy font-display">{kmDelTramo(t)} km</span>
            </div>
          ))}
        </div>
      )}

      {editable && problemas.length > 0 && (
        <ul className="space-y-0.5 text-[13px] text-coral-deep font-body">
          {problemas.map((p, i) => (
            <li key={i}>{p.indice >= 0 ? `Tramo ${p.indice + 1}: ` : ''}{p.mensaje}</li>
          ))}
        </ul>
      )}
      {avisos.length > 0 && (
        <ul className="space-y-0.5 text-[13px] text-[#7F6210] font-body">
          {avisos.map((a, i) => <li key={i}>⚠ Tramo {a.indice + 1}: {a.mensaje}</li>)}
        </ul>
      )}

      {tramos.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-[var(--outline-variant)] pt-3">
          <div>
            <p className={etiqueta}>Kilómetros</p>
            <p className="text-base font-bold text-navy font-display">{km} km</p>
          </div>
          <div>
            <p className={etiqueta}>Tarifa por km</p>
            <p className="text-[13px] text-navy font-body">{formatMoney(tarifa, moneda)}</p>
          </div>
          <div>
            <p className={etiqueta}>A reconocer</p>
            <p className="text-base font-bold text-navy font-display">{formatMoney(monto, moneda)}</p>
          </div>
          {tarifa === 0 && (
            <p className="text-[13px] text-[#7F6210] font-body">
              La tarifa por kilómetro todavía no está confirmada en el reglamento, así que el
              monto sale en cero. Los kilómetros sí quedan registrados.
            </p>
          )}
        </div>
      )}

      {/* El requisito de la minuta. Va acá y no arriba: se pide por el
          kilometraje, no por toda liquidación. */}
      {(editable || jefe) && (
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--outline-variant)] pt-3">
          <div className="min-w-0">
            <p className={etiqueta}>Aprobación del jefe o supervisor</p>
            <p className="text-[13px] text-navy-light/80 font-body">
              {jefe ? 'Adjunta ✓' : 'Requisito para el kilometraje.'}
            </p>
          </div>
          {editable && (
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] text-navy-light hover:text-coral-deep transition-colors font-body">
              <Paperclip size={14} aria-hidden="true" />
              {jefe ? 'Cambiar archivo' : 'Adjuntar archivo'}
              <input type="file" accept="image/*,application/pdf" className="sr-only"
                aria-label="Aprobación del jefe o supervisor del viaje"
                onChange={e => { const f = e.target.files?.[0]; if (f) subirAprobacion(f) }} />
            </label>
          )}
        </div>
      )}
      {editable && faltaJefe && (
        <p className="text-[13px] text-coral-deep font-body">
          Sin la aprobación del jefe no se puede enviar la liquidación.
        </p>
      )}

      {editable && (
        <div className="flex justify-end">
          <Button type="button" variante="secundario" tamano="sm" onClick={guardar}
            disabled={busy || problemas.length > 0}>
            {busy ? <><Loader2 size={15} className="animate-spin" aria-hidden="true" /> …</> : 'Guardar bitácora'}
          </Button>
        </div>
      )}
    </section>
  )
}
