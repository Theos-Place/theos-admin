'use client'

/**
 * FIN-12 · Adelantos de comida por sede.
 *
 * UNA pantalla para los dos lectores. El Colaborador de Finanzas de una sede
 * ve SU sede y registra las facturas de cada semana; finanzas ve todas las
 * sedes del mes, fija presupuestos, cierra meses y exporta. Quién ve qué lo
 * decide el servidor (`alcanceDeSedes`): la pantalla solo pinta lo que le
 * llega.
 *
 * Lo que se ve es lo que había en el Excel de Liberia: semanas por fecha de
 * charla con su encargado, facturas con proveedor / N° de factura / monto /
 * estado, y «te quedan ₡X de ₡Y» en vivo. El sobregiro se MARCA, no se
 * bloquea: hay que identificar por qué y decidir el reintegro.
 */
import { useEffect, useState, useCallback } from 'react'
import { Download, Loader2, Lock, Paperclip, Plus, Trash2, UtensilsCrossed } from 'lucide-react'
import { Button } from '@/components/shared/Button'
import { Modal } from '@/components/shared/Modal'
import { useToast } from '@/components/shared/Toast'
import { formatCRC, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  mesActual, nombreDelMes, revisarFactura, sePuedeCerrar, type Factura, type Saldo, type Semana,
} from '@/lib/finance/adelantos'

type FacturaFila = Factura & { id: string; registrado_por_name: string | null }
type Adelanto = {
  id: string; sede_code: string; sede_name: string; mes: string; presupuesto: number; moneda: string
  estado: 'abierto' | 'cerrado'; saldo_final: number | null; cerrado_por_name: string | null; cerrado_at: string | null
  notas: string | null; facturas: FacturaFila[]; saldo: Saldo; semanas: Semana[]
}
type SedeCat = { code: string; name: string; presupuesto: number | null; abierto: boolean }

const etiqueta = 'text-[11px] tracking-widest uppercase text-navy-light/80 font-display'
const campo = 'w-full rounded-xl border border-navy/15 px-3 py-2 text-[13px] text-navy font-body focus:border-coral focus:outline-none focus:ring-1 focus:ring-coral'

const mesAnterior = (m: string) => { const [y, mm] = m.split('-').map(Number); const d = new Date(Date.UTC(y, mm - 2, 1)); return d.toISOString().slice(0, 7) }
const mesSiguiente = (m: string) => { const [y, mm] = m.split('-').map(Number); const d = new Date(Date.UTC(y, mm, 1)); return d.toISOString().slice(0, 7) }

