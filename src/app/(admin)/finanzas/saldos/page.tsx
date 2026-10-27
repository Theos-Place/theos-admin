'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Wallet, Loader2, ChevronRight, Download, Search, ExternalLink } from 'lucide-react'
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
import {
  unificarSaldos, totalVigentePorMoneda, personasConSaldo, coincide, ETIQUETA_TIPO, ETIQUETA_ESTADO_DE_SALDO,
  type FilaDeSaldo, type CreditoEnLista,
} from '@/lib/finance/saldos-unificados'
import { ymdCR } from '@/lib/format'

import { DatePicker } from '@/components/events/DatePicker'
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
 * FIN-9 · El detalle de un crédito por matrícula congelada: de qué pago
 * salió, por qué, hasta cuándo y en qué estado está.
 */
function DetalleDeCredito({ c, hoy, onClose, revealAll }: { c: CreditoEnLista; hoy: string; onClose: () => void; revealAll: boolean }) {
  const [fila] = unificarSaldos([], [c], hoy)
  return (
    <Modal onClose={onClose} titleId="detalle-credito-titulo" width={560}>
      <div className="p-6 space-y-5 font-body">
        <div>
          <h2 id="detalle-credito-titulo" className="text-lg font-bold text-navy font-display">{c.member_name}</h2>
          <p className="text-[13px] text-navy-light/80">Matrícula congelada{c.origen ? ` · ${c.origen}` : ''}</p>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-teal-soft/30 p-3"><p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display">A favor</p><p className="text-base font-bold text-teal-deep font-display"><AmountDisplay amount={c.monto} currency={c.currency} defaultHidden={false} revealed={revealAll} /></p></div>
          <div className="rounded-xl bg-surface-low p-3"><p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display">Estado</p><p className="text-base font-bold text-navy font-display">{ETIQUETA_ESTADO_DE_SALDO[fila.estado]}</p></div>
          <div className="rounded-xl bg-surface-low p-3"><p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display">Vence</p><p className="text-base font-bold text-navy font-display">{c.vence ? formatDate(c.vence) : '—'}</p></div>
        </div>

        <section className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display">De dónde salió</p>
          <p className="text-[13px] text-navy">
            Se congeló la matrícula{c.origen ? ` de ${c.origen}` : ''} el {formatDate(c.created_at)} y lo pagado quedó guardado a su nombre.
            Se aplica solo cuando vuelva a matricularse o pague una actividad grande; si llega al vencimiento sin usarse, se corre al bloque siguiente.
          </p>
          {c.motivo && <p className="text-[13px] text-navy-light/80">Motivo: {c.motivo}</p>}
        </section>

        <section className="space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display">El pago de origen</p>
          {c.origin_payment_id ? (
            <Link href={`/finanzas/pagos/${c.origin_payment_id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--outline-variant)] px-4 py-3 hover:bg-surface-low">
              <span className="text-[13px] font-medium text-navy">{c.pago_descripcion ?? c.origen ?? 'Ver pago'}</span>
              <span className="inline-flex items-center gap-1 text-[13px] text-navy-light/80">Abrir <ExternalLink size={13} aria-hidden /></span>
            </Link>
          ) : <p className="text-[13px] text-navy-light/80">Sin pago de origen registrado.</p>}
        </section>

        <Link href={`/miembros/${c.member_id}?open=pagos`} className="inline-flex items-center gap-1 text-[13px] text-navy hover:underline">
          Ver pagos y cobros de la persona <ChevronRight size={13} aria-hidden />
        </Link>
      </div>
    </Modal>
  )
}

/**
 * A quién le debemos plata, en UNA lista (Floriana, 2026-10-27).
 *
 * Dos fuentes con una columna que dice cuál es:
 *  · SOBRANTE DE MATRÍCULA: se le movió la matrícula a un estudio más barato
 *    o gratis y su pago viajó con ella. No está guardado: es lo pagado menos
 *    lo que cuesta, calculado en el momento, y por eso no se desactualiza.
 *  · MATRÍCULA CONGELADA (FIN-9): plata que pagó por un estudio que no llevó
 *    y se le guardó como crédito. Tiene estado y vencimiento; si llega sin
 *    usarse, se corre al bloque siguiente.
 */
export default function SaldosAFavorPage() {
  const { user, loaded } = useAuth()
  const puede = hasModulePermission(user?.roles ?? [], 'finanzas', 'view')

  const [sobrantes, setSobrantes] = useState<SaldoAFavor[]>([])
  const [creditos, setCreditos] = useState<CreditoEnLista[]>([])
  const [revisadas, setRevisadas] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [detalle, setDetalle] = useState<FilaDeSaldo | null>(null)
  const [revealAll, setRevealAll] = useState(false)
  // El rango es por la fecha en que se GENERÓ el saldo (ver llegadaDelPago)
  // o se emitió el crédito.
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const hoy = ymdCR()

  useEffect(() => {
    // Sin permiso la pantalla ya devuelve AccessDenied, así que el estado
    // de carga no se llega a mirar: no hace falta tocarlo acá.
    if (!puede) return
    let vivo = true
    Promise.all([
      fetch('/api/finance/credits').then(r => r.ok ? r.json() : Promise.reject(new Error('No se pudieron cargar los saldos.'))),
      fetch('/api/finance/creditos').then(r => r.ok ? r.json() : Promise.reject(new Error('No se pudieron cargar los créditos.'))),
    ])
      .then(([s, c]) => {
        if (!vivo) return
        setSobrantes(s.items ?? []); setRevisadas(s.matriculas_revisadas ?? 0); setCreditos(c.items ?? [])
      })
      .catch(e => vivo && setError(e.message))
      .finally(() => vivo && setCargando(false))
    return () => { vivo = false }
  }, [puede])

  const filas = useMemo(() => unificarSaldos(sobrantes, creditos, hoy), [sobrantes, creditos, hoy])
  const totales = useMemo(() => totalVigentePorMoneda(filas), [filas])
  const personas = useMemo(() => personasConSaldo(filas), [filas])
  const filtrados = useMemo(
    () => filas.filter(f => enRango(f.generado_en, desde, hasta) && coincide(f, busqueda)),
    [filas, busqueda, desde, hasta],
  )

  if (!loaded) return null
  if (!puede) return <AccessDenied />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-navy font-display">Saldos a favor</h1>
        <p className="text-sm text-navy-light/80 font-body mt-1">
          Plata que la persona ya pagó y que Theos le debe: lo que sobró al moverla a un estudio
          más barato, o lo que se le guardó al congelarle una matrícula. Hacé clic en una fila para ver de dónde salió.
        </p>
      </div>

      {/* Orden de los reportes de finanzas (pedido 2026-10-19): acciones
          arriba, totales, y la búsqueda debajo. */}
      <div className={BARRA}>
        <div className={BARRA_IZQ}>
          <label htmlFor="saldo-desde" className={GRUPO_FILTRO}>
            <span className={ETIQUETA_FILTRO}>Generado desde</span>
            <DatePicker id="saldo-desde" value={desde} max={hasta || undefined} onChange={v => setDesde(v)} className={CAMPO_FECHA} />
          </label>
          <label htmlFor="saldo-hasta" className={GRUPO_FILTRO}>
            <span className={ETIQUETA_FILTRO}>Hasta</span>
            <DatePicker id="saldo-hasta" value={hasta} min={desde || undefined} onChange={v => setHasta(v)} className={CAMPO_FECHA} />
          </label>
          {(desde || hasta) && (
            <button type="button" onClick={() => { setDesde(''); setHasta('') }} className={BOTON_SECUNDARIO}>Limpiar</button>
          )}
        </div>
        <div className={BARRA_DER}>
          <BotonMostrarMontos visibles={revealAll} onCambio={() => setRevealAll(r => !r)} />
          <button type="button" disabled={filtrados.length === 0} className={BOTON_PRIMARIO}
            onClick={() => void descargarExcel('saldos-a-favor', ['Persona', 'Tipo', 'Origen', 'A favor', 'Moneda', 'Estado', 'Generado', 'Vence'],
              filtrados.map(f => [f.member_name, ETIQUETA_TIPO[f.tipo], f.origen ?? '', f.monto, f.currency, ETIQUETA_ESTADO_DE_SALDO[f.estado],
                f.generado_en ? formatDate(f.generado_en) : '', f.vence ? formatDate(f.vence) : '']))}>
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
          <p className={cn(TARJETA_VALOR, VALOR_NEUTRO)}>{personas.toLocaleString('es-CR')}</p>
        </div>
      </div>

      {cargando ? (
        <div className="flex items-center gap-2 py-12 justify-center text-navy-light/80">
          <Loader2 size={16} className="animate-spin" aria-hidden />
          <span className="text-sm font-body">Calculando…</span>
        </div>
      ) : error ? (
        <p className="text-sm text-coral-deep font-body" role="alert">{error}</p>
      ) : filas.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nadie tiene saldo a favor"
          description={`Se revisaron ${revisadas.toLocaleString('es-CR')} matrículas activas y en todas lo pagado calza con lo que cuesta el estudio, y no hay créditos por congelamiento.`}
        />
      ) : (
        <div id="creditos" className="space-y-4 scroll-mt-24">
          <div className={cn('focus-within:ring-1 focus-within:ring-coral/30 flex items-center gap-2', CAMPO)}>
            <Search size={14} className="text-navy-light/80 shrink-0" aria-hidden="true" />
            <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por persona, estudio o tipo…" aria-label="Buscar en los saldos a favor"
              className="flex-1 bg-transparent text-[13px] outline-none font-body text-navy" />
          </div>
          <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] overflow-hidden overflow-x-auto">
            <table className="w-full border-collapse text-sm min-w-[760px]">
              <thead>
                <tr className="border-b border-[var(--outline-variant)]">
                  {['Persona', 'Tipo', 'Origen', 'A favor', 'Estado', 'Generado', 'Vence', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] tracking-widest uppercase text-navy-light/80 whitespace-nowrap font-display">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map(f => (
                  <tr key={f.key} onClick={() => setDetalle(f)}
                    className="border-b border-[var(--outline-variant)] hover:bg-surface-low transition-colors cursor-pointer">
                    <td className="px-4 py-3">
                      <Link href={`/miembros/${f.member_id}${f.tipo === 'congelado' ? '?open=pagos' : ''}`} onClick={e => e.stopPropagation()}
                        className="text-[13px] text-navy hover:underline font-body">
                        {f.member_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold font-display whitespace-nowrap',
                        f.tipo === 'congelado' ? 'bg-teal-soft/30 text-teal-ink' : 'bg-navy/5 text-navy')}>
                        {ETIQUETA_TIPO[f.tipo]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-navy-light/80 font-body">{f.origen ?? '—'}</td>
                    <td className={cn('px-4 py-3 text-[13px] font-bold font-body', f.estado === 'vigente' ? 'text-teal-deep' : 'text-navy-light/80 line-through')}>
                      <AmountDisplay amount={f.monto} currency={f.currency} defaultHidden={false} revealed={revealAll} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold font-display', f.estado === 'vigente' ? 'bg-teal-soft/30 text-teal-ink' : 'bg-navy/5 text-navy-light/80')}>
                        {ETIQUETA_ESTADO_DE_SALDO[f.estado]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-navy-light/80 font-body whitespace-nowrap">{f.generado_en ? formatDate(f.generado_en) : '—'}</td>
                    <td className="px-4 py-3 text-[13px] text-navy-light/80 font-body whitespace-nowrap">{f.vence ? formatDate(f.vence) : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={e => { e.stopPropagation(); setDetalle(f) }}
                        className="inline-flex items-center gap-1 rounded-full border border-navy/15 px-3 py-1 text-[13px] text-navy hover:bg-surface-low font-body whitespace-nowrap">
                        Ver detalle <ChevronRight size={13} aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-6 text-[13px] text-navy-light/80 font-body">Nadie con esos filtros.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {detalle?.fuente.tipo === 'sobrante' && <DetalleDeSaldo s={detalle.fuente.saldo} onClose={() => setDetalle(null)} />}
      {detalle?.fuente.tipo === 'congelado' && <DetalleDeCredito c={detalle.fuente.credito} hoy={hoy} revealAll={revealAll} onClose={() => setDetalle(null)} />}
    </div>
  )
}
