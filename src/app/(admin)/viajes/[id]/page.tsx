'use client'

/**
 * FIN-11 · El expediente abierto.
 *
 * Una pantalla para los tres actores, y no tres pantallas: el solicitante ve
 * su papel y el botón de enviar; finanzas ve además la validación financiera;
 * la autoridad ve el botón de aprobar. Lo que puede hacer cada uno NO se
 * decide acá — sale de `puedeMover`, el mismo módulo que usa el servidor, así
 * que la pantalla no puede ofrecer un paso que el servidor vaya a negar.
 */
import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Pencil } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/shared/Button'
import { Modal } from '@/components/shared/Modal'
import { useToast } from '@/components/shared/Toast'
import { useAuth } from '@/lib/auth/auth-context'
import { formatDate, formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  actoresDe, puedeMover, esEditable, PASOS,
  type EstadoDeViaje, type Actor,
} from '@/lib/travel/estados-del-viaje'
import { NOMBRE_DEL_RUBRO, subtotal, type TotalPorMoneda, type LineaDePresupuesto } from '@/lib/travel/presupuesto'
import { BADGE_DE_ESTADO } from '@/components/travel/badge'
import { FormularioDeViaje, type ValoresDelViaje } from '@/components/travel/FormularioDeViaje'
import { Liquidacion } from '@/components/travel/Liquidacion'
import { seLiquida } from '@/lib/travel/estados-del-viaje'
import type { GastoEjecutado, SaldoDeLiquidacion } from '@/lib/travel/liquidacion'

type Viaje = {
  id: string; member_id: string; member_name: string; status: EstadoDeViaje
  tipo: 'trabajo' | 'capacitacion'; alcance: 'nacional' | 'internacional'
  destino: string; sale_at: string; vuelve_at: string; acompanantes: string | null
  objetivo: string; agenda: string | null; beneficio: string | null; resultado_esperado: string | null
  financiamiento: string | null; centro_costo: string | null
  anticipo_monto: number | null; anticipo_moneda: 'CRC' | 'USD' | null
  monto_maximo_politica: number | null; anticipo_recomendado: number | null
  disponibilidad_verificada: boolean; notas_finanzas: string | null
  revisado_por_name: string | null; revisado_at: string | null
  aprobado_por_name: string | null; aprobado_at: string | null
  motivo_rechazo: string | null; created_at: string
  anticipo_recibido_monto: number | null; anticipo_recibido_moneda: 'CRC' | 'USD' | null
  anticipo_entregado_at: string | null; declaracion_jurada_at: string | null
  liquidacion_enviada_at: string | null; notas_liquidacion: string | null
  gastos: Array<GastoEjecutado & { id: string; sin_comprobante_motivo: string | null; orden: number }>
  saldos: SaldoDeLiquidacion[]
  gastos_con_fecha_rara: number[]
  lineas: Array<LineaDePresupuesto & { id: string; orden: number }>
  totales: TotalPorMoneda[]
  history: Array<{ from_status: string | null; to_status: string; notes: string | null; changed_by_name: string | null; created_at: string }>
}

/**
 * Cómo se llama cada paso en un botón.
 *
 * DEPENDE DEL ORIGEN Y NO SOLO DEL DESTINO, y esto se descubrió viéndolo: a
 * `liquidacion_pendiente` se llega por dos caminos opuestos —quien viajó
 * diciendo «ya volví», o finanzas devolviendo una liquidación mal armada— y
 * con una tabla por destino, a finanzas le salía un botón que decía «Ya volví
 * del viaje» sobre el expediente de otra persona.
 */
function nombreDelPaso(de: EstadoDeViaje, a: EstadoDeViaje): string {
  if (a === 'liquidacion_pendiente') {
    return de === 'liquidada' ? 'Devolver la liquidación' : 'Ya volví del viaje'
  }
  const porDestino: Partial<Record<EstadoDeViaje, string>> = {
    enviada: de === 'por_corregir' ? 'Volver a enviar' : 'Enviar a revisión',
    en_revision: 'Tomar para revisar',
    por_corregir: 'Devolver para corregir',
    aprobada: 'Aprobar',
    rechazada: 'Rechazar',
    cancelada: 'Cancelar el viaje',
    anticipo_entregado: 'Marcar anticipo entregado',
    cerrada: 'Cerrar el expediente',
  }
  return porDestino[a] ?? a
}

const etiqueta = 'text-[11px] tracking-widest uppercase text-navy-light/80 font-display'