export default function AdelantosPage() {
  const [mes, setMes] = useState(mesActual())
  const [items, setItems] = useState<Adelanto[] | null>(null)
  const [sedes, setSedes] = useState<SedeCat[]>([])
  const [finanzas, setFinanzas] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)
  const toast = useToast()

  const cargar = useCallback(() => {
    fetch(`/api/adelantos?mes=${mes}`)
      .then(async r => { const d = await r.json().catch(() => null); if (!r.ok) throw new Error(d?.error || 'No se pudieron cargar los adelantos.'); return d })
      .then(d => { setItems(d.items); setSedes(d.sedes); setFinanzas(d.finanzas); setError(null) })
      .catch((e: Error) => { setError(e.message); setItems([]) })
  }, [mes])
  useEffect(cargar, [cargar])

  async function abrir(sede_code: string) {
    const r = await fetch('/api/adelantos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'abrir', sede_code, mes }) })
    const d = await r.json().catch(() => null)
    if (!r.ok) { toast(d?.error || 'No se pudo abrir el mes.', 'error'); return }
    toast(`${nombreDelMes(mes)} abierto.`, 'success'); cargar(); setAbierto(d.id)
  }

  const sinAbrir = sedes.filter(s => !s.abierto)
  const seleccionado = items?.find(a => a.id === abierto) ?? (items && items.length === 1 ? items[0] : null)

  return (
    <div className="page space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-soft/30 shrink-0"><UtensilsCrossed size={20} className="text-teal-deep" aria-hidden="true" /></div>
          <div>
            <h1 className="text-xl font-bold text-navy font-display">Adelantos de comida</h1>
            <p className="text-[13px] text-navy-light/80 font-body">{finanzas ? 'Todas las sedes.' : 'Tu sede.'} Las facturas de cada semana, contra el presupuesto del mes.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setMes(mesAnterior(mes))} className="rounded-full border border-navy/15 px-3 py-1.5 text-[13px] text-navy-light hover:text-navy font-body" aria-label="Mes anterior">‹</button>
          <span className="text-[13px] font-semibold text-navy font-display min-w-[140px] text-center">{nombreDelMes(mes)}</span>
          <button type="button" onClick={() => setMes(mesSiguiente(mes))} className="rounded-full border border-navy/15 px-3 py-1.5 text-[13px] text-navy-light hover:text-navy font-body" aria-label="Mes siguiente">›</button>
          {finanzas && (
            <Button href={`/api/adelantos/export?mes=${mes}`} variante="secundario" tamano="sm"><Download size={14} aria-hidden="true" /> Excel</Button>
          )}
        </div>
      </div>

      {error && <p className="rounded-2xl bg-coral/10 px-4 py-3 text-[13px] text-coral-deep font-body">{error}</p>}

      {items && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-3">
            {items.map(a => (
              <button key={a.id} type="button" onClick={() => setAbierto(a.id)}
                className={cn('w-full rounded-2xl bg-surface-card p-4 text-left shadow-[var(--shadow-md)] transition-colors', seleccionado?.id === a.id ? 'ring-2 ring-coral/50' : 'hover:bg-surface-low')}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-bold text-navy font-display">{a.sede_name}</p>
                  {a.estado === 'cerrado' ? <Lock size={13} className="text-navy-light/80" aria-label="Mes cerrado" /> : a.saldo.sobregiro ? <span className="rounded-full bg-coral/10 px-2 py-0.5 text-[11px] font-semibold text-coral-deep font-display">SOBREGIRO</span> : null}
                </div>
                <p className="text-[13px] text-navy-light/80 font-body">Quedan <strong className={cn('font-display', a.saldo.sobregiro ? 'text-coral-deep' : 'text-navy')}>{formatCRC(a.saldo.restante)}</strong> de {formatCRC(a.presupuesto)}</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-low"><div className={cn('h-full', a.saldo.sobregiro ? 'bg-coral' : 'bg-teal')} style={{ width: `${a.saldo.porcentaje}%` }} /></div>
              </button>
            ))}
            {sinAbrir.length > 0 && (
              <div className="rounded-2xl bg-surface-card p-4 shadow-[var(--shadow-md)] space-y-2">
                <p className={etiqueta}>Sin abrir en {nombreDelMes(mes)}</p>
                {sinAbrir.map(s => (
                  <div key={s.code} className="flex items-center justify-between gap-2">
                    <span className="text-[13px] text-navy font-body">{s.name}{s.presupuesto == null && <span className="text-navy-light/80"> · sin presupuesto</span>}</span>
                    <Button type="button" variante="secundario" tamano="sm" disabled={s.presupuesto == null} onClick={() => abrir(s.code)}>Abrir mes</Button>
                  </div>
                ))}
              </div>
            )}
            {finanzas && <Presupuestos sedes={sedes} onCambio={cargar} />}
            {items.length === 0 && sinAbrir.length === 0 && <p className="text-[13px] text-navy-light/80 font-body">No hay sedes en tu alcance.</p>}
          </div>

          <div className="lg:col-span-2">
            {seleccionado
              ? <DetalleDelMes a={seleccionado} finanzas={finanzas} onCambio={cargar} />
              : <p className="rounded-2xl bg-surface-card p-6 text-center text-[13px] text-navy-light/80 font-body">Elegí una sede.</p>}
          </div>
        </div>
      )}
    </div>
  )
}

