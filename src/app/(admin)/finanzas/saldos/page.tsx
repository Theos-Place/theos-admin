'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Wallet, Loader2, ChevronRight, Download, Search } from 'lucide-react'
import { BotonMostrarMontos } from '@/components/finance/BotonMostrarMontos'
import { AmountDisplay } from '@/components/finance/AmountDisplay'
import {
  BARRA, BARRA_IZQ, BARRA_DER, GRUPO_FILTRO, ETIQUETA_FILTRO, CAMPO, CAMPO_FECHA, BOTON_SECUNDARIO, BOTON_PRIMARIO,
  TARJETA, TARJETA_ETIQUETA, TARJETA_VALOR, VALOR_NEUTRO, VALOR_DINERO,
} from '@/components/finance/reporte-ui'
import { descargarExcel, enRango } from '@/lib/finance/descargar-excel'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/shared/Modal'
import { formatDate } from '@/lib/format'
import { AccessDenied } from '@/components/shared/AccessDenied'
import { EmptyState } from '@/components/shared/EmptyState'
import { useAuth } from '@/hooks/useAuth'
import { hasModulePermission } from '@/lib/auth/roles'
import { plata, type SaldoAFavor, type DetalleDelSaldo } from '@/lib/finance/saldo-a-favor'

const METODO: Record<string, string> = { sinpe: 'SINPE', cash: 'Efectivo', card: 'Tarjeta', comprobante: 'Comprobante', scholarship: 'Beca' }

