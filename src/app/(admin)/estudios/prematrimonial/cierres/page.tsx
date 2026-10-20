'use client'

/**
 * PRE-9 · Lo que los mentores escribieron al cerrar un prematrimonial.
 *
 * POR QUÉ EXISTE: la evaluación se llenaba desde PRE-8 y después no había
 * dónde leerla. El dato solo se alcanzaba sabiendo de antemano el id de la
 * pareja, así que en la práctica nadie la veía.
 *
 * EL CONTENIDO ES PASTORAL Y SENSIBLE — «desacuerdo grave o tema no resuelto
 * que pudiera generar fricción en el matrimonio»—. Por eso la lista NO
 * muestra el punto ciego ni las observaciones: solo avisa que hay algo
 * anotado, y el texto se abre de a uno. Leerlo es un acto deliberado, no
 * algo que aparece de refilón mientras se busca otra cosa.
 *
 * SOLO LECTURA. Lo que escribieron los mentores no se corrige desde acá.
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Heart, Flag, Loader2, Users, Eye } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/shared/EmptyState'
import { SinAcceso } from '@/components/shared/SinAcceso'
import { Modal } from '@/components/shared/Modal'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { formatDateLong } from '@/lib/format'
import { mensajeDeLaRespuesta } from '@/lib/api/mensaje-del-error'
import { RangoDeFechas, Buscador, SelectRotulado } from '@/components/finance/BarraDeReporte'
import {
  PESTANA, BARRA, BARRA_IZQ, TARJETA, TARJETA_ETIQUETA, TARJETA_VALOR, VALOR_NEUTRO, VALOR_DINERO, VALOR_PENDIENTE,
} from '@/components/finance/reporte-ui'
import { enRango } from '@/lib/finance/descargar-excel'
import {
  etiquetaDeCompromiso, etiquetaDePlan, resumenDeCierres, type CierreEnLista, type ResumenDeCierres,
} from '@/lib/studies/cierres-prematrimoniales'
import {
  PREMAT_EVAL_ROLES, needsFollowUp,
  COMMITMENT_QUESTION, STRENGTHS_QUESTION, TOPICS_QUESTION, BLIND_SPOT_QUESTION,
  OBSERVATIONS_LABEL, ACTION_PLAN_LABEL, BLESSING_LABEL,
} from '@/lib/studies/premat-evaluation'

type Payload = { items: CierreEnLista[]; total: number; resumen: ResumenDeCierres }

type Detalle = {
  id: string
  commitment: string; strengths: string[] | null; strengths_notes: string | null
  topics_to_work: string[] | null; observations: string | null
  blind_spot: boolean | null; blind_spot_notes: string | null
  action_plan: string; blessing: string | null; created_at: string
  request: {
    ceremony_date: string | null
    requester: { id: string; first_name: string | null; last_name: string | null } | null
    spouse: { id: string; first_name: string | null; last_name: string | null } | null
  } | null
  grupo: { id: string; name: string | null } | null
  mentor: { first_name: string | null; last_name: string | null } | null
}

const CARD = 'rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]'

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-navy-light/80 font-display">{etiqueta}</p>
      <div className="mt-1 text-sm text-navy font-body">{children}</div>
    </div>
  )
}

function Lista({ items }: { items: string[] | null }) {
  if (!items?.length) return <span className="text-navy-light/80">No marcaron ninguno.</span>
  return (
    <ul className="list-disc pl-5 space-y-0.5">
      {items.map(t => <li key={t}>{t}</li>)}
    </ul>
  )
}

export default function CierresPrematrimonialesPage() {
  const { user, loaded } = useAuth()
  const [datos, setDatos] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)
  // El nombre de la pareja viaja con el detalle: el del detalle sale de la
  // SOLICITUD, y un grupo hecho a mano no la tiene (PRE-8). La lista ya lo
  // resuelve con la matrícula, así que se usa ese.
  const [abierto, setAbierto] = useState<(Detalle & { pareja: string }) | null>(null)
  // El orden de los reportes (2026-10-20): rango por fecha de cierre,
  // búsqueda y plan. La lista llega completa; filtra acá.
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [seguimiento, setSeguimiento] = useState<'todos' | 'listos' | 'seguimiento' | 'punto_ciego'>('todos')
  const [cargandoDetalle, setCargandoDetalle] = useState<string | null>(null)

  const puedeVer = (user?.roles ?? []).some(r => (PREMAT_EVAL_ROLES as string[]).includes(r))

  const cargar = useCallback(() => {
    if (!puedeVer) return
    fetch('/api/studies/prematrimonial/cierres')
      .then(async r => {
        if (!r.ok) throw new Error(await mensajeDeLaRespuesta(r, 'No se pudieron cargar los cierres.'))
        return r.json() as Promise<Payload>
      })
      .then(d => { setDatos(d); setError(null) })
      .catch(e => setError(e instanceof Error ? e.message : 'No se pudieron cargar los cierres.'))
  }, [puedeVer])
  useEffect(() => { cargar() }, [cargar])

  async function abrir(id: string, pareja: string) {
    setCargandoDetalle(id)
    try {
      const r = await fetch(`/api/studies/prematrimonial/cierres/${id}`)
      if (!r.ok) throw new Error(await mensajeDeLaRespuesta(r, 'No se pudo abrir el cierre.'))
      setAbierto({ ...(await r.json() as Detalle), pareja })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir el cierre.')
    } finally {
      setCargandoDetalle(null)
    }
  }

  const enRangoYBusqueda = useMemoCierres(datos?.items, desde, hasta, busqueda)
  const visibles = enRangoYBusqueda.filter(c =>
    seguimiento === 'todos' ? true
    : seguimiento === 'listos' ? !needsFollowUp(c.action_plan)
    : seguimiento === 'seguimiento' ? needsFollowUp(c.action_plan)
    : c.tiene_punto_ciego)
  const resumen = resumenDeCierres(enRangoYBusqueda)

  if (!loaded) return null
  if (!puedeVer) {
    return <SinAcceso que="los cierres del prematrimonial" volverA="/estudios" volverLabel="Ir a estudios" />
  }

  const nombre = (m: { first_name: string | null; last_name: string | null } | null | undefined) =>
    `${m?.first_name ?? ''} ${m?.last_name ?? ''}`.trim()

  return (
    <PageContainer>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl text-navy font-display font-extrabold tracking-[-0.02em]">
            Cierres del prematrimonial
          </h1>
          <p className="mt-0.5 text-[13px] text-navy-light/80 font-body">
            Lo que los mentores escribieron sobre cada pareja al terminar el curso.
            Solo lectura.
          </p>
        </div>

        {error && <p className="text-sm text-coral-deep font-body">{error}</p>}

        {datos && datos.total > 0 && (
          <div className={PESTANA}>
            {/* Sin Excel a propósito: es contenido pastoral, y este archivo
                existe para que se lea de a uno, no para que circule. */}
            <div className={BARRA}>
              <div className={BARRA_IZQ}>
                <RangoDeFechas id="cierre" etiqueta="Cerrado desde" desde={desde} hasta={hasta} onDesde={setDesde} onHasta={setHasta} />
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {([['Cierres', resumen.total, VALOR_NEUTRO], ['Listos', resumen.listos, VALOR_DINERO],
                ['En seguimiento', resumen.enSeguimiento, VALOR_PENDIENTE], ['Con punto ciego', resumen.conPuntoCiego, VALOR_NEUTRO]] as const).map(([l, v, c]) => (
                <div key={l} className={TARJETA}>
                  <p className={TARJETA_ETIQUETA}>{l}</p>
                  <p className={cn(TARJETA_VALOR, c)}>{v}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Buscador valor={busqueda} onCambio={setBusqueda} placeholder="Buscar por pareja, grupo o mentor…" />
              <SelectRotulado id="cierre-plan" etiqueta="Mostrar" valor={seguimiento} onCambio={v => setSeguimiento(v as typeof seguimiento)}
                opciones={[{ value: 'todos', label: 'Todos' }, { value: 'listos', label: 'Listos' }, { value: 'seguimiento', label: 'En seguimiento' }, { value: 'punto_ciego', label: 'Con punto ciego' }]} />
            </div>
          </div>
        )}

        {!datos && !error && (
          <div className="h-40 rounded-2xl bg-surface-card animate-pulse" />
        )}

        {datos?.total === 0 && (
          <EmptyState
            icon={Heart}
            title="Todavía no hay cierres"
            description="Acá van a aparecer las evaluaciones que los mentores llenan cuando se cierra un grupo de prematrimonial."
          />
        )}

        {datos && datos.total > 0 && visibles.length === 0 && (
          <p className="py-8 text-center text-sm text-navy-light/80 font-body">Ningún cierre con esos filtros.</p>
        )}

        {datos && datos.total > 0 && (
          <div className="space-y-3">
            {visibles.map(c => (
              <div key={c.id} className={cn(CARD, 'flex flex-wrap items-start justify-between gap-3')}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm text-navy font-body font-medium">{c.pareja}</p>
                    {needsFollowUp(c.action_plan) && (
                      <span className="rounded-full bg-coral/12 px-2 py-0.5 text-[11px] text-coral-deep font-display">
                        En seguimiento
                      </span>
                    )}
                    {c.tiene_punto_ciego && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-surface-low px-2 py-0.5 text-[11px] text-navy-light/80 font-display">
                        <Flag size={11} aria-hidden="true" /> Punto ciego anotado
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[13px] text-navy-light/80 font-body">
                    {etiquetaDePlan(c.action_plan)}
                  </p>
                  <p className="mt-0.5 text-[13px] text-navy-light/80 font-body">
                    {c.grupo ?? 'Sin grupo'}
                    {c.mentores && <> · {c.mentores}</>}
                    {' · '}{formatDateLong(c.fecha)}
                    {c.temas > 0 && <> · {c.temas} tema{c.temas === 1 ? '' : 's'} por trabajar</>}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void abrir(c.id, c.pareja)}
                  disabled={cargandoDetalle === c.id}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-low px-4 py-2 text-[13px] text-navy hover:bg-navy/10 transition-colors font-body focus:outline-none focus:ring-2 focus:ring-coral/40 disabled:opacity-60"
                  aria-label={`Ver el cierre de ${c.pareja}`}
                >
                  {cargandoDetalle === c.id
                    ? <><Loader2 size={14} className="animate-spin" /> Abriendo…</>
                    : <><Eye size={14} aria-hidden="true" /> Ver</>}
                </button>
              </div>
            ))}
          </div>
        )}

        {abierto && (
          <Modal onClose={() => setAbierto(null)} titleId="cierre-titulo" width={640}>
            <div className="p-6">
              <h2 id="cierre-titulo" className="pr-8 text-lg text-navy font-display font-extrabold tracking-[-0.02em]">
                {abierto.pareja}
              </h2>
              <p className="mt-0.5 text-[13px] text-navy-light/80 font-body">
                {abierto.grupo?.name ?? 'Sin grupo'}
                {nombre(abierto.mentor) && <> · lo llenó {nombre(abierto.mentor)}</>}
                {' · '}{formatDateLong(abierto.created_at)}
                {abierto.request?.ceremony_date && <> · boda el {formatDateLong(abierto.request.ceremony_date)}</>}
              </p>

              <div className="mt-5 space-y-4 max-h-[65vh] overflow-y-auto pr-1">
                <Dato etiqueta={COMMITMENT_QUESTION}>{etiquetaDeCompromiso(abierto.commitment)}</Dato>

                <Dato etiqueta={STRENGTHS_QUESTION}><Lista items={abierto.strengths} /></Dato>
                {abierto.strengths_notes && (
                  <Dato etiqueta="Notas sobre las fortalezas">{abierto.strengths_notes}</Dato>
                )}

                <Dato etiqueta={TOPICS_QUESTION}><Lista items={abierto.topics_to_work} /></Dato>
                {abierto.observations && (
                  <Dato etiqueta={OBSERVATIONS_LABEL}>{abierto.observations}</Dato>
                )}

                <Dato etiqueta={BLIND_SPOT_QUESTION}>
                  {abierto.blind_spot ? 'Sí' : 'No'}
                </Dato>
                {abierto.blind_spot && abierto.blind_spot_notes && (
                  <div className="rounded-xl bg-coral/8 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-coral-deep font-display">
                      Qué detectaron
                    </p>
                    <p className="mt-1 text-sm text-navy font-body">{abierto.blind_spot_notes}</p>
                  </div>
                )}

                <Dato etiqueta={ACTION_PLAN_LABEL}>{etiquetaDePlan(abierto.action_plan)}</Dato>
                {abierto.blessing && <Dato etiqueta={BLESSING_LABEL}>{abierto.blessing}</Dato>}
              </div>

              <p className="mt-4 flex items-start gap-1.5 text-[13px] text-navy-light/80 font-body">
                <Users size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                Esto lo escribieron los mentores de la pareja. No lo ve la pareja ni el
                resto de la coordinación.
              </p>
            </div>
          </Modal>
        )}
      </div>
    </PageContainer>
  )
}

/** Rango por fecha de cierre y búsqueda por pareja, grupo o mentor. */
function useMemoCierres(items: CierreEnLista[] | undefined, desde: string, hasta: string, busqueda: string): CierreEnLista[] {
  return useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return (items ?? []).filter(c => enRango(c.fecha, desde, hasta)
      && (!q || [c.pareja, c.grupo ?? '', c.mentores ?? ''].join(' ').toLowerCase().includes(q)))
  }, [items, desde, hasta, busqueda])
}
