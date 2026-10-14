'use client'

/**
 * FIN-11 · El formulario del expediente (ANX-01 + ANX-02).
 *
 * Lo usan la pantalla de crear y la de editar: el mismo formulario, porque un
 * viaje devuelto «por corregir» se arregla en el mismo papel en el que se
 * pidió, no en otro distinto.
 *
 * LOS DATOS PERSONALES NO SE PIDEN. El anexo de papel tiene cédula, puesto,
 * comité, correo y teléfono, y el plan es explícito: salen de la ficha. Pedir
 * de nuevo lo que el sistema ya sabe es cómo terminan conviviendo dos
 * teléfonos de la misma persona sin saber cuál sirve.
 *
 * Las reglas del presupuesto (subtotales, totales por moneda, qué no deja
 * enviar) salen de `lib/travel/presupuesto`, el mismo módulo que usa el
 * servidor.
 */
import { useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/shared/Button'
import { useToast } from '@/components/shared/Toast'
import { formatMoney } from '@/lib/format'
import {
  RUBROS, NOMBRE_DEL_RUBRO, MONEDAS, subtotal, totales, revisarPresupuesto, anticipoCabe,
  type LineaDePresupuesto, type Moneda, type Rubro,
} from '@/lib/travel/presupuesto'

export type ValoresDelViaje = {
  tipo: 'trabajo' | 'capacitacion'
  alcance: 'nacional' | 'internacional'
  destino: string
  sale_at: string
  vuelve_at: string
  acompanantes: string
  objetivo: string
  agenda: string
  beneficio: string
  resultado_esperado: string
  financiamiento: string
  centro_costo: string
  anticipo_monto: string
  anticipo_moneda: Moneda
  lineas: LineaDePresupuesto[]
}

export const VALORES_VACIOS: ValoresDelViaje = {
  tipo: 'trabajo', alcance: 'nacional', destino: '',
  sale_at: '', vuelve_at: '', acompanantes: '',
  objetivo: '', agenda: '', beneficio: '', resultado_esperado: '',
  financiamiento: '', centro_costo: '',
  anticipo_monto: '', anticipo_moneda: 'CRC',
  lineas: [],
}

const etiqueta = 'text-[11px] tracking-widest uppercase text-navy-light/80 font-display'
const campo = 'w-full rounded-xl border border-navy/15 px-3 py-2 text-[13px] text-navy font-body focus:border-coral focus:outline-none focus:ring-1 focus:ring-coral'

export function FormularioDeViaje({ inicial, viajeId, onListo }: {
  inicial?: ValoresDelViaje
  /** Si viene, se edita ese expediente; si no, se crea uno nuevo. */
  viajeId?: string
  onListo: (id: string) => void
}) {
  const [v, setV] = useState<ValoresDelViaje>(inicial ?? VALORES_VACIOS)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  const set = <K extends keyof ValoresDelViaje>(k: K, valor: ValoresDelViaje[K]) =>
    setV(p => ({ ...p, [k]: valor }))

  const setLinea = (i: number, patch: Partial<LineaDePresupuesto>) =>
    setV(p => ({ ...p, lineas: p.lineas.map((l, j) => j === i ? { ...l, ...patch } : l) }))

  const problemas = revisarPresupuesto(v.lineas)
  const sumas = totales(v.lineas)
  const anticipo = Number(v.anticipo_monto) > 0
    ? { monto: Number(v.anticipo_monto), moneda: v.anticipo_moneda }
    : null
  const cabe = anticipoCabe(anticipo, v.lineas)

  const faltaAlgo = !v.destino.trim() || !v.objetivo.trim() || !v.sale_at || !v.vuelve_at
  const fechasAlReves = !!v.sale_at && !!v.vuelve_at && v.vuelve_at < v.sale_at
  const sePuedeGuardar = !faltaAlgo && !fechasAlReves && problemas.length === 0 && cabe.ok

  async function guardar() {
    setBusy(true); setError(null)
    try {
      const cuerpo = {
        tipo: v.tipo, alcance: v.alcance, destino: v.destino.trim(),
        sale_at: new Date(v.sale_at).toISOString(),
        vuelve_at: new Date(v.vuelve_at).toISOString(),
        acompanantes: v.acompanantes.trim() || null,
        objetivo: v.objetivo.trim(),
        agenda: v.agenda.trim() || null,
        beneficio: v.beneficio.trim() || null,
        resultado_esperado: v.resultado_esperado.trim() || null,
        financiamiento: v.financiamiento.trim() || null,
        centro_costo: v.centro_costo.trim() || null,
        anticipo_monto: anticipo?.monto ?? null,
        anticipo_moneda: anticipo?.moneda ?? null,
        lineas: v.lineas,
      }
      const res = await fetch(viajeId ? `/api/travel-requests/${viajeId}` : '/api/travel-requests', {
        method: viajeId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudo guardar el viaje.')
      toast(viajeId ? 'Viaje guardado.' : 'Viaje creado como borrador.', 'success')
      onListo(viajeId ?? data.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el viaje.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] space-y-4">
        <h2 className="text-[13px] font-bold text-navy font-display">El viaje</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="v-tipo" className={etiqueta}>Tipo</label>
            <select id="v-tipo" className={campo} value={v.tipo}
              onChange={e => set('tipo', e.target.value as ValoresDelViaje['tipo'])}>
              <option value="trabajo">Trabajo</option>
              <option value="capacitacion">Capacitación</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="v-alcance" className={etiqueta}>Alcance</label>
            <select id="v-alcance" className={campo} value={v.alcance}
              onChange={e => set('alcance', e.target.value as ValoresDelViaje['alcance'])}>
              <option value="nacional">Nacional</option>
              <option value="internacional">Internacional</option>
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="v-destino" className={etiqueta}>Destino</label>
            <input id="v-destino" className={campo} value={v.destino}
              onChange={e => set('destino', e.target.value)} placeholder="Ciudad, país" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="v-sale" className={etiqueta}>Sale</label>
            <input id="v-sale" type="datetime-local" className={campo} value={v.sale_at}
              onChange={e => set('sale_at', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="v-vuelve" className={etiqueta}>Vuelve</label>
            <input id="v-vuelve" type="datetime-local" className={campo} value={v.vuelve_at}
              onChange={e => set('vuelve_at', e.target.value)} />
            {fechasAlReves && (
              <p className="text-[13px] text-coral-deep font-body">El regreso no puede ser antes de la salida.</p>
            )}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="v-acomp" className={etiqueta}>Acompañantes</label>
            <input id="v-acomp" className={campo} value={v.acompanantes}
              onChange={e => set('acompanantes', e.target.value)} placeholder="Quién más va, si aplica" />
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] space-y-4">
        <div>
          <h2 className="text-[13px] font-bold text-navy font-display">La justificación</h2>
          <p className="text-[13px] text-navy-light/80 font-body">Es lo que se aprueba.</p>
        </div>
        {([
          ['objetivo', 'Objetivo', '¿A qué va?'],
          ['agenda', 'Agenda', 'Qué se hará cada día'],
          ['beneficio', 'Beneficio para Theos', ''],
          ['resultado_esperado', 'Resultado esperado', ''],
        ] as const).map(([k, label, ph]) => (
          <div key={k} className="space-y-1.5">
            <label htmlFor={`v-${k}`} className={etiqueta}>{label}</label>
            <textarea id={`v-${k}`} rows={k === 'objetivo' ? 3 : 2} className={campo}
              value={v[k]} placeholder={ph} onChange={e => set(k, e.target.value)} />
          </div>
        ))}
      </section>

      <section className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[13px] font-bold text-navy font-display">Presupuesto</h2>
            <p className="text-[13px] text-navy-light/80 font-body">
              Cada moneda lleva su propio total: no se suman entre sí.
            </p>
          </div>
          <Button type="button" variante="secundario" tamano="sm"
            onClick={() => setV(p => ({
              ...p,
              lineas: [...p.lineas, { rubro: 'pasajes' as Rubro, descripcion: '', cantidad: 1, tarifa: 0, moneda: 'CRC' as Moneda }],
            }))}>
            <Plus size={14} aria-hidden="true" /> Agregar rubro
          </Button>
        </div>

        {v.lineas.length === 0 ? (
          <p className="text-[13px] text-navy-light/80 font-body">Todavía no hay rubros.</p>
        ) : (
          <div className="space-y-2">
            {v.lineas.map((l, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 rounded-xl bg-surface-low p-3 sm:grid-cols-12 sm:items-end">
                <div className="space-y-1 sm:col-span-3">
                  <label htmlFor={`l-rubro-${i}`} className={etiqueta}>Rubro</label>
                  <select id={`l-rubro-${i}`} className={campo} value={l.rubro}
                    onChange={e => setLinea(i, { rubro: e.target.value as Rubro })}>
                    {RUBROS.map(r => <option key={r} value={r}>{NOMBRE_DEL_RUBRO[r]}</option>)}
                  </select>
                </div>
                <div className="space-y-1 sm:col-span-3">
                  <label htmlFor={`l-desc-${i}`} className={etiqueta}>Detalle</label>
                  <input id={`l-desc-${i}`} className={campo} value={l.descripcion ?? ''}
                    onChange={e => setLinea(i, { descripcion: e.target.value })} />
                </div>
                <div className="space-y-1 sm:col-span-1">
                  <label htmlFor={`l-cant-${i}`} className={etiqueta}>Cant.</label>
                  <input id={`l-cant-${i}`} type="number" min={0} step="any" className={campo}
                    value={l.cantidad} onChange={e => setLinea(i, { cantidad: Number(e.target.value) })} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label htmlFor={`l-tar-${i}`} className={etiqueta}>Tarifa</label>
                  <input id={`l-tar-${i}`} type="number" min={0} step="any" className={campo}
                    value={l.tarifa} onChange={e => setLinea(i, { tarifa: Number(e.target.value) })} />
                </div>
                <div className="space-y-1 sm:col-span-1">
                  <label htmlFor={`l-mon-${i}`} className={etiqueta}>Moneda</label>
                  <select id={`l-mon-${i}`} className={campo} value={l.moneda}
                    onChange={e => setLinea(i, { moneda: e.target.value as Moneda })}>
                    {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="flex items-center justify-between gap-2 sm:col-span-2 sm:justify-end">
                  <span className="text-[13px] font-semibold text-navy font-display">
                    {formatMoney(subtotal(l), l.moneda)}
                  </span>
                  <button type="button" aria-label={`Quitar la línea de ${NOMBRE_DEL_RUBRO[l.rubro]}`}
                    onClick={() => setV(p => ({ ...p, lineas: p.lineas.filter((_, j) => j !== i) }))}
                    className="rounded-full p-1.5 text-navy-light/80 hover:text-coral-deep transition-colors">
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {problemas.length > 0 && (
          <ul className="space-y-0.5 text-[13px] text-coral-deep font-body">
            {problemas.map((p, i) => <li key={i}>Fila {p.indice + 1}: {p.mensaje}</li>)}
          </ul>
        )}

        {sumas.length > 0 && (
          <div className="flex flex-wrap gap-4 border-t border-[var(--outline-variant)] pt-3">
            {sumas.map(t => (
              <div key={t.moneda}>
                <p className={etiqueta}>Total {t.moneda}</p>
                <p className="text-base font-bold text-navy font-display">{formatMoney(t.total, t.moneda)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] space-y-4">
        <h2 className="text-[13px] font-bold text-navy font-display">Financiamiento y anticipo</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="v-fin" className={etiqueta}>Fuente de financiamiento</label>
            <input id="v-fin" className={campo} value={v.financiamiento}
              onChange={e => set('financiamiento', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="v-cc" className={etiqueta}>Centro de costo</label>
            <input id="v-cc" className={campo} value={v.centro_costo}
              onChange={e => set('centro_costo', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="v-ant" className={etiqueta}>Anticipo solicitado</label>
            <input id="v-ant" type="number" min={0} step="any" className={campo} value={v.anticipo_monto}
              onChange={e => set('anticipo_monto', e.target.value)} placeholder="0 si no pide anticipo" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="v-ant-mon" className={etiqueta}>Moneda del anticipo</label>
            <select id="v-ant-mon" className={campo} value={v.anticipo_moneda}
              onChange={e => set('anticipo_moneda', e.target.value as Moneda)}>
              {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        {!cabe.ok && <p className="text-[13px] text-coral-deep font-body">{cabe.motivo}</p>}
      </section>

      {error && <p className="text-[13px] text-coral-deep font-body">{error}</p>}

      <div className="flex justify-end">
        <Button type="button" variante="primario" onClick={guardar} disabled={busy || !sePuedeGuardar}>
          {busy ? <><Loader2 size={15} className="animate-spin" aria-hidden="true" /> Guardando…</>
            : viajeId ? 'Guardar cambios' : 'Crear borrador'}
        </Button>
      </div>
    </div>
  )
}