/** El detalle de un saldo: los pagos, quién y cuándo se movió, y qué cubre el costo. */
function DetalleDeSaldo({ s, onClose }: { s: SaldoAFavor; onClose: () => void }) {
  const [d, setD] = useState<DetalleDelSaldo | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    fetch(`/api/finance/credits?enrollment_id=${s.enrollment_id}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('No se pudo cargar el detalle.'))))
      .then(x => { if (vivo) setD(x) })
      .catch(e => { if (vivo) setError(e.message) })
    return () => { vivo = false }
  }, [s.enrollment_id])
  const traslados = d?.pagos.filter(p => p.transfer_note) ?? []
  return (
    <Modal onClose={onClose} titleId="detalle-saldo-titulo" width={560}>
      <div className="p-6 space-y-5 font-body">
        <div>
          <h2 id="detalle-saldo-titulo" className="text-lg font-bold text-navy font-display">{s.member_name}</h2>
          <p className="text-[13px] text-navy-light/80">{s.group_name ?? '—'}</p>
        </div>

        {/* La cuenta, en una línea que se lee */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-surface-low p-3"><p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display">Pagó</p><p className="text-base font-bold text-navy font-display">{plata(s.pagado, s.currency)}</p></div>
          <div className="rounded-xl bg-surface-low p-3"><p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display">Cuesta</p><p className="text-base font-bold text-navy font-display">{plata(s.costo, s.currency)}</p></div>
          <div className="rounded-xl bg-teal-soft/30 p-3"><p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display">A favor</p><p className="text-base font-bold text-teal-deep font-display">{plata(s.saldo, s.currency)}</p></div>
        </div>

        {error && <p role="alert" className="text-[13px] text-coral-deep">{error}</p>}
        {!d && !error && <p className="flex items-center gap-2 text-[13px] text-navy-light/80"><Loader2 size={14} className="animate-spin" aria-hidden /> Cargando…</p>}

        {d && (
          <>
            {/* De dónde salió */}
            <section className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display">De dónde salió</p>
              {traslados.length > 0 ? (
                traslados.map(p => <p key={p.id} className="text-[13px] text-navy">{p.transfer_note}</p>)
              ) : (
                <p className="text-[13px] text-navy">
                  No hay un cambio de grupo registrado: lo pagado es más de lo que cuesta esta matrícula.
                  Revisá los pagos de abajo — puede ser un pago duplicado o un monto distinto al del plan.
                </p>
              )}
              <p className="text-[13px] text-navy-light/80">
                El costo es {plata(s.costo, s.currency)} porque esta matrícula cubre {d.cubre.length > 0 ? d.cubre.join(' + ') : 'su estudio'}
                {d.modalidad === 'bloques' ? ' (grupo en dos bloques: el N1 cubre también el N2)' : ''}.
              </p>
            </section>

            {/* Los pagos */}
            <section className="space-y-2">
              <p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display">Pagos de esta matrícula</p>
              {d.pagos.map(p => (
                <div key={p.id} className="rounded-xl border border-[var(--outline-variant)] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13px] font-medium text-navy">{plata(Number(p.amount), p.currency)} · {METODO[p.payment_method ?? ''] ?? p.payment_method ?? '—'}</p>
                    <p className="text-[13px] text-navy-light/80">{p.paid_at ? `Pagado el ${formatDate(p.paid_at)}` : `Registrado el ${formatDate(p.created_at)}`}</p>
                  </div>
                  {p.description && <p className="text-[13px] text-navy-light/80">{p.description}</p>}
                  {p.reference_code && <p className="text-[13px] text-navy-light/80">Referencia {p.reference_code}</p>}
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </Modal>
  )
}

/**
 * Quién tiene plata a favor.
 *
 * Aparece cuando a alguien se le mueve la matrícula a un estudio más barato o
 * gratis: su pago viaja con ella y lo que sobra queda a su nombre. Sin esta
 * pantalla esa plata existe pero no la ve nadie.
 *
 * El número no está guardado: es lo pagado menos lo que cuesta la matrícula,
 * calculado en el momento. Por eso no puede quedar desactualizado.
 */
export default function SaldosAFavorPage() {
  const { user, loaded } = useAuth()
  const puede = hasModulePermission(user?.roles ?? [], 'finanzas', 'view')

  const [items, setItems] = useState<SaldoAFavor[]>([])
  const [totales, setTotales] = useState<Array<{ currency: string; total: number }>>([])
  const [revisadas, setRevisadas] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [detalle, setDetalle] = useState<SaldoAFavor | null>(null)
  const [revealAll, setRevealAll] = useState(false)
  // El rango es por la fecha en que se GENERÓ el saldo (ver llegadaDelPago).
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  useEffect(() => {
    // Sin permiso la pantalla ya devuelve AccessDenied, así que el estado
    // de carga no se llega a mirar: no hace falta tocarlo acá.
    if (!puede) return
    let vivo = true
    fetch('/api/finance/credits')
      .then(r => r.ok ? r.json() : Promise.reject(new Error('No se pudieron cargar los saldos.')))
      .then(d => {
        if (!vivo) return
        setItems(d.items ?? []); setTotales(d.totales ?? []); setRevisadas(d.matriculas_revisadas ?? 0)
      })
      .catch(e => vivo && setError(e.message))
      .finally(() => vivo && setCargando(false))
    return () => { vivo = false }
  }, [puede])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return items.filter(i => enRango(i.generado_en, desde, hasta)
      && (!q || i.member_name.toLowerCase().includes(q) || (i.group_name ?? '').toLowerCase().includes(q)))
  }, [items, busqueda, desde, hasta])

  if (!loaded) return null
  if (!puede) return <AccessDenied />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-navy font-display">Saldos a favor</h1>
        <p className="text-sm text-navy-light/80 font-body mt-1">
          Plata que la persona ya pagó y que su matrícula actual no consume. Pasa cuando se
          le mueve la matrícula a un estudio más barato o gratis: el pago viaja con ella.
        </p>
      </div>

      {/* Orden de los reportes de finanzas (pedido 2026-10-19): acciones
          arriba, totales, y la búsqueda debajo. */}
      <div className={BARRA}>
        <div className={BARRA_IZQ}>
          <label htmlFor="saldo-desde" className={GRUPO_FILTRO}>
            <span className={ETIQUETA_FILTRO}>Generado desde</span>
            <input id="saldo-desde" type="date" value={desde} max={hasta || undefined} onChange={e => setDesde(e.target.value)} className={CAMPO_FECHA} />
          </label>
          <label htmlFor="saldo-hasta" className={GRUPO_FILTRO}>
            <span className={ETIQUETA_FILTRO}>Hasta</span>
            <input id="saldo-hasta" type="date" value={hasta} min={desde || undefined} onChange={e => setHasta(e.target.value)} className={CAMPO_FECHA} />
          </label>
          {(desde || hasta) && (
            <button type="button" onClick={() => { setDesde(''); setHasta('') }} className={BOTON_SECUNDARIO}>Limpiar</button>
          )}
        </div>
        <div className={BARRA_DER}>
          <BotonMostrarMontos visibles={revealAll} onCambio={() => setRevealAll(r => !r)} />
          <button type="button" disabled={filtrados.length === 0} className={BOTON_PRIMARIO}
            onClick={() => void descargarExcel('saldos-a-favor', ['Persona', 'Su estudio actual', 'Pagó', 'Cuesta', 'A favor', 'Moneda', 'Generado'],
              filtrados.map(s => [s.member_name, s.group_name ?? '', s.pagado, s.costo, s.saldo, s.currency ?? 'CRC', s.generado_en ? formatDate(s.generado_en) : '']))}>
            <Download size={14} aria-hidden /> Descargar Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={TARJETA}>
          <p className={TARJETA_ETIQUETA}>Total a favor</p>
          <div className={cn(TARJETA_VALOR, VALOR_DINERO)}>
            {totales.length === 0
              ? <AmountDisplay amount={0} defaultHidden={false} revealed={revealAll} />
              : totales.map(t => <p key={t.currency}><AmountDisplay amount={t.total} currency={t.currency} defaultHidden={false} revealed={revealAll} /></p>)}
          </div>
        </div>
        <div className={TARJETA}>
          <p className={TARJETA_ETIQUETA}>Personas con saldo</p>
          <p className={cn(TARJETA_VALOR, VALOR_NEUTRO)}>{items.length.toLocaleString('es-CR')}</p>
        </div>
      </div>

      {cargando ? (
        <div className="flex items-center gap-2 py-12 justify-center text-navy-light/80">
          <Loader2 size={16} className="animate-spin" aria-hidden />
          <span className="text-sm font-body">Calculando…</span>
        </div>
      ) : error ? (
        <p className="text-sm text-coral-deep font-body" role="alert">{error}</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nadie tiene saldo a favor"
          description={`Se revisaron ${revisadas.toLocaleString('es-CR')} matrículas activas y en todas lo pagado calza con lo que cuesta el estudio.`}
        />
      ) : (
        <>
          <div className={cn('focus-within:ring-1 focus-within:ring-coral/30 flex items-center gap-2', CAMPO)}>
            <Search size={14} className="text-navy-light/80 shrink-0" aria-hidden="true" />
            <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por persona o grupo…" aria-label="Buscar en los saldos a favor"
              className="flex-1 bg-transparent text-[13px] outline-none font-body text-navy" />
          </div>
          <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] overflow-hidden overflow-x-auto">
            <table className="w-full border-collapse text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-[var(--outline-variant)]">
                  {['Persona', 'Su estudio actual', 'Pagó', 'Cuesta', 'A favor', 'Generado', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] tracking-widest uppercase text-navy-light/80 whitespace-nowrap font-display">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map(s => (
                  <tr key={s.enrollment_id} className="border-b border-[var(--outline-variant)] hover:bg-surface-low transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/miembros/${s.member_id}`} className="text-[13px] text-navy hover:underline font-body">
                        {s.member_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-navy-light/80 font-body">{s.group_name ?? '—'}</td>
                    <td className="px-4 py-3 text-[13px] text-navy-light/80 font-body"><AmountDisplay amount={s.pagado} currency={s.currency ?? 'CRC'} defaultHidden={false} revealed={revealAll} /></td>
                    <td className="px-4 py-3 text-[13px] text-navy-light/80 font-body"><AmountDisplay amount={s.costo} currency={s.currency ?? 'CRC'} defaultHidden={false} revealed={revealAll} /></td>
                    <td className="px-4 py-3 text-[13px] font-bold text-teal-deep font-body"><AmountDisplay amount={s.saldo} currency={s.currency ?? 'CRC'} defaultHidden={false} revealed={revealAll} /></td>
                    <td className="px-4 py-3 text-[13px] text-navy-light/80 font-body whitespace-nowrap">{s.generado_en ? formatDate(s.generado_en) : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => setDetalle(s)}
                        className="inline-flex items-center gap-1 rounded-full border border-navy/15 px-3 py-1 text-[13px] text-navy hover:bg-surface-low font-body">
                        Ver detalle <ChevronRight size={13} aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-6 text-[13px] text-navy-light/80 font-body">Nadie con esos filtros.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      {detalle && <DetalleDeSaldo s={detalle} onClose={() => setDetalle(null)} />}
    </div>
  )
}
