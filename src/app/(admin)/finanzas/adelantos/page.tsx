'use client'

/**
 * FIN-12 · Adelantos de comida por sede → FIN-16 · Presupuestos de sedes.
 *
 * FIN-16 (decidido con Meli): varios TIPOS de presupuesto por sede (comida,
 * bienvenida, desechables…), cada mes = saldo del mes anterior + depósito
 * (pedido de Andrés), los depósitos se cargan del Excel de control, cada
 * factura muestra su foto, y el mes se elige de una lista de mes y año.
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
import { Download, Eye, FileUp, Loader2, Lock, Paperclip, Plus, Trash2, UtensilsCrossed } from 'lucide-react'
import { Button } from '@/components/shared/Button'
import { Modal } from '@/components/shared/Modal'
import { useToast } from '@/components/shared/Toast'
import { formatCRC, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { DatePicker } from '@/components/events/DatePicker'
import {
  mesActual, nombreDelMes, revisarFactura, sePuedeCerrar, type Factura, type Saldo, type Semana,
} from '@/lib/finance/adelantos'
import type { TipoDePresupuesto } from '@/lib/finance/presupuestos-de-sedes'

type FacturaFila = Factura & { id: string; registrado_por_name: string | null }
type Adelanto = {
  id: string; sede_code: string; sede_name: string; tipo: string; tipo_nombre: string; mes: string; presupuesto: number; moneda: string
  saldo_anterior: number; deposito: number; arrastre_confirmado: boolean
  estado: 'abierto' | 'cerrado'; saldo_final: number | null; cerrado_por_name: string | null; cerrado_at: string | null
  notas: string | null; facturas: FacturaFila[]; saldo: Saldo; semanas: Semana[]
}
type SedeCat = { code: string; name: string; presupuestos: Record<string, number | null>; abiertos: string[] }

const etiqueta = 'text-[11px] tracking-widest uppercase text-navy-light/80 font-display'
const campo = 'w-full rounded-xl border border-navy/15 px-3 py-2 text-[13px] text-navy font-body focus:border-coral focus:outline-none focus:ring-1 focus:ring-coral'


export default function AdelantosPage() {
  const [mes, setMes] = useState(mesActual())
  const [items, setItems] = useState<Adelanto[] | null>(null)
  const [sedes, setSedes] = useState<SedeCat[]>([])
  const [tipos, setTipos] = useState<TipoDePresupuesto[]>([])
  const [meses, setMeses] = useState<string[]>([mesActual()])
  const [tipo, setTipo] = useState<string>('todos')
  const [finanzas, setFinanzas] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)
  const toast = useToast()

  const cargar = useCallback(() => {
    fetch(`/api/adelantos?mes=${mes}`)
      .then(async r => { const d = await r.json().catch(() => null); if (!r.ok) throw new Error(d?.error || 'No se pudieron cargar los presupuestos.'); return d })
      .then(d => { setItems(d.items); setSedes(d.sedes); setTipos(d.tipos); setMeses(d.meses); setFinanzas(d.finanzas); setError(null) })
      .catch((e: Error) => { setError(e.message); setItems([]) })
  }, [mes])
  useEffect(cargar, [cargar])

  async function abrir(sede_code: string, t: string) {
    const r = await fetch('/api/adelantos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'abrir', sede_code, tipo: t, mes }) })
    const d = await r.json().catch(() => null)
    if (!r.ok) { toast(d?.error || 'No se pudo abrir el mes.', 'error'); return }
    toast(`${nombreDelMes(mes)} abierto.`, 'success'); cargar(); setAbierto(d.id)
  }

  const tiposActivos = tipos.filter(t => t.activo)
  const enFiltro = (t: string) => tipo === 'todos' || tipo === t
  const visibles = (items ?? []).filter(a => enFiltro(a.tipo))
  const porAbrir = sedes.flatMap(s => tiposActivos.filter(t => enFiltro(t.code) && !s.abiertos.includes(t.code))
    .map(t => ({ sede: s, tipo: t, presupuesto: s.presupuestos[t.code] ?? null })))
  // Solo se listan los que se PUEDEN abrir: con 9 sedes y 4 tipos, la lista de
  // «sin presupuesto» eran 36 filas con el botón apagado. Esos se cuentan.
  const sinAbrir = porAbrir.filter(x => x.presupuesto != null)
  const sinPresupuesto = porAbrir.length - sinAbrir.length
  const seleccionado = visibles.find(a => a.id === abierto) ?? (visibles.length === 1 ? visibles[0] : null)
  // El presupuesto mensual se edita por tipo: con «Todos», el primero.
  const tipoDePresupuesto = tipo === 'todos' ? tiposActivos[0]?.code : tipo
  const mesesConActual = meses.includes(mes) ? meses : [mes, ...meses]

  return (
    <div className="page space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-soft/30 shrink-0"><UtensilsCrossed size={20} className="text-teal-deep" aria-hidden="true" /></div>
          <div>
            <h1 className="text-xl font-bold text-navy font-display">Presupuestos de sedes</h1>
            <p className="text-[13px] text-navy-light/80 font-body">{finanzas ? 'Todas las sedes.' : 'Tu sede.'} Las facturas de cada semana, contra lo disponible del mes.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* FIN-16 · Mes y año de una lista: las flechas de a un mes no servían para buscar otro año. */}
          <label htmlFor="selector-de-mes" className="sr-only">Mes</label>
          <select id="selector-de-mes" value={mes} onChange={e => { setMes(e.target.value); setAbierto(null) }}
            className="rounded-full border border-navy/15 bg-surface-card px-3 py-1.5 text-[13px] font-semibold text-navy font-display">
            {mesesConActual.map(m => <option key={m} value={m}>{nombreDelMes(m)}</option>)}
          </select>
          {finanzas && <Button type="button" variante="secundario" tamano="sm" onClick={() => setImportando(true)}><FileUp size={14} aria-hidden="true" /> Cargar depósitos</Button>}
          {finanzas && <Button href={`/api/adelantos/export?mes=${mes}`} variante="secundario" tamano="sm"><Download size={14} aria-hidden="true" /> Excel</Button>}
        </div>
      </div>

      {tipos.length > 1 && (
        <div role="tablist" aria-label="Tipo de presupuesto" className="flex flex-wrap gap-1.5">
          {[{ code: 'todos', nombre: 'Todos' }, ...tiposActivos].map(t => (
            <button key={t.code} type="button" role="tab" aria-selected={tipo === t.code} onClick={() => { setTipo(t.code); setAbierto(null) }}
              className={cn('rounded-full px-3 py-1.5 text-[13px] font-body transition-colors', tipo === t.code ? 'bg-navy text-white' : 'bg-surface-card text-navy-light hover:text-navy border border-navy/15')}>
              {t.nombre}
            </button>
          ))}
        </div>
      )}

      {error && <p className="rounded-2xl bg-coral/10 px-4 py-3 text-[13px] text-coral-deep font-body">{error}</p>}

      {items && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-3">
            {visibles.map(a => (
              <button key={a.id} type="button" onClick={() => setAbierto(a.id)}
                className={cn('w-full rounded-2xl bg-surface-card p-4 text-left shadow-[var(--shadow-md)] transition-colors', seleccionado?.id === a.id ? 'ring-2 ring-coral/50' : 'hover:bg-surface-low')}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-bold text-navy font-display">{a.sede_name} <span className="font-normal text-navy-light/80">· {a.tipo_nombre}</span></p>
                  {a.estado === 'cerrado' ? <Lock size={13} className="text-navy-light/80" aria-label="Mes cerrado" /> : a.saldo.sobregiro ? <span className="rounded-full bg-coral/10 px-2 py-0.5 text-[11px] font-semibold text-coral-deep font-display">SOBREGIRO</span> : null}
                </div>
                <p className="text-[13px] text-navy-light/80 font-body">Quedan <strong className={cn('font-display', a.saldo.sobregiro ? 'text-coral-deep' : 'text-navy')}>{formatCRC(a.saldo.restante)}</strong> de {formatCRC(a.presupuesto)}</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-low"><div className={cn('h-full', a.saldo.sobregiro ? 'bg-coral' : 'bg-teal')} style={{ width: `${a.saldo.porcentaje}%` }} /></div>
              </button>
            ))}
            {(sinAbrir.length > 0 || sinPresupuesto > 0) && (
              <div className="rounded-2xl bg-surface-card p-4 shadow-[var(--shadow-md)] space-y-2">
                <p className={etiqueta}>Sin abrir en {nombreDelMes(mes)}</p>
                {sinAbrir.map(x => (
                  <div key={`${x.sede.code}:${x.tipo.code}`} className="flex items-center justify-between gap-2">
                    <span className="text-[13px] text-navy font-body">{x.sede.name} · {x.tipo.nombre}</span>
                    <Button type="button" variante="secundario" tamano="sm" onClick={() => abrir(x.sede.code, x.tipo.code)}>Abrir mes</Button>
                  </div>
                ))}
                {sinPresupuesto > 0 && (
                  <p className="text-[13px] text-navy-light/80 font-body">
                    {sinPresupuesto} {sinPresupuesto === 1 ? 'combinación' : 'combinaciones'} de sede y tipo sin presupuesto: {finanzas ? 'se fija abajo, o se abren al cargar los depósitos.' : 'finanzas lo fija primero.'}
                  </p>
                )}
              </div>
            )}
            {finanzas && tipoDePresupuesto && <Presupuestos sedes={sedes} tipo={tipos.find(t => t.code === tipoDePresupuesto)!} onCambio={cargar} />}
            {finanzas && <TiposDePresupuesto tipos={tipos} onCambio={cargar} />}
            {visibles.length === 0 && porAbrir.length === 0 && <p className="text-[13px] text-navy-light/80 font-body">No hay sedes en tu alcance.</p>}
          </div>

          <div className="lg:col-span-2">
            {seleccionado
              ? <DetalleDelMes a={seleccionado} finanzas={finanzas} onCambio={cargar} />
              : <p className="rounded-2xl bg-surface-card p-6 text-center text-[13px] text-navy-light/80 font-body">Elegí una sede.</p>}
          </div>
        </div>
      )}
      {importando && <ModalImportar mes={mes} tipos={tiposActivos} tipoInicial={tipoDePresupuesto ?? ''} onCerrar={() => setImportando(false)} onListo={() => { setImportando(false); cargar() }} />}
    </div>
  )
}