function Presupuestos({ sedes, onCambio }: { sedes: SedeCat[]; onCambio: () => void }) {
  const [editando, setEditando] = useState<string | null>(null)
  const [monto, setMonto] = useState('')
  const toast = useToast()
  async function guardar(sede_code: string) {
    const r = await fetch('/api/adelantos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'presupuesto', sede_code, monto: Number(monto) }) })
    if (!r.ok) { toast((await r.json().catch(() => null))?.error || 'No se pudo guardar.', 'error'); return }
    toast('Presupuesto guardado. Aplica a los meses que se abran de ahora en adelante.', 'success'); setEditando(null); onCambio()
  }
  return (
    <div className="rounded-2xl bg-surface-card p-4 shadow-[var(--shadow-md)] space-y-2">
      <p className={etiqueta}>Presupuesto mensual por sede</p>
      {sedes.map(s => (
        <div key={s.code} className="flex items-center justify-between gap-2">
          <span className="text-[13px] text-navy font-body">{s.name}</span>
          {editando === s.code ? (
            <span className="flex items-center gap-1">
              <input type="number" min={0} className={`${campo} w-28`} value={monto} onChange={e => setMonto(e.target.value)} aria-label={`Presupuesto de ${s.name}`} />
              <Button type="button" variante="primario" tamano="sm" onClick={() => guardar(s.code)}>OK</Button>
            </span>
          ) : (
            <button type="button" className="text-[13px] text-navy-light/80 hover:text-coral font-body" onClick={() => { setEditando(s.code); setMonto(s.presupuesto?.toString() ?? '') }}>
              {s.presupuesto == null ? 'Fijar' : formatCRC(s.presupuesto)}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function DetalleDelMes({ a, finanzas, onCambio }: { a: Adelanto; finanzas: boolean; onCambio: () => void }) {
  const [nueva, setNueva] = useState(false)
  const [cerrando, setCerrando] = useState(false)
  const toast = useToast()
  const editable = a.estado === 'abierto'
  const cierre = sePuedeCerrar(a.estado, a.facturas)

  async function quitar(id: string) {
    const r = await fetch(`/api/adelantos/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'quitar_factura', factura_id: id }) })
    if (!r.ok) { toast((await r.json().catch(() => null))?.error || 'No se pudo quitar.', 'error'); return }
    onCambio()
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-navy font-display">{a.sede_name} · {nombreDelMes(a.mes)}</h2>
            <p className="text-[13px] text-navy-light/80 font-body">
              Gastado {formatCRC(a.saldo.gastado)}{a.saldo.pendiente > 0 && <> · pendiente de liquidar {formatCRC(a.saldo.pendiente)}</>} · presupuesto {formatCRC(a.presupuesto)}
            </p>
            <p className={cn('mt-1 text-base font-bold font-display', a.saldo.sobregiro ? 'text-coral-deep' : 'text-navy')}>
              {a.saldo.sobregiro ? `Sobregiro de ${formatCRC(-a.saldo.restante)}` : `Quedan ${formatCRC(a.saldo.restante)}`}
            </p>
            {a.estado === 'cerrado' && (
              <p className="mt-1 text-[13px] text-navy-light/80 font-body">Cerrado por {a.cerrado_por_name ?? '—'} el {formatDate(a.cerrado_at!)} · saldo final {formatCRC(a.saldo_final ?? 0)}{a.notas ? ` — ${a.notas}` : ''}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {editable && <Button type="button" variante="primario" tamano="sm" onClick={() => setNueva(true)}><Plus size={14} aria-hidden="true" /> Factura</Button>}
            {editable && finanzas && <Button type="button" variante="secundario" tamano="sm" onClick={() => setCerrando(true)} disabled={!cierre.ok} title={cierre.ok ? '' : cierre.motivo}><Lock size={14} aria-hidden="true" /> Cerrar mes</Button>}
          </div>
        </div>
        {editable && finanzas && !cierre.ok && <p className="mt-2 text-[13px] text-[#7F6210] font-body">{cierre.motivo}</p>}
      </section>

      {a.semanas.length === 0 ? (
        <p className="rounded-2xl bg-surface-card p-6 text-center text-[13px] text-navy-light/80 font-body">Sin facturas todavía.</p>
      ) : a.semanas.map(s => (
        <section key={s.semana} className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-[13px] font-bold text-navy font-display">Semana del {formatDate(s.semana)}{s.encargado ? ` · ${s.encargado}` : ''}</h3>
            <span className="text-[13px] font-semibold text-navy font-display">{formatCRC(s.total)}</span>
          </div>
          <div className="mt-2 divide-y divide-[var(--outline-variant)]">
            {s.facturas.map(f => { const ff = f as FacturaFila; return (
              <div key={ff.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-[13px] text-navy font-body truncate">{ff.proveedor}{ff.numero_factura ? ` · N° ${ff.numero_factura}` : ''}</p>
                  <p className="text-[13px] text-navy-light/80 font-body truncate">
                    {formatDate(ff.fecha)}{ff.observaciones ? ` · ${ff.observaciones}` : ''}{ff.receipt_path ? ' · con foto' : ' · SIN foto'}
                    {ff.estado === 'pendiente' && <span className="ml-1 rounded-full bg-[rgba(233,185,73,0.15)] px-2 py-0.5 text-[11px] font-semibold text-[#7F6210] font-display">PENDIENTE</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[13px] font-semibold text-navy font-display">{formatCRC(ff.monto)}</span>
                  {editable && <button type="button" aria-label={`Quitar factura de ${ff.proveedor}`} onClick={() => quitar(ff.id)} className="rounded-full p-1.5 text-navy-light/80 hover:text-coral-deep"><Trash2 size={14} aria-hidden="true" /></button>}
                </div>
              </div>
            ) })}
          </div>
        </section>
      ))}

      {nueva && <ModalFactura a={a} onCerrar={() => setNueva(false)} onListo={() => { setNueva(false); onCambio() }} />}
      {cerrando && <ModalCerrar a={a} onCerrar={() => setCerrando(false)} onListo={() => { setCerrando(false); onCambio() }} />}
    </div>
  )
}

function ModalFactura({ a, onCerrar, onListo }: { a: Adelanto; onCerrar: () => void; onListo: () => void }) {
  const ultima = a.facturas[a.facturas.length - 1]
  const [f, setF] = useState<Factura>({ semana: ultima?.semana ?? '', encargado: ultima?.encargado ?? '', fecha: '', proveedor: '', numero_factura: '', monto: 0, estado: 'liquidada', observaciones: '', receipt_path: null })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()
  const problemas = revisarFactura(f, a.mes)
  const set = <K extends keyof Factura>(k: K, v: Factura[K]) => setF(p => ({ ...p, [k]: v }))

  async function subir(file: File) {
    const fd = new FormData(); fd.append('file', file)
    const r = await fetch(`/api/adelantos/${a.id}/receipts`, { method: 'POST', body: fd })
    const d = await r.json().catch(() => null)
    if (!r.ok) { toast(d?.error || 'No se pudo subir la foto.', 'error'); return }
    set('receipt_path', d.receipt_path); toast('Foto adjunta.', 'success')
  }
  async function guardar() {
    setBusy(true); setError(null)
    try {
      const r = await fetch(`/api/adelantos/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'factura', factura: { ...f, monto: Number(f.monto) } }) })
      const d = await r.json().catch(() => null)
      if (!r.ok) throw new Error(d?.error || 'No se pudo guardar.')
      onListo()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.') } finally { setBusy(false) }
  }

  return (
    <Modal onClose={() => !busy && onCerrar()} titleId="factura-title" width={460}>
      <div className="p-5 space-y-3">
        <h2 id="factura-title" className="text-base font-bold text-navy font-display">Nueva factura · {a.sede_name}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><label htmlFor="f-semana" className={etiqueta}>Semana (fecha de charla)</label><input id="f-semana" type="date" className={campo} value={f.semana} onChange={e => set('semana', e.target.value)} /></div>
          <div className="space-y-1"><label htmlFor="f-enc" className={etiqueta}>Encargado</label><input id="f-enc" className={campo} value={f.encargado ?? ''} onChange={e => set('encargado', e.target.value)} /></div>
          <div className="space-y-1"><label htmlFor="f-fecha" className={etiqueta}>Fecha de la factura</label><input id="f-fecha" type="date" className={campo} value={f.fecha} onChange={e => set('fecha', e.target.value)} /></div>
          <div className="space-y-1"><label htmlFor="f-monto" className={etiqueta}>Monto</label><input id="f-monto" type="number" min={0} step="any" className={campo} value={f.monto || ''} onChange={e => set('monto', Number(e.target.value))} /></div>
          <div className="space-y-1 col-span-2"><label htmlFor="f-prov" className={etiqueta}>Proveedor</label><input id="f-prov" className={campo} value={f.proveedor} onChange={e => set('proveedor', e.target.value)} /></div>
          <div className="space-y-1"><label htmlFor="f-num" className={etiqueta}>N° factura electrónica</label><input id="f-num" className={campo} value={f.numero_factura ?? ''} onChange={e => set('numero_factura', e.target.value)} /></div>
          <div className="space-y-1"><label htmlFor="f-estado" className={etiqueta}>Estado</label>
            <select id="f-estado" className={campo} value={f.estado} onChange={e => set('estado', e.target.value as Factura['estado'])}><option value="liquidada">Liquidada</option><option value="pendiente">Pendiente</option></select></div>
          <div className="space-y-1 col-span-2"><label htmlFor="f-obs" className={etiqueta}>Observaciones</label><input id="f-obs" className={campo} value={f.observaciones ?? ''} onChange={e => set('observaciones', e.target.value)} placeholder="comida, desechables…" /></div>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] text-navy-light hover:text-coral font-body">
          <Paperclip size={14} aria-hidden="true" /> {f.receipt_path ? 'Cambiar foto de la factura' : 'Adjuntar foto de la factura'}
          <input type="file" accept="image/*,application/pdf" className="sr-only" aria-label="Foto de la factura" onChange={e => { const x = e.target.files?.[0]; if (x) subir(x) }} />
        </label>
        {f.receipt_path && <span className="ml-2 text-[13px] text-success-deep font-body">Adjunta ✓</span>}
        {problemas.length > 0 && <ul className="text-[13px] text-coral-deep font-body">{problemas.map((p, i) => <li key={i}>{p.mensaje}</li>)}</ul>}
        {error && <p className="text-[13px] text-coral-deep font-body">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variante="fantasma" tamano="sm" onClick={onCerrar} disabled={busy}>Cancelar</Button>
          <Button type="button" variante="primario" tamano="sm" onClick={guardar} disabled={busy || problemas.length > 0}>{busy ? <><Loader2 size={15} className="animate-spin" aria-hidden="true" /> …</> : 'Guardar factura'}</Button>
        </div>
      </div>
    </Modal>
  )
}

function ModalCerrar({ a, onCerrar, onListo }: { a: Adelanto; onCerrar: () => void; onListo: () => void }) {
  const [notas, setNotas] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  async function confirmar() {
    setBusy(true)
    const r = await fetch(`/api/adelantos/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cerrar', notas: notas.trim() || null }) })
    setBusy(false)
    if (!r.ok) { toast((await r.json().catch(() => null))?.error || 'No se pudo cerrar.', 'error'); return }
    toast('Mes cerrado.', 'success'); onListo()
  }
  return (
    <Modal onClose={() => !busy && onCerrar()} titleId="cerrar-title" width={420}>
      <div className="p-5 space-y-3">
        <h2 id="cerrar-title" className="text-base font-bold text-navy font-display">Cerrar {nombreDelMes(a.mes)} · {a.sede_name}</h2>
        <p className="text-[13px] text-navy-light/80 font-body">
          Queda registrado un saldo final de <strong className={a.saldo.sobregiro ? 'text-coral-deep' : 'text-navy'}>{formatCRC(a.saldo.restante)}</strong>{a.saldo.sobregiro ? ' (sobregiro: decidir el reintegro)' : ''}. Después ya no se agregan facturas.
        </p>
        <div className="space-y-1"><label htmlFor="c-notas" className={etiqueta}>Notas (opcional)</label><textarea id="c-notas" rows={2} className={campo} value={notas} onChange={e => setNotas(e.target.value)} /></div>
        <div className="flex justify-end gap-2">
          <Button type="button" variante="fantasma" tamano="sm" onClick={onCerrar} disabled={busy}>Cancelar</Button>
          <Button type="button" variante="primario" tamano="sm" onClick={confirmar} disabled={busy}>Cerrar mes</Button>
        </div>
      </div>
    </Modal>
  )
}
