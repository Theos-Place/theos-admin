'use client'

/**
 * EST-29 · Análisis de demanda (antes «Demanda declarada», su propia pantalla;
 * desde el 2026-10-20 es una pestaña de Solicitudes de estudios). La demanda declarada: las solicitudes abiertas agrupadas por estudio y
 * zona, cruzadas con los dirigentes disponibles, para decidir dónde abrir.
 *
 * Operativa y no un reporte: desde cada clúster se abre el grupo, prellenado,
 * y las solicitudes quedan vinculadas a él. Resolverlas sigue siendo el paso
 * de siempre en la cola, después de avisarle a cada persona.
 */
import { useEffect, useMemo, useState } from 'react'
import { Download, Users, UserCheck, Plus, ChevronDown, ChevronUp, Loader2, MapPinned, Info } from 'lucide-react'
import { BARRA, BARRA_IZQ, BARRA_DER, BOTON_PRIMARIO, TARJETA, TARJETA_ETIQUETA, TARJETA_VALOR, VALOR_NEUTRO } from '@/components/finance/reporte-ui'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import { AccessDenied } from '@/components/shared/AccessDenied'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/shared/Button'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { ETIQUETA_FUENTE, ETIQUETA_ETAPA, etiquetaDeZona, etapaDelCluster, type EtapaDelCluster } from '@/lib/studies/demanda-declarada'
import { urlDeNuevoGrupo } from '@/lib/studies/grupo-desde-demanda'
import { requestDeepLink } from '@/lib/studies/request-deeplink'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DemandaDeclarada, ClusterConOferta } from '@/lib/supabase/queries/demanda-declarada'

export function DemandaDeclaradaPanel() {
  const { user } = useAuth()
  // Esperar a los roles: sin esto, «acceso restringido» parpadea en cada carga.
  const { loaded } = usePermissions()
  const permitido = !!user?.roles?.some(r => (STUDY_ADMIN_ROLES as string[]).includes(r))
  const [d, setD] = useState<DemandaDeclarada | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!permitido) return
    let vivo = true
    fetch('/api/studies/demand-clusters')
      .then(r => (r.ok ? r.json() : Promise.reject(r)))
      .then(x => { if (vivo) { setD(x); setError(null) } })
      .catch(() => { if (vivo) setError('No se pudo cargar la demanda. Recargá la página.') })
    return () => { vivo = false }
  }, [permitido])

  const porZona = useMemo(() => (d?.clusters ?? []).filter(c => !c.esCapacitacion), [d])
  const capacitaciones = useMemo(() => (d?.clusters ?? []).filter(c => c.esCapacitacion), [d])
  // Las tres etapas (2026-10-20): lo que ya se puede abrir arriba y en
  // grande; lo que va camino, más chico; lo de una persona sola, al final.
  const porEtapa = useMemo(() => {
    const m: Record<EtapaDelCluster, ClusterConOferta[]> = { listo: [], potencial: [], aun_no: [] }
    for (const c of porZona) m[etapaDelCluster(c, d?.umbral)].push(c)
    return m
  }, [porZona, d])

  if (loaded && !permitido) return <AccessDenied />

  return (
    <div className="space-y-6">
      {/* Orden de los reportes (2026-10-20): la explicación y el Excel arriba. */}
      <div className={BARRA}>
        <div className={BARRA_IZQ}>
          <p className="text-[13px] text-navy-light/80 font-body">
            Las solicitudes abiertas, agrupadas por estudio y zona, con los dirigentes disponibles para darlas.
          </p>
        </div>
        <div className={BARRA_DER}>
          <a href="/api/studies/demand-clusters/export" className={BOTON_PRIMARIO}>
            <Download size={14} aria-hidden /> Descargar Excel
          </a>
        </div>
      </div>

      {error && <p className="text-[13px] text-coral-deep font-body" role="alert">{error}</p>}

      {!d && !error && (
        <div className="flex items-center gap-2 text-sm text-navy-light/80 font-body">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Agrupando solicitudes…
        </div>
      )}

      {d && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Dato etiqueta="Solicitudes abiertas" valor={d.totalSolicitudes} />
            <Dato etiqueta={ETIQUETA_ETAPA.listo} valor={d.clusters.filter(c => c.accionable).length} nota={`Grupos con ${d.umbral} o más personas.`} />
            <Dato etiqueta="Sin zona reconocida" valor={d.sinZona} nota="Escribieron un lugar que no es una zona. Están en «Otra zona»." />
          </div>

          {d.clusters.length === 0 ? (
            <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)]">
              <EmptyState icon={MapPinned} title="No hay solicitudes abiertas" description="Cuando alguien pida un estudio o una reubicación, aparece acá." />
            </div>
          ) : (
            <>
              <p className="flex items-start gap-1.5 text-[13px] text-navy-light/80 font-body">
                <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                Quien pidió varias zonas aparece en cada una: le sirve cualquiera, así que los grupos pueden sumar más personas que el total.
              </p>
              {porEtapa.listo.length > 0 && (
                <Seccion titulo={ETIQUETA_ETAPA.listo} nota={`${d.umbral} o más personas en el mismo estudio y zona.`}>
                  {porEtapa.listo.map(c => <TarjetaDeCluster key={c.clave} c={c} d={d} />)}
                </Seccion>
              )}
              {porEtapa.potencial.length > 0 && (
                <Seccion titulo={ETIQUETA_ETAPA.potencial} nota="De 2 a 4 personas: todavía no alcanza, pero va camino." compacta>
                  {porEtapa.potencial.map(c => <TarjetaDeCluster key={c.clave} c={c} d={d} compacta />)}
                </Seccion>
              )}
              {porEtapa.aun_no.length > 0 && (
                <Seccion titulo={ETIQUETA_ETAPA.aun_no} nota="Una persona sola: queda a la vista por si se le suma alguien." compacta>
                  {porEtapa.aun_no.map(c => <TarjetaDeCluster key={c.clave} c={c} d={d} compacta />)}
                </Seccion>
              )}
              {capacitaciones.length > 0 && (
                <Seccion titulo="Capacitaciones" nota="Van por estudio y no por zona: se abren centralizadas, por bloque.">
                  {capacitaciones.map(c => <TarjetaDeCluster key={c.clave} c={c} d={d} />)}
                </Seccion>
              )}
              <Tendencia d={d} />
            </>
          )}
        </>
      )}
    </div>
  )
}