function Presupuestos({ sedes, tipo, onCambio }: { sedes: SedeCat[]; tipo: TipoDePresupuesto; onCambio: () => void }) {
  const [editando, setEditando] = useState<string | null>(null)
  const [monto, setMonto] = useState('')
  const toast = useToast()
  async function guardar(sede_code: string) {
    const r = await fetch('/api/adelantos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'presupuesto', sede_code, tipo: tipo.code, monto: Number(monto) }) })
    if (!r.ok) { toast((await r.json().catch(() => null))?.error || 'No se pudo guardar.', 'error'); return }
    toast('Presupuesto guardado. Aplica a los meses que se abran de ahora en adelante.', 'success'); setEditando(null); onCambio()
  }
  return (
    <div className="rounded-2xl bg-surface-card p-4 shadow-[var(--shadow-md)] space-y-2">
      <p className={etiqueta}>Presupuesto mensual · {tipo.nombre}</p>
      {sedes.map(s => {
        const actual = s.presupuestos[tipo.code] ?? null
        return (
          <div key={s.code} className="flex items-center justify-between gap-2">
            <span className="text-[13px] text-navy font-body">{s.name}</span>
            {editando === s.code ? (
              <span className="flex items-center gap-1">
                <input type="number" min={0} className={`${campo} w-28`} value={monto} onChange={e => setMonto(e.target.value)} aria-label={`Presupuesto de ${tipo.nombre} de ${s.name}`} />
                <Button type="button" variante="primario" tamano="sm" onClick={() => guardar(s.code)}>OK</Button>
              </span>
            ) : (
              <button type="button" className="text-[13px] text-navy-light/80 hover:text-coral-deep font-body" onClick={() => { setEditando(s.code); setMonto(actual?.toString() ?? '') }}>
                {actual == null ? 'Fijar' : formatCRC(actual)}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** FIN-16 · El catálogo de tipos: nombre, si está activo y qué puestos lo ven. */
function TiposDePresupuesto({ tipos, onCambio }: { tipos: TipoDePresupuesto[]; onCambio: () => void }) {
  const [editando, setEditando] = useState<{ code?: string; nombre: string; puestos: string; activo: boolean } | null>(null)
  const toast = useToast()
  async function guardar() {
    if (!editando?.nombre.trim()) return
    const r = await fetch('/api/adelantos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'tipo', ...editando }) })
    if (!r.ok) { toast((await r.json().catch(() => null))?.error || 'No se pudo guardar el tipo.', 'error'); return }
    toast('Tipo guardado.', 'success'); setEditando(null); onCambio()
  }
  return (
    <div className="rounded-2xl bg-surface-card p-4 shadow-[var(--shadow-md)] space-y-2">
      <div className="flex items-center justify-between">
        <p className={etiqueta}>Tipos de presupuesto</p>
        <button type="button" className="text-[13px] text-coral-deep hover:underline font-body" onClick={() => setEditando({ nombre: '', puestos: '', activo: true })}>+ Nuevo</button>
      </div>
      {tipos.map(t => (
        <div key={t.code} className="flex items-center justify-between gap-2">
          <span className={cn('text-[13px] font-body', t.activo ? 'text-navy' : 'text-navy-light/80 line-through')}>
            {t.nombre}
            <span className="block text-navy-light/80 no-underline">{t.puestos.length ? `Lo ven: ${t.puestos.join(', ')}` : 'Lo ve todo el equipo de la sede'}</span>
          </span>
          <button type="button" className="text-[13px] text-navy-light/80 hover:text-coral-deep font-body" onClick={() => setEditando({ code: t.code, nombre: t.nombre, puestos: t.puestos.join(', '), activo: t.activo })}>Editar</button>
        </div>
      ))}
      {editando && (
        <Modal onClose={() => setEditando(null)} titleId="tipo-title" width={420}>
          <div className="p-5 space-y-3">
            <h2 id="tipo-title" className="text-base font-bold text-navy font-display">{editando.code ? 'Editar tipo' : 'Nuevo tipo de presupuesto'}</h2>
            <div className="space-y-1"><label htmlFor="t-nombre" className={etiqueta}>Nombre</label><input id="t-nombre" className={campo} value={editando.nombre} onChange={e => setEditando({ ...editando, nombre: e.target.value })} /></div>
            <div className="space-y-1">
              <label htmlFor="t-puestos" className={etiqueta}>Puestos que lo ven (opcional)</label>
              <input id="t-puestos" className={campo} value={editando.puestos} onChange={e => setEditando({ ...editando, puestos: e.target.value })} placeholder="Coordinador Comida, Encargado Logística" />
              <p className="text-[13px] text-navy-light/80 font-body">Separados por coma. Vacío: lo ve todo el equipo de la sede con acceso a presupuestos.</p>
            </div>
            <label className="flex items-center gap-2 text-[13px] text-navy font-body"><input type="checkbox" checked={editando.activo} onChange={e => setEditando({ ...editando, activo: e.target.checked })} /> Activo</label>
            <div className="flex justify-end gap-2">
              <Button type="button" variante="fantasma" tamano="sm" onClick={() => setEditando(null)}>Cancelar</Button>
              <Button type="button" variante="primario" tamano="sm" onClick={guardar} disabled={!editando.nombre.trim()}>Guardar</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

type Cambio = { sede_code: string; sede_name: string; nombre_en_excel: string; monto: number; fila: number; deposito_actual: number | null; que: 'abre' | 'cambia' | 'igual' | 'cerrado' }

/** FIN-16 · Cargar los depósitos del mes desde el Excel de Andrés: primero se ve, después se aplica. */
function ModalImportar({ mes, tipos, tipoInicial, onCerrar, onListo }: {
  mes: string; tipos: TipoDePresupuesto[]; tipoInicial: string; onCerrar: () => void; onListo: () => void
}) {
  const [tipo, setTipo] = useState(tipoInicial || tipos[0]?.code || '')
  const [file, setFile] = useState<File | null>(null)
  const [vista, setVista] = useState<{ cambios: Cambio[]; sin_sede: Array<{ nombre: string; monto: number; fila: number }>; repetidas: string[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  async function mandar(aplicar: boolean) {
    if (!file || !tipo) return
    setBusy(true); setError(null)
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('mes', mes); fd.append('tipo', tipo); fd.append('aplicar', aplicar ? '1' : '0')
      const r = await fetch('/api/adelantos/deposit-imports', { method: 'POST', body: fd })
      const d = await r.json().catch(() => null)
      if (!r.ok) throw new Error(d?.error || 'No se pudo leer el archivo.')
      if (aplicar) { toast(d.mensaje, 'success'); onListo() } else setVista(d)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo leer el archivo.') } finally { setBusy(false) }
  }

  const QUE: Record<Cambio['que'], string> = { abre: 'Abre el mes', cambia: 'Cambia', igual: 'Sin cambio', cerrado: 'Mes cerrado: no se toca' }
  const aplicables = vista?.cambios.filter(c => c.que === 'abre' || c.que === 'cambia').length ?? 0

  return (
    <Modal onClose={() => !busy && onCerrar()} titleId="importar-title" width={620}>
      <div className="p-5 space-y-3">
        <h2 id="importar-title" className="text-base font-bold text-navy font-display">Cargar depósitos · {nombreDelMes(mes)}</h2>
        <p className="text-[13px] text-navy-light/80 font-body">El Excel de control con el nombre de la sede y el monto depositado del mes. Primero se muestra qué se va a cargar; nada se guarda hasta aplicar.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1"><label htmlFor="imp-tipo" className={etiqueta}>Tipo de presupuesto</label>
            <select id="imp-tipo" className={campo} value={tipo} onChange={e => { setTipo(e.target.value); setVista(null) }}>{tipos.map(t => <option key={t.code} value={t.code}>{t.nombre}</option>)}</select></div>
          <div className="space-y-1"><label htmlFor="imp-file" className={etiqueta}>Archivo (.xlsx o .csv)</label>
            <input id="imp-file" type="file" accept=".xlsx,.csv" className="text-[13px] font-body" onChange={e => { setFile(e.target.files?.[0] ?? null); setVista(null) }} /></div>
        </div>
        {vista && (
          <div className="space-y-2">
            <div className="max-h-72 overflow-auto rounded-xl border border-navy/10">
              <table className="w-full text-[13px] font-body">
                <thead><tr className="text-left text-navy-light/80"><th className="px-3 py-2">Sede</th><th className="px-3 py-2">En el Excel</th><th className="px-3 py-2 text-right">Depósito</th><th className="px-3 py-2 text-right">Hoy</th><th className="px-3 py-2">Qué pasa</th></tr></thead>
                <tbody>
                  {vista.cambios.map(c => (
                    <tr key={c.sede_code} className="border-t border-navy/10">
                      <td className="px-3 py-1.5 text-navy">{c.sede_name}</td>
                      <td className="px-3 py-1.5 text-navy-light/80">{c.nombre_en_excel} (fila {c.fila})</td>
                      <td className="px-3 py-1.5 text-right text-navy">{formatCRC(c.monto)}</td>
                      <td className="px-3 py-1.5 text-right text-navy-light/80">{c.deposito_actual == null ? '—' : formatCRC(c.deposito_actual)}</td>
                      <td className={cn('px-3 py-1.5', c.que === 'cambia' ? 'text-coral-deep' : 'text-navy-light/80')}>{QUE[c.que]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {vista.sin_sede.length > 0 && <p className="text-[13px] text-coral-deep font-body">Sin sede (no se tocan): {vista.sin_sede.map(f => `«${f.nombre}» (fila ${f.fila})`).join(', ')}.</p>}
            {vista.repetidas.length > 0 && <p className="text-[13px] text-coral-deep font-body">Aparecen dos veces (no se tocan): {vista.repetidas.join(', ')}.</p>}
          </div>
        )}
        {error && <p className="text-[13px] text-coral-deep font-body">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variante="fantasma" tamano="sm" onClick={onCerrar} disabled={busy}>Cancelar</Button>
          {!vista
            ? <Button type="button" variante="primario" tamano="sm" onClick={() => mandar(false)} disabled={busy || !file}>{busy ? 'Leyendo…' : 'Ver qué se carga'}</Button>
            : <Button type="button" variante="primario" tamano="sm" onClick={() => mandar(true)} disabled={busy || aplicables === 0}>{busy ? 'Aplicando…' : `Aplicar ${aplicables} depósito${aplicables === 1 ? '' : 's'}`}</Button>}
        </div>
      </div>
    </Modal>
  )
}

function DetalleDelMes({ a, finanzas, onCambio }: { a: Adelanto; finanzas: boolean; onCambio: () => void }) {
  const [nueva, setNueva] = useState(false)
  const [viendo, setViendo] = useState<FacturaFila | null>(null)
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
            <h2 className="text-lg font-bold text-navy font-display">{a.sede_name} · {a.tipo_nombre} · {nombreDelMes(a.mes)}</h2>
            {/* FIN-16 · Las dos líneas que pidió Andrés: así se ve por qué se depositó menos cuando sobró. */}
            <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-[13px] font-body w-fit">
              <dt className="text-navy-light/80">Saldo del mes anterior</dt>
              <dd className="text-right text-navy">{formatCRC(a.saldo_anterior)}{!a.arrastre_confirmado && <span className="text-navy-light/80"> (el mes anterior sigue abierto: se suma al cerrarlo)</span>}</dd>
              <dt className="text-navy-light/80">Depósito del mes</dt>
              <dd className="text-right text-navy">{formatCRC(a.deposito)}</dd>
              <dt className="font-semibold text-navy">Disponible</dt>
              <dd className="text-right font-semibold text-navy">{formatCRC(a.presupuesto)}</dd>
            </dl>
            <p className="mt-1 text-[13px] text-navy-light/80 font-body">
              Gastado {formatCRC(a.saldo.gastado)}{a.saldo.pendiente > 0 && <> · pendiente de liquidar {formatCRC(a.saldo.pendiente)}</>}
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
                  <button type="button" aria-label={`Ver detalle de la factura de ${ff.proveedor}`} onClick={() => setViendo(ff)} className="rounded-full p-1.5 text-navy-light/80 hover:text-coral-deep"><Eye size={14} aria-hidden="true" /></button>
                  {editable && <button type="button" aria-label={`Quitar factura de ${ff.proveedor}`} onClick={() => quitar(ff.id)} className="rounded-full p-1.5 text-navy-light/80 hover:text-coral-deep"><Trash2 size={14} aria-hidden="true" /></button>}
                </div>
              </div>
            ) })}
          </div>
        </section>
      ))}

      {viendo && <ModalDetalleFactura a={a} f={viendo} onCerrar={() => setViendo(null)} />}
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
          <div className="space-y-1"><label htmlFor="f-semana" className={etiqueta}>Semana (fecha de charla)</label><DatePicker id="f-semana" className={campo} value={f.semana} onChange={v => set('semana', v)} /></div>
          <div className="space-y-1"><label htmlFor="f-enc" className={etiqueta}>Encargado</label><input id="f-enc" className={campo} value={f.encargado ?? ''} onChange={e => set('encargado', e.target.value)} /></div>
          <div className="space-y-1"><label htmlFor="f-fecha" className={etiqueta}>Fecha de la factura</label><DatePicker id="f-fecha" className={campo} value={f.fecha} onChange={v => set('fecha', v)} /></div>
          <div className="space-y-1"><label htmlFor="f-monto" className={etiqueta}>Monto</label><input id="f-monto" type="number" min={0} step="any" className={campo} value={f.monto || ''} onChange={e => set('monto', Number(e.target.value))} /></div>
          <div className="space-y-1 col-span-2"><label htmlFor="f-prov" className={etiqueta}>Proveedor</label><input id="f-prov" className={campo} value={f.proveedor} onChange={e => set('proveedor', e.target.value)} /></div>
          <div className="space-y-1"><label htmlFor="f-num" className={etiqueta}>N° factura electrónica</label><input id="f-num" className={campo} value={f.numero_factura ?? ''} onChange={e => set('numero_factura', e.target.value)} /></div>
          <div className="space-y-1"><label htmlFor="f-estado" className={etiqueta}>Estado</label>
            <select id="f-estado" className={campo} value={f.estado} onChange={e => set('estado', e.target.value as Factura['estado'])}><option value="liquidada">Liquidada</option><option value="pendiente">Pendiente</option></select></div>
          <div className="space-y-1 col-span-2"><label htmlFor="f-obs" className={etiqueta}>Observaciones</label><input id="f-obs" className={campo} value={f.observaciones ?? ''} onChange={e => set('observaciones', e.target.value)} placeholder="comida, desechables…" /></div>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] text-navy-light hover:text-coral-deep font-body">
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

/** FIN-16 · «Ver detalle»: los datos de la factura y su foto, sin ir a buscarla al correo. */
function ModalDetalleFactura({ a, f, onCerrar }: { a: Adelanto; f: FacturaFila; onCerrar: () => void }) {
  const [foto, setFoto] = useState<{ url: string; es_pdf: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!f.receipt_path) return
    let vivo = true
    fetch(`/api/adelantos/${a.id}/receipts?factura_id=${f.id}`)
      .then(async r => { const d = await r.json().catch(() => null); if (!r.ok) throw new Error(d?.error || 'No se pudo abrir la foto.'); return d })
      .then(d => { if (vivo) setFoto(d) })
      .catch((e: Error) => { if (vivo) setError(e.message) })
    return () => { vivo = false }
  }, [a.id, f.id, f.receipt_path])
  const datos: [string, string][] = [
    ['Semana (charla)', formatDate(f.semana)], ['Encargado', f.encargado || '—'], ['Fecha de la factura', formatDate(f.fecha)],
    ['Proveedor', f.proveedor], ['N° factura', f.numero_factura || '—'], ['Monto', formatCRC(f.monto)],
    ['Estado', f.estado === 'pendiente' ? 'Pendiente' : 'Liquidada'], ['Observaciones', f.observaciones || '—'],
    ['Registrada por', f.registrado_por_name || '—'],
  ]
  return (
    <Modal onClose={onCerrar} titleId="detalle-factura-title" width={560}>
      <div className="p-5 space-y-3">
        <h2 id="detalle-factura-title" className="text-base font-bold text-navy font-display">Factura · {f.proveedor}</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[13px] font-body">
          {datos.map(([k, v]) => <div key={k} className="flex justify-between gap-3 sm:block"><dt className="text-navy-light/80">{k}</dt><dd className="text-navy">{v}</dd></div>)}
        </dl>
        {!f.receipt_path ? (
          <p className="rounded-xl bg-surface-low px-3 py-2 text-[13px] text-navy-light/80 font-body">Esta factura no tiene foto.</p>
        ) : error ? (
          <p className="text-[13px] text-coral-deep font-body">{error}</p>
        ) : !foto ? (
          <p className="text-[13px] text-navy-light/80 font-body">Cargando la foto…</p>
        ) : foto.es_pdf ? (
          <a href={foto.url} target="_blank" rel="noreferrer" className="text-[13px] text-coral-deep underline font-body">Abrir el PDF de la factura</a>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- URL firmada y temporal de Storage: next/image no aplica.
          <img src={foto.url} alt={`Foto de la factura de ${f.proveedor}`} className="max-h-[60vh] w-full rounded-xl object-contain bg-surface-low" />
        )}
        <div className="flex justify-end"><Button type="button" variante="fantasma" tamano="sm" onClick={onCerrar}>Cerrar</Button></div>
      </div>
    </Modal>
  )
}
