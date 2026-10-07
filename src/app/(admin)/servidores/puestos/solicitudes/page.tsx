'use client'

/**
 * SRV-12 · «Solicitudes de puestos de servicio».
 *
 * QUÉ REEMPLAZA. Esta pantalla era una tabla de vacantes con cambio de estado
 * masivo. Lo que hacía falta es otra cosa: la operación de los primeros de
 * cada mes —mirar lo que pidió cada comité, bajárselo en Excel para repasarlo,
 * y publicarlo de una.
 *
 * AGRUPADA POR COMITÉ y no una lista plana: el repaso se hace comité por
 * comité, que es como está organizada la conversación con los encargados.
 *
 * ABRE EN «LISTAS PARA PUBLICAR» (SRV-15b) y no en todas: la tarea de los
 * primeros del mes es repasar lo que se pidió, y las publicadas, las bajadas y
 * las denegadas son una pila que crece un poco cada mes. El historial está a
 * un clic, con el número en el chip — un filtro por defecto que no se ve es
 * una lista incompleta que parece completa.
 *
 * CADA FILA SE PUEDE MOVER A MANO (SRV-15b), y para eso está el menú de la
 * derecha: bajar una publicada antes de fin de mes, denegar, y sobre todo
 * DEVOLVER a la cola una bajada o una denegada. Lo que el menú nunca ofrece es
 * «publicar»: eso lo hace la corrida del mes, que además sella la fecha.
 *
 * «PUBLICAR» NO ES SOLO AGREGAR, y por eso pide confirmación diciendo los DOS
 * números: sube lo nuevo y BAJA lo que está en la calle del mes pasado. Lo que
 * baja no se borra —queda desactivado con sus aplicaciones—, y eso también lo
 * dice la confirmación, porque es la pregunta que sigue.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { PUBLICAN_PUESTOS } from '@/lib/auth/roles'
import { cn } from '@/lib/utils'
import { ChevronLeft, Loader2, Download, Upload, Users, AlertTriangle, MoveRight } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { AccessDenied } from '@/components/shared/AccessDenied'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/shared/Button'
import { useToast } from '@/components/shared/Toast'
import { useTituloDePantalla } from '@/hooks/useTituloDePantalla'
import { mensajeDeLaRespuesta } from '@/lib/api/mensaje-del-error'
import { formatDate } from '@/lib/format'
import {
  VACANCY_STATE_LABEL, VACANCY_STATE_BADGE, isVacancyState, type VacancyState,
} from '@/lib/servers/vacancy-states'
import {
  textoDeConfirmacion, hayAlgoQuePublicar, motivoParaNoPublicar, type PlanDePublicacion,
} from '@/lib/servers/publicacion-mensual'
import {
  FILTROS, FILTRO_LABEL, FILTRO_POR_DEFECTO, vacioSegunFiltro,
  type FiltroDeSolicitudes,
} from '@/lib/servers/filtro-de-solicitudes'
import {
  estadosDestinoAMano, ACCION_HACIA, CONSECUENCIA_HACIA,
} from '@/lib/servers/cambio-de-estado-de-solicitud'
import { FilterChips } from '@/components/shared/FilterChips'
import {
  nombreDelMes, cuposEnJuego, type ResumenDelMes,
} from '@/lib/servers/resumen-del-mes'

type Solicitud = {
  id: string
  committee_id: string
  comite: string
  encargados: string[]
  puesto: string
  cupos: number
  estado: string
  published_at: string | null
  solicitada: string
}

export default function SolicitudesDePuestosPage() {
  const { hasRole, loaded, user } = useAuth()
  const toast = useToast()
  useTituloDePantalla('Solicitudes de puestos de servicio', 'Servidores')

  /**
   * SRV-20 · Ya no se decide por rol en el cliente.
   *
   * Desde hoy también entra quien COORDINA UN COMITÉ, para ver lo suyo — y
   * eso no se sabe por rol, porque un comité se coordina por PUESTO. El
   * endpoint responde 403 si no le toca; `sinAcceso` guarda esa respuesta.
   * Los roles amplios siguen viendo todo.
   */
  const [sinAcceso, setSinAcceso] = useState(false)
  const [soloMisComites, setSoloMisComites] = useState(false)
  /**
   * POR QUÉ JAZMÍN NO VEÍA EL BOTÓN (2026-10-07).
   *
   * Eran DOS listas: el endpoint pedía `SERVICE_ADMIN_ROLES` y esta pantalla
   * también — pero por su cuenta. Abrir el endpoint al rol del comité no
   * habría alcanzado: el botón se seguía escondiendo acá, y la persona
   * habría tenido el permiso sin manera de usarlo.
   *
   * Ahora las dos preguntan por `PUBLICAN_PUESTOS`. Es la misma lección de
   * UX-7: una lista escrita en dos lados se separa.
   */
  // Publicar baja lo que está en la calle: es de la coordinación, no de quien
  // arma las solicitudes.
  const puedePublicar = hasRole(...PUBLICAN_PUESTOS)

  const [items, setItems] = useState<Solicitud[] | null>(null)
  const [plan, setPlan] = useState<PlanDePublicacion>({ aPublicar: [], aDesactivar: [] })
  const [conteos, setConteos] = useState<Partial<Record<FiltroDeSolicitudes, number>>>({})
  const [filtro, setFiltro] = useState<FiltroDeSolicitudes>(FILTRO_POR_DEFECTO)
  const [confirmando, setConfirmando] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [moviendo, setMoviendo] = useState<Solicitud | null>(null)
  /** SRV-20 · «¿Qué pedimos este mes y en qué quedó?». Lo arma el servidor
   *  sobre lo que esta persona puede ver, no sobre el filtro de estado. */
  const [resumen, setResumen] = useState<ResumenDelMes | null>(null)
  const [meses, setMeses] = useState<string[]>([])
  const [mes, setMes] = useState('')

  // El filtro va en el servidor y no en memoria: lo mismo que se ve tiene que
  // salir en el Excel, y el Excel lo arma la misma ruta con el mismo
  // parámetro. Filtrar acá dejaría los dos caminos libres de separarse.
  const cargar = useCallback((f: FiltroDeSolicitudes, m: string) => {
    const u = new URLSearchParams({ estado: f })
    if (m) u.set('mes', m)
    fetch(`/api/servers/vacancies/requests?${u.toString()}`)
      .then(async r => {
        if (r.status === 403) { setSinAcceso(true); return null }
        return r.ok ? r.json() : { items: [], plan: { aPublicar: [], aDesactivar: [] } }
      })
      .then(d => {
        if (!d) return
        setItems((d.items ?? []) as Solicitud[])
        setPlan(d.plan ?? { aPublicar: [], aDesactivar: [] })
        if (d.conteos) setConteos(d.conteos)
        setResumen(d.resumen ?? null)
        setMeses(d.meses ?? [])
        setSoloMisComites(!!d.soloMisComites)
      })
      .catch(() => setItems([]))
  }, [])

  useEffect(() => { cargar(filtro, mes) }, [cargar, filtro, mes])

  /** Agrupadas por comité, y dentro por puesto. */
  const porComite = useMemo(() => {
    const m = new Map<string, Solicitud[]>()
    for (const s of items ?? []) {
      const arr = m.get(s.comite) ?? []
      arr.push(s)
      m.set(s.comite, arr)
    }
    return [...m.entries()]
      .map(([comite, filas]) => ({
        comite,
        encargados: filas[0]?.encargados ?? [],
        filas: [...filas].sort((a, b) => a.puesto.localeCompare(b.puesto, 'es')),
        cupos: filas.reduce((s, f) => s + f.cupos, 0),
      }))
      .sort((a, b) => a.comite.localeCompare(b.comite, 'es'))
  }, [items])

  const totalCupos = useMemo(() => (items ?? []).reduce((s, f) => s + f.cupos, 0), [items])

  async function publicar() {
    setPublicando(true)
    try {
      const res = await fetch('/api/servers/vacancies/publish', { method: 'POST' })
      if (!res.ok) throw new Error(await mensajeDeLaRespuesta(res, 'No se pudo publicar.'))
      const d = await res.json()
      toast(
        `Listo: ${d.publicadas} publicado${d.publicadas !== 1 ? 's' : ''}`
        + (d.desactivadas > 0 ? `, ${d.desactivadas} bajado${d.desactivadas !== 1 ? 's' : ''}` : ''),
        'success',
      )
      setConfirmando(false)
      cargar(filtro, mes)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo publicar.', 'error')
    } finally {
      setPublicando(false)
    }
  }

  async function mover(solicitud: Solicitud, hacia: VacancyState) {
    try {
      const res = await fetch(`/api/servers/vacancies/requests/${solicitud.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: hacia }),
      })
      if (!res.ok) throw new Error(await mensajeDeLaRespuesta(res, 'No se pudo cambiar el estado.'))
      toast(`«${solicitud.puesto}» quedó ${VACANCY_STATE_LABEL[hacia].toLowerCase()}.`, 'success')
      setMoviendo(null)
      cargar(filtro, mes)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo cambiar el estado.', 'error')
    }
  }

  if (!loaded) {
    return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 size={20} className="animate-spin text-navy-light/80" /></div>
  }
  if (user && sinAcceso) return <AccessDenied />

  return (
    <div className="space-y-5">
      <Link href="/servidores/puestos" className="inline-flex items-center gap-1 text-sm text-navy-light/80 hover:text-navy transition-colors font-body">
        <ChevronLeft size={16} /> Puestos de Servicio
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy font-display">Solicitudes de puestos de servicio</h1>
          <p className="mt-1 text-[13px] text-navy-light/80 font-body">
            {/* SRV-20 · Quien ve solo lo suyo tiene que SABERLO. Sin esta
                línea, un líder vería tres cupos y creería que eso fue todo
                lo que pidió la organización este mes. */}
            {soloMisComites
              ? 'Lo que pidieron tus comités, y en qué quedó cada cosa.'
              : 'Lo que pidió cada comité en la última ventana. Se revisa y se publica los primeros de cada mes.'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            href={`/api/servers/vacancies/requests?formato=xlsx&estado=${encodeURIComponent(filtro)}`}
            variante="secundario"
            className="inline-flex items-center gap-1.5"
          >
            <Download size={14} aria-hidden="true" /> Descargar Excel
          </Button>
          {puedePublicar && (
            <Button
              onClick={() => setConfirmando(true)}
              disabled={!hayAlgoQuePublicar(plan)}
              title={motivoParaNoPublicar(plan) ?? undefined}
              className="inline-flex items-center gap-1.5"
            >
              <Upload size={14} aria-hidden="true" /> Publicar puestos
            </Button>
          )}
        </div>
      </div>

      {/* El resumen de lo que haría el botón, SIEMPRE a la vista y no solo al
          confirmar: el número que importa es el de los que se bajan. */}
      {/* Por qué el botón está como está, SIEMPRE a la vista: apagado sin
          explicación se lee como que la pantalla está rota. */}
      {puedePublicar && (
        <div className={cn(
          'rounded-2xl p-4 flex items-start gap-2.5',
          hayAlgoQuePublicar(plan)
            ? 'bg-surface-card shadow-[var(--shadow-md)]'
            : 'bg-surface-low',
        )}>
          <Upload size={16} className="mt-0.5 shrink-0 text-navy-light/80" aria-hidden="true" />
          <p className="text-sm text-navy font-body">
            {motivoParaNoPublicar(plan) ?? textoDeConfirmacion(plan)}
          </p>
        </div>
      )}

      {/* SRV-20 · El resumen del mes. Va ARRIBA de los filtros y no se mueve
          con ellos: contesta «qué pedí este mes y en qué quedó», y filtrado
          por «listas para publicar» la respuesta sería siempre que todo está
          listo para publicar. */}
      {resumen && (
        <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-navy font-display">
              Lo pedido en {nombreDelMes(resumen.mes)}
            </h2>
            {meses.length > 1 && (
              <>
                <label htmlFor="mes-del-resumen" className="sr-only">Mes del resumen</label>
                <select
                  id="mes-del-resumen"
                  value={resumen.mes}
                  onChange={e => setMes(e.target.value)}
                  className="rounded-xl bg-surface-low px-3 py-1.5 text-[13px] text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
                >
                  {meses.map(m => <option key={m} value={m}>{nombreDelMes(m)}</option>)}
                </select>
              </>
            )}
          </div>

          {resumen.solicitudes === 0 ? (
            <p className="text-[13px] text-navy-light/80 font-body">
              No se pidió nada en {nombreDelMes(resumen.mes)}.
            </p>
          ) : (
            <>
              <p className="text-sm text-navy font-body">
                {/* Cupos y solicitudes son números distintos y los dos
                    importan: «3 solicitudes» esconde que son veinte personas,
                    y «20 cupos» esconde que vinieron de un solo comité. */}
                <strong>{resumen.cupos} cupos</strong> en {resumen.solicitudes}
                {resumen.solicitudes === 1 ? ' solicitud' : ' solicitudes'}
                {cuposEnJuego(resumen) !== resumen.cupos && (
                  <> · <strong>{cuposEnJuego(resumen)}</strong> siguen en pie</>
                )}
              </p>

              <div>
                <p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display mb-1.5">
                  En qué quedaron
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {resumen.porEstado.map(e => (
                    <li
                      key={e.estado}
                      className={cn(
                        'rounded-full px-2.5 py-1 text-[13px] font-medium font-display',
                        isVacancyState(e.estado)
                          ? VACANCY_STATE_BADGE[e.estado]
                          : 'bg-navy/10 text-navy-light/80',
                      )}
                    >
                      {isVacancyState(e.estado) ? VACANCY_STATE_LABEL[e.estado] : e.estado}
                      {': '}{e.cupos}
                    </li>
                  ))}
                </ul>
              </div>

              {/* El desglose por comité solo tiene sentido con más de uno: a
                  un líder con un solo comité le repetiría el número de
                  arriba. */}
              {resumen.porComite.length > 1 && (
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display mb-1.5">
                    Por comité
                  </p>
                  <ul className="space-y-1">
                    {resumen.porComite.map(c => (
                      <li key={c.committee_id} className="flex items-center gap-3">
                        <span className="w-44 shrink-0 truncate text-[13px] text-navy font-body">{c.comite}</span>
                        <span
                          className="h-3 rounded bg-coral/70"
                          style={{ width: `${Math.max(2, (c.cupos / resumen.porComite[0].cupos) * 100)}%` }}
                        />
                        <span className="shrink-0 text-[13px] text-navy-light/80 font-body tabular-nums">
                          {c.cupos}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <FilterChips
        ariaLabel="Filtrar solicitudes por estado"
        chips={FILTROS.map(f => ({ key: f, label: FILTRO_LABEL[f], count: conteos[f] ?? 0 }))}
        activeKey={filtro}
        // Vacía la lista al cambiar de chip, acá y no dentro de `cargar`: así
        // se ve el spinner en vez de las filas del filtro anterior, y el
        // refresco que viene después de publicar deja las que ya están (no
        // parpadea la pantalla entera por un cambio de estado).
        onSelect={k => { setItems(null); setFiltro(k as FiltroDeSolicitudes) }}
      />

      {items === null ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={18} className="animate-spin text-navy-light/80" /></div>
      ) : porComite.length === 0 ? (
        <div className="rounded-2xl bg-surface-card shadow-card">
          <EmptyState
            title={vacioSegunFiltro(filtro).titulo}
            description={vacioSegunFiltro(filtro).detalle}
          />
        </div>
      ) : (
        <>
          <p className="text-[13px] text-navy-light/80 font-body">
            {porComite.length} comité{porComite.length !== 1 ? 's' : ''} · {items.length} puesto
            {items.length !== 1 ? 's' : ''} · <strong className="text-navy">{totalCupos}</strong> cupo
            {totalCupos !== 1 ? 's' : ''} en total
          </p>

          <div className="space-y-4">
            {porComite.map(g => (
              <section key={g.comite} className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] overflow-hidden">
                <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3 border-b border-[var(--outline-variant)]">
                  <div>
                    <h2 className="text-sm font-semibold text-navy font-display">{g.comite}</h2>
                    <p className="text-[13px] text-navy-light/80 font-body inline-flex items-center gap-1.5">
                      <Users size={12} aria-hidden="true" />
                      {g.encargados.length > 0 ? g.encargados.join(', ') : 'Sin encargado registrado'}
                    </p>
                  </div>
                  <span className="text-[13px] text-navy-light/80 font-body">
                    {g.cupos} cupo{g.cupos !== 1 ? 's' : ''}
                  </span>
                </div>
                <ul>
                  {g.filas.map(f => (
                    <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 border-b border-[var(--outline-variant)] last:border-0">
                      <span className="text-sm text-navy font-body min-w-0">{f.puesto}</span>
                      <span className="flex items-center gap-3 shrink-0">
                        <span className="text-[13px] text-navy-light/80 font-body">
                          Pedido el {formatDate(f.solicitada)}
                        </span>
                        {isVacancyState(f.estado) && (
                          <span className={cn('rounded-full px-2 py-0.5 text-[13px] font-body', VACANCY_STATE_BADGE[f.estado])}>
                            {VACANCY_STATE_LABEL[f.estado]}
                          </span>
                        )}
                        <span className="text-sm font-bold text-navy font-display tabular-nums w-8 text-right">
                          {f.cupos}
                        </span>
                        {puedePublicar && estadosDestinoAMano(f.estado).length > 0 && (
                          <button
                            onClick={() => setMoviendo(f)}
                            aria-label={`Cambiar el estado de ${f.puesto}`}
                            className="rounded-full p-1.5 text-navy-light/80 hover:text-navy hover:bg-surface-low transition-colors"
                          >
                            <MoveRight size={15} aria-hidden="true" />
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      {moviendo && (
        <Modal onClose={() => setMoviendo(null)} titleId="mover-title">
          <div className="p-6 space-y-4">
            <div>
              <h2 id="mover-title" className="text-lg font-semibold text-navy font-display">
                Cambiar el estado
              </h2>
              <p className="mt-1 text-sm text-navy-light/80 font-body">
                {moviendo.puesto} · {moviendo.comite}
              </p>
              {isVacancyState(moviendo.estado) && (
                <span className={cn('mt-2 inline-block rounded-full px-2 py-0.5 text-[13px] font-body', VACANCY_STATE_BADGE[moviendo.estado])}>
                  Hoy: {VACANCY_STATE_LABEL[moviendo.estado]}
                </span>
              )}
            </div>

            {/* Las opciones salen de la tabla de transiciones, no de una lista
                escrita acá: la misma que valida el servidor. */}
            <div className="space-y-1.5">
              {estadosDestinoAMano(moviendo.estado).map(destino => (
                <button
                  key={destino}
                  onClick={() => void mover(moviendo, destino)}
                  className="w-full text-left rounded-xl p-3 bg-surface-low hover:bg-surface-card transition-colors"
                >
                  <span className="block text-sm font-semibold text-navy font-display">
                    {ACCION_HACIA[destino]}
                  </span>
                  <span className="block text-[13px] text-navy-light/80 font-body">
                    {CONSECUENCIA_HACIA[destino]}
                  </span>
                </button>
              ))}
            </div>

            {/* Por qué no está «Publicar»: es la pregunta que sigue, y sin
                respuesta a la vista se contesta abriendo un ticket. */}
            <p className="text-[13px] text-navy-light/80 font-body">
              Publicar no se hace desde acá: los puestos salen a la página con
              «Publicar puestos», la corrida del mes.
            </p>

            <div className="flex justify-end">
              <button
                onClick={() => setMoviendo(null)}
                className="rounded-xl border border-[var(--outline-variant)] px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
              >
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirmando && (
        <Modal onClose={() => setConfirmando(false)} titleId="publicar-title">
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={18} className="text-coral mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <h2 id="publicar-title" className="text-lg font-semibold text-navy font-display">
                  Publicar los puestos del mes
                </h2>
                <p className="mt-1 text-sm text-navy-light/80 font-body">
                  {textoDeConfirmacion(plan)}
                </p>
              </div>
            </div>
            <p className="text-[13px] text-navy-light/80 font-body">
              Esto cambia lo que se ve en la página pública de puestos. Queda registrado
              quién lo hizo.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmando(false)}
                disabled={publicando}
                className="rounded-xl border border-[var(--outline-variant)] px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
              >
                Cancelar
              </button>
              <Button onClick={() => void publicar()} disabled={publicando}>
                {publicando ? 'Publicando…' : 'Sí, publicar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