export default function ViajePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { user } = useAuth()
  const toast = useToast()
  const [v, setV] = useState<Viaje | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [paso, setPaso] = useState<EstadoDeViaje | null>(null)
  const [dandoAnticipo, setDandoAnticipo] = useState(false)

  const cargar = () => {
    fetch(`/api/travel-requests/${id}`)
      .then(async r => {
        const d = await r.json().catch(() => null)
        if (!r.ok) throw new Error(d?.error || 'No se pudo cargar el viaje.')
        return d
      })
      .then(setV)
      .catch((e: Error) => setError(e.message))
  }
  useEffect(cargar, [id])

  if (error) return <p className="page text-[13px] text-coral-deep font-body">{error}</p>
  if (!v) return <p className="page text-[13px] text-navy-light/80 font-body">Cargando…</p>

  const esDueno = user?.member_id === v.member_id
  const actores: Actor[] = actoresDe(user?.roles ?? [], esDueno)
  const badge = BADGE_DE_ESTADO[v.status]

  // Los pasos que ESTE actor puede dar desde ESTE estado. Sale de la misma
  // tabla que valida el servidor.
  const pasosPosibles = actores.length > 0
    ? PASOS.filter(p => p.de === v.status && actores.includes(p.quien)).map(p => p.a)
      // Estos dos no pasan por el modal genérico: `liquidada` se llega
      // firmando la declaración jurada, y `anticipo_entregado` necesita que
      // finanzas diga CUÁNTO entregó. El servidor los rechaza por esa puerta
      // también; acá solo se evita ofrecer lo que no se puede.
      .filter(a => a !== 'liquidada')
    : []

  if (editando) {
    const inicial: ValoresDelViaje = {
      tipo: v.tipo, alcance: v.alcance, destino: v.destino,
      sale_at: v.sale_at.slice(0, 16), vuelve_at: v.vuelve_at.slice(0, 16),
      acompanantes: v.acompanantes ?? '', objetivo: v.objetivo,
      agenda: v.agenda ?? '', beneficio: v.beneficio ?? '',
      resultado_esperado: v.resultado_esperado ?? '',
      financiamiento: v.financiamiento ?? '', centro_costo: v.centro_costo ?? '',
      anticipo_monto: v.anticipo_monto ? String(v.anticipo_monto) : '',
      anticipo_moneda: v.anticipo_moneda ?? 'CRC',
      lineas: v.lineas.map(l => ({ rubro: l.rubro, descripcion: l.descripcion, cantidad: l.cantidad, tarifa: l.tarifa, moneda: l.moneda })),
    }
    return (
      <PageContainer width="form" className="page space-y-4">
        <button type="button" onClick={() => setEditando(false)}
          className="inline-flex items-center gap-1.5 text-[13px] text-navy-light/80 hover:text-coral transition-colors font-body">
          <ArrowLeft size={14} aria-hidden="true" /> Volver al expediente
        </button>
        <h1 className="text-xl font-bold text-navy font-display">Editar el viaje</h1>
        <FormularioDeViaje inicial={inicial} viajeId={v.id} onListo={() => { setEditando(false); cargar() }} />
      </PageContainer>
    )
  }

  return (
    <PageContainer width="form" className="page space-y-4">
      <Link href="/viajes" className="inline-flex items-center gap-1.5 text-[13px] text-navy-light/80 hover:text-coral transition-colors font-body">
        <ArrowLeft size={14} aria-hidden="true" /> Volver a viajes
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-navy font-display">{v.destino}</h1>
            <span className={cn('rounded-full px-2.5 py-0.5 text-[13px] font-semibold font-display', badge.cls)}>{badge.label}</span>
          </div>
          <p className="text-[13px] text-navy-light/80 font-body">
            {v.member_name} · {formatDate(v.sale_at)} → {formatDate(v.vuelve_at)} ·{' '}
            {v.tipo === 'trabajo' ? 'Trabajo' : 'Capacitación'}, {v.alcance}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {esDueno && esEditable(v.status) && (
            <Button type="button" variante="secundario" tamano="sm" onClick={() => setEditando(true)}>
              <Pencil size={14} aria-hidden="true" /> Editar
            </Button>
          )}
          {pasosPosibles.filter(a => a === 'anticipo_entregado').map(a => (
            <Button key={a} type="button" tamano="sm" variante="secundario"
              onClick={() => setDandoAnticipo(true)}>
              {nombreDelPaso(v.status, a)}
            </Button>
          ))}
          {pasosPosibles.filter(a => a !== 'anticipo_entregado').map(a => (
            <Button key={a} type="button" tamano="sm"
              variante={a === 'aprobada' ? 'primario' : a === 'rechazada' || a === 'cancelada' ? 'fantasma' : 'secundario'}
              onClick={() => setPaso(a)}>
              {nombreDelPaso(v.status, a)}
            </Button>
          ))}
        </div>
      </div>

      {v.motivo_rechazo && (
        <p className="rounded-2xl bg-coral/10 px-4 py-3 text-[13px] text-coral-deep font-body">
          <strong>Motivo:</strong> {v.motivo_rechazo}
        </p>
      )}

      <section className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] space-y-3">
        <h2 className="text-[13px] font-bold text-navy font-display">La justificación</h2>
        {([['Objetivo', v.objetivo], ['Agenda', v.agenda], ['Beneficio', v.beneficio],
          ['Resultado esperado', v.resultado_esperado], ['Acompañantes', v.acompanantes]] as const)
          .filter(([, texto]) => !!texto)
          .map(([label, texto]) => (
            <div key={label}>
              <p className={etiqueta}>{label}</p>
              <p className="text-[13px] text-navy font-body whitespace-pre-wrap">{texto}</p>
            </div>
          ))}
      </section>

      <section className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] space-y-3">
        <h2 className="text-[13px] font-bold text-navy font-display">Presupuesto</h2>
        {v.lineas.length === 0 ? (
          <p className="text-[13px] text-navy-light/80 font-body">Sin rubros.</p>
        ) : (
          <div className="divide-y divide-[var(--outline-variant)]">
            {v.lineas.map(l => (
              <div key={l.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-[13px] text-navy font-body">{NOMBRE_DEL_RUBRO[l.rubro]}</p>
                  <p className="text-[13px] text-navy-light/80 font-body truncate">
                    {l.descripcion ? `${l.descripcion} · ` : ''}{l.cantidad} × {formatMoney(l.tarifa, l.moneda)}
                  </p>
                </div>
                <span className="text-[13px] font-semibold text-navy font-display shrink-0">
                  {formatMoney(subtotal(l), l.moneda)}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-4 border-t border-[var(--outline-variant)] pt-3">
          {v.totales.map(t => (
            <div key={t.moneda}>
              <p className={etiqueta}>Total {t.moneda}</p>
              <p className="text-base font-bold text-navy font-display">{formatMoney(t.total, t.moneda)}</p>
            </div>
          ))}
          {v.anticipo_monto != null && v.anticipo_moneda && (
            <div>
              <p className={etiqueta}>Anticipo pedido</p>
              <p className="text-base font-bold text-navy font-display">{formatMoney(v.anticipo_monto, v.anticipo_moneda)}</p>
            </div>
          )}
        </div>
        {(v.financiamiento || v.centro_costo) && (
          <p className="text-[13px] text-navy-light/80 font-body">
            {v.financiamiento && <>Financiamiento: {v.financiamiento}. </>}
            {v.centro_costo && <>Centro de costo: {v.centro_costo}.</>}
          </p>
        )}
      </section>

      {(actores.includes('revision') || actores.includes('autoridad')) && (
        <RevisionFinanciera viaje={v} onListo={cargar} />
      )}

      {/* La liquidación aparece cuando el viaje ya pasó de aprobado. Antes
          no: cargar facturas de un viaje que todavía no se aprueba es
          invitar a gastar primero y pedir permiso después. */}
      {(['anticipo_entregado', 'liquidacion_pendiente', 'liquidada', 'cerrada'] as EstadoDeViaje[]).includes(v.status) && (
        <Liquidacion
          viajeId={v.id}
          editable={esDueno && seLiquida(v.status)}
          gastosIniciales={v.gastos}
          anticipo={v.anticipo_recibido_monto != null && v.anticipo_recibido_moneda
            ? { monto: v.anticipo_recibido_monto, moneda: v.anticipo_recibido_moneda } : null}
          fechasRaras={v.gastos_con_fecha_rara}
          onCambio={cargar}
        />
      )}

      <section className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] space-y-2">
        <h2 className="text-[13px] font-bold text-navy font-display">Las firmas</h2>
        <p className="text-[13px] text-navy-light/80 font-body">
          Revisión financiera: {v.revisado_por_name ? `${v.revisado_por_name} · ${formatDate(v.revisado_at!)}` : 'pendiente'}
        </p>
        <p className="text-[13px] text-navy-light/80 font-body">
          Aprobación: {v.aprobado_por_name ? `${v.aprobado_por_name} · ${formatDate(v.aprobado_at!)}` : 'pendiente'}
        </p>
        {v.declaracion_jurada_at && (
          <p className="text-[13px] text-navy-light/80 font-body">
            Declaración jurada firmada: {formatDate(v.declaracion_jurada_at)}
          </p>
        )}
        {v.history.length > 0 && (
          <ul className="space-y-1 border-t border-[var(--outline-variant)] pt-2">
            {v.history.map((h, i) => (
              <li key={i} className="text-[13px] text-navy-light/80 font-body">
                {formatDate(h.created_at)} · {BADGE_DE_ESTADO[h.to_status as EstadoDeViaje]?.label ?? h.to_status}
                {h.changed_by_name ? ` · ${h.changed_by_name}` : ''}
                {h.notes ? ` — ${h.notes}` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>

      {dandoAnticipo && (
        <ModalDeAnticipo
          viajeId={v.id}
          sugerido={v.anticipo_recomendado ?? v.anticipo_monto}
          moneda={v.anticipo_moneda ?? 'CRC'}
          onCerrar={() => setDandoAnticipo(false)}
          onListo={() => { setDandoAnticipo(false); toast('Anticipo registrado.', 'success'); cargar() }}
        />
      )}

      {paso && actores.length > 0 && (
        <ModalDePaso
          viajeId={v.id} de={v.status} a={paso} actores={actores}
          onCerrar={() => setPaso(null)}
          onListo={() => {
            setPaso(null)
            toast('Listo.', 'success')
            if (paso === 'cancelada') router.push('/viajes'); else cargar()
          }}
        />
      )}
    </PageContainer>
  )
}

/** ANX-02 · lo que llena finanzas. Solo lo ve quien revisa o aprueba. */
function RevisionFinanciera({ viaje, onListo }: { viaje: Viaje; onListo: () => void }) {
  const [maximo, setMaximo] = useState(viaje.monto_maximo_politica?.toString() ?? '')
  const [recomendado, setRecomendado] = useState(viaje.anticipo_recomendado?.toString() ?? '')
  const [verificada, setVerificada] = useState(viaje.disponibilidad_verificada)
  const [notas, setNotas] = useState(viaje.notas_finanzas ?? '')
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const campo = 'w-full rounded-xl border border-navy/15 px-3 py-2 text-[13px] text-navy font-body focus:border-coral focus:outline-none focus:ring-1 focus:ring-coral'

  async function guardar() {
    setBusy(true)
    try {
      const res = await fetch(`/api/travel-requests/${viaje.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'revision_financiera',
          monto_maximo_politica: maximo === '' ? null : Number(maximo),
          anticipo_recomendado: recomendado === '' ? null : Number(recomendado),
          disponibilidad_verificada: verificada,
          notas_finanzas: notas.trim() || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'No se pudo guardar.')
      toast('Validación financiera guardada.', 'success')
      onListo()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar.', 'error')
    } finally { setBusy(false) }
  }

  return (
    <section className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] space-y-4">
      <div>
        <h2 className="text-[13px] font-bold text-navy font-display">Validación financiera</h2>
        <p className="text-[13px] text-navy-light/80 font-body">Lo llena finanzas; el solicitante no lo ve.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="f-max" className={etiqueta}>Monto máximo según política</label>
          <input id="f-max" type="number" min={0} step="any" className={campo} value={maximo} onChange={e => setMaximo(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="f-rec" className={etiqueta}>Anticipo recomendado</label>
          <input id="f-rec" type="number" min={0} step="any" className={campo} value={recomendado} onChange={e => setRecomendado(e.target.value)} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-[13px] text-navy font-body">
        <input type="checkbox" className="h-4 w-4 accent-coral" checked={verificada} onChange={e => setVerificada(e.target.checked)} />
        Disponibilidad presupuestaria verificada
      </label>
      <div className="space-y-1.5">
        <label htmlFor="f-notas" className={etiqueta}>Notas de finanzas</label>
        <textarea id="f-notas" rows={2} className={campo} value={notas} onChange={e => setNotas(e.target.value)} />
      </div>
      <div className="flex justify-end">
        <Button type="button" variante="secundario" tamano="sm" onClick={guardar} disabled={busy}>
          {busy ? <><Loader2 size={15} className="animate-spin" aria-hidden="true" /> Guardando…</> : 'Guardar validación'}
        </Button>
      </div>
    </section>
  )
}

function ModalDePaso({ viajeId, de, a, actores, onCerrar, onListo }: {
  viajeId: string; de: EstadoDeViaje; a: EstadoDeViaje; actores: readonly Actor[]
  onCerrar: () => void; onListo: () => void
}) {
  const [nota, setNota] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Si el paso exige motivo, lo exige la MISMA regla que el servidor: acá no
  // hay una segunda lista de cuáles lo piden.
  const v = puedeMover(de, a, actores, nota)
  const faltaNota = !v.ok && puedeMover(de, a, actores, 'x').ok

  async function confirmar() {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/travel-requests/${viajeId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mover', a, nota: nota.trim() || null }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'No se pudo hacer ese paso.')
      onListo()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo hacer ese paso.')
    } finally { setBusy(false) }
  }

  return (
    <Modal onClose={() => !busy && onCerrar()} titleId="paso-title" width={420}>
      <div className="p-5 space-y-4">
        <h2 id="paso-title" className="text-base font-bold text-navy font-display">
          {nombreDelPaso(de, a)}
        </h2>
        <div className="space-y-1.5">
          <label htmlFor="paso-nota" className={etiqueta}>
            {faltaNota ? 'Motivo (obligatorio)' : 'Nota (opcional)'}
          </label>
          <textarea id="paso-nota" rows={3} value={nota} onChange={e => setNota(e.target.value)}
            className="w-full rounded-xl border border-navy/15 px-3 py-2 text-[13px] text-navy font-body focus:border-coral focus:outline-none focus:ring-1 focus:ring-coral" />
        </div>
        {error && <p className="text-[13px] text-coral-deep font-body">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variante="fantasma" tamano="sm" onClick={onCerrar} disabled={busy}>Cancelar</Button>
          <Button type="button" variante="primario" tamano="sm" onClick={confirmar} disabled={busy || !v.ok}>
            {busy ? <><Loader2 size={15} className="animate-spin" aria-hidden="true" /> …</> : 'Confirmar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}


/**
 * FIN-11 · «Entregué el anticipo», con el monto.
 *
 * Es un modal aparte y no el genérico porque el monto NO es opcional: sin él
 * el expediente diría que hubo anticipo sin decir de cuánto, y la liquidación
 * se calcularía contra cero. Se propone el recomendado por finanzas, o el
 * pedido, pero quien entrega escribe lo que de verdad entregó.
 */
function ModalDeAnticipo({ viajeId, sugerido, moneda, onCerrar, onListo }: {
  viajeId: string; sugerido: number | null; moneda: 'CRC' | 'USD'
  onCerrar: () => void; onListo: () => void
}) {
  const [monto, setMonto] = useState(sugerido ? String(sugerido) : '')
  const [mon, setMon] = useState<'CRC' | 'USD'>(moneda)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirmar() {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/travel-requests/${viajeId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'anticipo_entregado', monto: Number(monto), moneda: mon }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'No se pudo registrar.')
      onListo()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar.')
    } finally { setBusy(false) }
  }

  const campo = 'w-full rounded-xl border border-navy/15 px-3 py-2 text-[13px] text-navy font-body focus:border-coral focus:outline-none focus:ring-1 focus:ring-coral'

  return (
    <Modal onClose={() => !busy && onCerrar()} titleId="anticipo-title" width={400}>
      <div className="p-5 space-y-4">
        <h2 id="anticipo-title" className="text-base font-bold text-navy font-display">Anticipo entregado</h2>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 space-y-1.5">
            <label htmlFor="ant-monto" className={etiqueta}>Monto entregado</label>
            <input id="ant-monto" type="number" min={0} step="any" className={campo}
              value={monto} onChange={e => setMonto(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ant-moneda" className={etiqueta}>Moneda</label>
            <select id="ant-moneda" className={campo} value={mon}
              onChange={e => setMon(e.target.value as 'CRC' | 'USD')}>
              <option value="CRC">CRC</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>
        {error && <p className="text-[13px] text-coral-deep font-body">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variante="fantasma" tamano="sm" onClick={onCerrar} disabled={busy}>Cancelar</Button>
          <Button type="button" variante="primario" tamano="sm" onClick={confirmar}
            disabled={busy || !(Number(monto) >= 0) || monto === ''}>
            {busy ? <><Loader2 size={15} className="animate-spin" aria-hidden="true" /> …</> : 'Registrar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