function Dato({ etiqueta, valor, nota }: { etiqueta: string; valor: number; nota?: string }) {
  return (
    <div className={TARJETA}>
      <p className={TARJETA_ETIQUETA}>{etiqueta}</p>
      <p className={`${TARJETA_VALOR} ${VALOR_NEUTRO}`}>{valor}</p>
      {nota && <p className="mt-1 text-[13px] text-navy-light/80 font-body">{nota}</p>}
    </div>
  )
}

function Seccion({ titulo, nota, children, compacta }: { titulo: string; nota: string; children: React.ReactNode; compacta?: boolean }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-[15px] font-bold text-navy font-display">{titulo}</h2>
        <p className="flex items-start gap-1.5 text-[13px] text-navy-light/80 font-body">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> {nota}
        </p>
      </div>
      <div className={cn('grid grid-cols-1 items-start gap-4', compacta ? 'sm:grid-cols-2 xl:grid-cols-3' : 'lg:grid-cols-2')}>{children}</div>
    </section>
  )
}

function TarjetaDeCluster({ c, d, compacta }: { c: ClusterConOferta; d: DemandaDeclarada; compacta?: boolean }) {
  const [abierto, setAbierto] = useState(false)
  // Los dirigentes van detrás de un clic, como las solicitudes (2026-10-20):
  // abiertos de entrada, la tarjeta era una lista de nombres.
  const [verDirigentes, setVerDirigentes] = useState(false)
  const plan = d.planes[c.planCode] ?? c.planCode
  const zona = etiquetaDeZona(c.zona, d.zonas)
  // Solo las solicitudes de estudio se vinculan; las becas viven en otra tabla.
  const vinculables = c.personas.filter(p => p.fuente !== 'beca' && !p.grupoPropuestoId).map(p => p.id)
  const listaId = `cluster-${c.clave.replace(/[^a-z0-9]/gi, '-')}`
  const dirigentesId = `${listaId}-dirigentes`
  const boton = 'inline-flex items-center gap-1 rounded-full border border-[var(--outline-variant)] px-3 py-1.5 text-[13px] text-navy hover:bg-surface-low transition-colors font-body'
  return (
    <article className={cn('rounded-2xl bg-surface-card shadow-[var(--shadow-md)] border-2', compacta ? 'p-4' : 'p-5', c.accionable ? 'border-teal' : 'border-transparent')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className={cn('font-semibold text-navy font-display', compacta ? 'text-[13px]' : 'text-[15px]')}>{plan} · {zona}</h3>
          <p className="text-[13px] text-navy-light/80 font-body">
            {[c.diasMasPedidos.join(' o '), c.franjaMasPedida].filter(Boolean).join(' · ') || 'Sin horario indicado'}
          </p>
        </div>
        <span className={cn('flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-[13px] font-bold font-body',
          c.accionable ? 'bg-teal text-navy' : 'bg-surface-low text-navy')}>
          <Users size={13} aria-hidden="true" /> {c.personas.length}
        </span>
      </div>

      {c.dirigentes.length === 0 && (
        <p className="mt-2 flex items-start gap-1.5 text-[13px] text-coral-deep font-body">
          <UserCheck size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          Nadie disponible para darlo ahí. Es candidato para capacitar.
        </p>
      )}

      <div className={cn('flex flex-wrap items-center gap-2', compacta ? 'mt-3' : 'mt-4')}>
        <button type="button" onClick={() => setAbierto(a => !a)} aria-expanded={abierto} aria-controls={listaId} className={boton}>
          {abierto ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
          {abierto ? 'Ocultar solicitudes' : 'Ver solicitudes'}
        </button>
        {c.dirigentes.length > 0 && (
          <button type="button" onClick={() => setVerDirigentes(v => !v)} aria-expanded={verDirigentes} aria-controls={dirigentesId} className={boton}>
            <UserCheck size={14} aria-hidden="true" />
            {verDirigentes ? 'Ocultar dirigentes' : `Ver dirigentes (${c.dirigentes.length})`}
          </button>
        )}
        {c.accionable && vinculables.length > 0 && (
          <Button href={urlDeNuevoGrupo({ ...c, solicitudes: vinculables })} tamano="sm">
            <Plus size={14} aria-hidden="true" /> Abrir grupo con estos datos
          </Button>
        )}
      </div>

      {verDirigentes && (
        <ul id={dirigentesId} className="mt-3 flex flex-wrap gap-1.5">
          {c.dirigentes.map(x => (
            <li key={x.memberId} className="rounded-full bg-surface-low px-2.5 py-1 text-[13px] text-navy font-body">{x.nombre}</li>
          ))}
        </ul>
      )}

      {abierto && (
        <ul id={listaId} className="mt-4 divide-y divide-[var(--outline-variant)]">
          {c.personas.map(p => (
            <li key={p.id} className="py-2.5">
              <p className="text-sm text-navy font-body">{p.nombre}</p>
              <p className="text-[13px] text-navy-light/80 font-body">
                {ETIQUETA_FUENTE[p.fuente]} · {formatDate(p.creada)}
                {p.zonaTexto && <> · escribió «{p.zonaTexto}»</>}
              </p>
              <p className="text-[13px] text-navy-light/80 font-body break-all">
                {[p.email, p.telefono].filter(Boolean).join(' · ') || 'Sin contacto registrado'}
              </p>
              {p.grupoPropuestoId && (
                <p className="text-[13px] font-semibold text-teal-ink font-body">
                  Grupo abierto para esta persona: {d.gruposPropuestos[p.grupoPropuestoId] ?? 'ver en la cola'}
                </p>
              )}
              {/* Abre ESA solicitud en su pestaña (2026-10-20). Enlace normal y
                  no <Link>: la cola lee ?tab= y ?request= al entrar, y una
                  navegación del lado del cliente dejaría la pestaña de antes. */}
              <a href={enlaceALaCola(p)} className="text-[13px] text-navy underline font-body">
                Abrir su solicitud
              </a>
            </li>
          ))}
        </ul>
      )}
      {abierto && (
        <a href={pestanaDeLaCola(c)} className="mt-2 inline-block text-[13px] text-navy underline font-body">
          Resolverlas en la cola de solicitudes
        </a>
      )}
    </article>
  )
}

function Tendencia({ d }: { d: DemandaDeclarada }) {
  const { semanas, porPlan } = d.tendencia
  if (porPlan.length === 0) return null
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-[15px] font-bold text-navy font-display">Solicitudes nuevas por semana</h2>
        <p className="text-[13px] text-navy-light/80 font-body">Las últimas 12 semanas, de cualquier estado. Sirve para ver si la demanda de algo crece.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl bg-surface-card shadow-[var(--shadow-md)]" tabIndex={0} role="region" aria-label="Solicitudes nuevas por semana">
        <table className="w-full text-[13px] font-body">
          <thead>
            <tr className="text-navy-light/80">
              <th scope="col" className="px-3 py-2 text-left font-semibold">Estudio</th>
              {semanas.map(s => <th scope="col" key={s} className="px-2 py-2 text-right font-semibold whitespace-nowrap">{s.slice(8, 10)}/{s.slice(5, 7)}</th>)}
              <th scope="col" className="px-3 py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {porPlan.map(f => (
              <tr key={f.planCode} className="border-t border-[var(--outline-variant)]">
                <th scope="row" className="px-3 py-2 text-left font-normal text-navy whitespace-nowrap">{d.planes[f.planCode] ?? f.planCode}</th>
                {f.conteos.map((n, i) => <td key={i} className={cn('px-2 py-2 text-right', n ? 'text-navy font-semibold' : 'text-navy-light/80')}>{n || '·'}</td>)}
                <td className="px-3 py-2 text-right font-bold text-navy">{f.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** La solicitud de una persona, abierta en su pestaña. Las becas viven en
 *  Finanzas → Becas, que también abre una con ?request=. */
function enlaceALaCola(p: ClusterConOferta['personas'][number]): string {
  if (p.fuente === 'beca') return `/finanzas/becas?request=${p.id}`
  return requestDeepLink(p.fuente === 'reubicacion' ? 'relocation' : 'study_interest', p.id)
}

/** La pestaña de la cola donde está la mayoría de las solicitudes del grupo. */
function pestanaDeLaCola(c: ClusterConOferta): string {
  const reubicaciones = c.personas.filter(p => p.fuente === 'reubicacion').length
  const intereses = c.personas.filter(p => p.fuente === 'interes').length
  return `/estudios/solicitudes?tab=${reubicaciones > intereses ? 'relocation' : 'study_interest'}`
}
