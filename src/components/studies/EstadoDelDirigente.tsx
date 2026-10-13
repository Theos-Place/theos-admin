'use client'

/**
 * DIR-8 · La ficha administrativa del estado del dirigente.
 *
 * Los selectores van ANIDADOS: elegir «Inactivo» abre las sub-razones, y
 * elegir «No aprobó el CDEB» abre si es definitivo o con seguimiento. No se
 * muestran todos los campos de una: el diagrama es un árbol y la pantalla
 * también, o la persona tiene que adivinar cuál de ocho combinaciones aplica.
 *
 * Lo que NO ve quien no puede: las notas y la banderita no se pintan, y
 * tampoco llegan en el payload (lo sanea el servidor). Acá solo se decide
 * qué dibujar.
 *
 * La validación es la MISMA función del servidor y de la base: el botón de
 * guardar queda apagado con el motivo escrito, en vez de dejar mandar algo
 * que el endpoint va a rechazar.
 */
import { useState } from 'react'
import { Loader2, Flag } from 'lucide-react'
import { Button } from '@/components/shared/Button'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/shared/Toast'
import { usePrecarga } from '@/hooks/usePrecarga'
import {
  motivoInvalido, resumen,
  RAZONES_INACTIVO, DETALLES_NO_EJERCE, SITUACIONES_CDEB,
  RAZONES_NO_DISPONIBLE, RAZONES_DE_REVISION,
  ETIQUETA_RAZON_INACTIVO, ETIQUETA_DETALLE, ETIQUETA_CDEB,
  ETIQUETA_NO_DISPONIBLE, ETIQUETA_REVISION,
  type EstadoDelDirigente as Estado, type RazonDeRevision,
} from '@/lib/leaders/estado-del-dirigente'

export type EstadoGuardado = Estado & {
  notaRevision: string
  notaCdeb: string
  notaDecisionPropia: string
  notaPausa: string
  notaGeneral: string
}

const VACIO: EstadoGuardado = {
  base: 'activo', razonInactivo: null, detalleNoEjerce: null, situacionCdeb: null,
  disponibilidad: 'disponible', razonNoDisponible: null, pausaHasta: null, revision: [],
  notaRevision: '', notaCdeb: '', notaDecisionPropia: '', notaPausa: '', notaGeneral: '',
}

/**
 * Etiqueta + control, asociados por `htmlFor`.
 *
 * Envolver el control en el `<label>` también vale en HTML, pero acá el
 * contenido es un `children` genérico y nada garantiza que adentro venga un
 * control — un `<label>` sin control es HTML inválido y el lector de
 * pantalla no anuncia nada. Con `id` explícito la asociación no depende de
 * lo que se le pase.
 */
function Campo({ controlId, etiqueta, children }: {
  /** El id del control que esta etiqueta describe. No es un id propio: por
   *  eso no se llama `id`, que además haría que el guard de ids duplicados
   *  contara dos veces el mismo. */
  controlId: string; etiqueta: string; children: React.ReactNode
}) {
  return (
    <div>
      <label
        htmlFor={controlId}
        className="block text-[11px] uppercase tracking-widest text-navy-light/80 font-display mb-1"
      >
        {etiqueta}
      </label>
      {children}
    </div>
  )
}

// Las mismas clases que el resto de los formularios de estudios: el borde
// duro que tenía antes no lo usa ninguna otra pantalla y se veía pegado.
const SELECT = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'
const TEXTO = SELECT

function Nota({ controlId, etiqueta, valor, onChange, obligatoria }: {
  controlId: string; etiqueta: string; valor: string; onChange: (v: string) => void; obligatoria?: boolean
}) {
  return (
    <Campo controlId={controlId} etiqueta={obligatoria ? `${etiqueta} (obligatoria)` : `${etiqueta} (opcional)`}>
      <textarea
        id={controlId}
        value={valor}
        onChange={e => onChange(e.target.value)}
        rows={2}
        className={TEXTO}
      />
    </Campo>
  )
}

export function EstadoDelDirigenteForm({
  memberId, activo, inicial, puedeNotas, puedeBanderita, onGuardado,
}: {
  memberId: string
  /**
   * Activo o no, DECIDIDO AFUERA.
   *
   * El toggle de la cabecera ya hacía esto, y hace bastante más que cambiar
   * un valor: agrega o saca del Comité de Dirigentes, da o quita el rol, y
   * se niega si la persona tiene un grupo en curso. Un segundo control acá
   * habría sido el mismo cambio por dos caminos, uno de ellos sin esos
   * efectos — y ganaría el último que alguien tocara.
   */
  activo: boolean
  inicial?: Partial<EstadoGuardado>
  /** Quien no puede, no ve los campos Y tampoco los recibe del servidor. */
  puedeNotas: boolean
  puedeBanderita: boolean
  onGuardado: () => void
}) {
  const toast = useToast()
  const [e, setE] = useState<EstadoGuardado>({ ...VACIO, ...inicial })
  const [guardando, setGuardando] = useState(false)

  const motivo = motivoInvalido(e)

  /** Cambiar una rama LIMPIA las de abajo: si no, quedan escondidas con un
   *  valor viejo y se guardan sin que nadie las viera. */
  function cambiarBase(base: Estado['base']) {
    setE(base === 'activo'
      ? { ...e, base, razonInactivo: null, detalleNoEjerce: null, situacionCdeb: null, disponibilidad: 'disponible', razonNoDisponible: null, pausaHasta: null }
      : { ...e, base, disponibilidad: null, razonNoDisponible: null, pausaHasta: null, razonInactivo: 'no_asiste', detalleNoEjerce: null, situacionCdeb: null })
  }

  // El toggle manda. Si allá cambian el estado, acá se limpia la rama que
  // dejó de aplicar: si no, quedaría una sub-razón de inactividad escondida
  // en un dirigente activo, lista para guardarse sin que nadie la viera.
  const base: Estado['base'] = activo ? 'activo' : 'inactivo'
  usePrecarga(base, () => cambiarBase(base))

  async function guardar() {
    if (motivo) return
    setGuardando(true)
    try {
      const res = await fetch(`/api/studies/dirigentes/${memberId}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado_base: e.base,
          razon_inactivo: e.razonInactivo,
          detalle_no_ejerce: e.detalleNoEjerce,
          situacion_cdeb: e.situacionCdeb,
          disponibilidad: e.disponibilidad,
          razon_no_disponible: e.razonNoDisponible,
          pausa_hasta: e.pausaHasta,
          revision: e.revision,
          ...(puedeNotas ? {
            nota_revision: e.notaRevision || null,
            nota_cdeb: e.notaCdeb || null,
            nota_decision_propia: e.notaDecisionPropia || null,
            nota_pausa: e.notaPausa || null,
            nota_general: e.notaGeneral || null,
          } : {}),
        }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? 'No se pudo guardar')
      toast('Estado actualizado.', 'success')
      onGuardado()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo guardar', 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-navy font-display">Detalle del estado</h3>
          <p className="text-[13px] text-navy-light/80 font-body mt-0.5">
            {activo
              ? 'Por qué está o no disponible para tomar un grupo.'
              : 'Por qué dejó de ejercer. Activar o desactivar se hace con el botón de arriba.'}
          </p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-display tracking-wide',
          activo ? 'bg-teal/15 text-navy' : 'bg-navy-light/10 text-navy-light/80')}>
          {resumen(e)}
        </span>
      </div>


      {/* ── Rama INACTIVO ──────────────────────────────────────────── */}
      {e.base === 'inactivo' && (
        <>
          <Campo controlId="dir-razon-inactivo" etiqueta="Por qué está inactivo">
            <select
              id="dir-razon-inactivo" value={e.razonInactivo ?? ''}
              onChange={ev => setE({
                ...e, razonInactivo: ev.target.value as Estado['razonInactivo'],
                detalleNoEjerce: null, situacionCdeb: null,
              })}
              className={SELECT}
            >
              {RAZONES_INACTIVO.map(r => (
                <option key={r} value={r}>{ETIQUETA_RAZON_INACTIVO[r]}</option>
              ))}
            </select>
          </Campo>

          {e.razonInactivo === 'asiste_no_ejerce' && (
            <Campo controlId="dir-no-ejerce" etiqueta="Por qué no ejerce">
              <select
                id="dir-no-ejerce" value={e.detalleNoEjerce ?? ''}
                onChange={ev => setE({
                  ...e, detalleNoEjerce: (ev.target.value || null) as Estado['detalleNoEjerce'],
                  situacionCdeb: null,
                })}
                className={SELECT}
              >
                <option value="">Elegir…</option>
                {DETALLES_NO_EJERCE.map(d => (
                  <option key={d} value={d}>{ETIQUETA_DETALLE[d]}</option>
                ))}
              </select>
            </Campo>
          )}

          {e.detalleNoEjerce === 'no_aprobo_cdeb' && (
            <>
              <Campo controlId="dir-cdeb" etiqueta="Situación">
                <select
                  id="dir-cdeb" value={e.situacionCdeb ?? ''}
                  onChange={ev => setE({ ...e, situacionCdeb: (ev.target.value || null) as Estado['situacionCdeb'] })}
                  className={SELECT}
                >
                  <option value="">Elegir…</option>
                  {SITUACIONES_CDEB.map(s => (
                    <option key={s} value={s}>{ETIQUETA_CDEB[s]}</option>
                  ))}
                </select>
              </Campo>
              {puedeNotas && e.situacionCdeb && (
                <Nota
                  controlId="dir-nota-cdeb"
                  etiqueta={e.situacionCdeb === 'seguimiento'
                    ? 'Qué seguimiento se le da' : 'Nota'}
                  valor={e.notaCdeb}
                  onChange={v => setE({ ...e, notaCdeb: v })}
                />
              )}
            </>
          )}

          {puedeNotas && e.detalleNoEjerce === 'decision_propia' && (
            <Nota controlId="dir-nota-decision" etiqueta="Nota" valor={e.notaDecisionPropia}
              onChange={v => setE({ ...e, notaDecisionPropia: v })} />
          )}
        </>
      )}

      {/* ── Rama ACTIVO ────────────────────────────────────────────── */}
      {e.base === 'activo' && (
        <>
          <Campo controlId="dir-disponibilidad" etiqueta="Disponibilidad">
            <select
              id="dir-disponibilidad" value={e.disponibilidad ?? 'disponible'}
              onChange={ev => setE({
                ...e, disponibilidad: ev.target.value as Estado['disponibilidad'],
                razonNoDisponible: null, pausaHasta: null,
              })}
              className={SELECT}
            >
              <option value="disponible">Disponible</option>
              <option value="no_disponible">No disponible</option>
            </select>
          </Campo>

          {e.disponibilidad === 'no_disponible' && (
            <Campo controlId="dir-no-disponible" etiqueta="Por qué no está disponible">
              <select
                id="dir-no-disponible" value={e.razonNoDisponible ?? ''}
                onChange={ev => setE({
                  ...e, razonNoDisponible: (ev.target.value || null) as Estado['razonNoDisponible'],
                  pausaHasta: null,
                })}
                className={SELECT}
              >
                <option value="">Elegir…</option>
                {RAZONES_NO_DISPONIBLE.map(r => (
                  <option key={r} value={r}>{ETIQUETA_NO_DISPONIBLE[r]}</option>
                ))}
              </select>
            </Campo>
          )}

          {e.razonNoDisponible === 'pausa' && (
            <>
              <Campo controlId="dir-pausa-hasta" etiqueta="Vuelve el">
                <input
                  type="date"
                  id="dir-pausa-hasta" value={e.pausaHasta ?? ''}
                  onChange={ev => setE({ ...e, pausaHasta: ev.target.value || null })}
                  className={TEXTO}
                />
              </Campo>
              {puedeNotas && (
                <Nota controlId="dir-nota-pausa" etiqueta="Por qué la pausa" obligatoria
                  valor={e.notaPausa} onChange={v => setE({ ...e, notaPausa: v })} />
              )}
            </>
          )}
        </>
      )}

      {/* ── La banderita, que convive con cualquier estado ──────────── */}
      {puedeBanderita && (
        <div className="rounded-xl bg-surface-low p-3.5 space-y-2.5">
          <p className="flex items-center gap-1.5 text-[13px] font-bold text-navy font-display">
            <Flag size={14} className="text-coral-deep" aria-hidden="true" />
            En revisión
          </p>
          <p className="text-[13px] text-navy-light/80 font-body">
            Convive con cualquier estado y no la ve el dirigente.
          </p>
          <div className="space-y-1.5">
            {RAZONES_DE_REVISION.map(r => (
              <label key={r} className="flex items-center gap-2 text-[13px] text-navy font-body">
                <input
                  type="checkbox"
                  checked={e.revision.includes(r)}
                  onChange={ev => setE({
                    ...e,
                    revision: ev.target.checked
                      ? [...e.revision, r]
                      : e.revision.filter(x => x !== r) as RazonDeRevision[],
                  })}
                />
                {ETIQUETA_REVISION[r]}
              </label>
            ))}
          </div>
          {puedeNotas && e.revision.length > 0 && (
            <Nota controlId="dir-nota-revision" etiqueta="Nota de la revisión" valor={e.notaRevision}
              onChange={v => setE({ ...e, notaRevision: v })} />
          )}
        </div>
      )}

      {puedeNotas && (
        <Nota controlId="dir-nota-general" etiqueta="Nota general (confidencial)" valor={e.notaGeneral}
          onChange={v => setE({ ...e, notaGeneral: v })} />
      )}

      {motivo && (
        <p className="text-[13px] text-coral-deep font-body" role="alert">{motivo}</p>
      )}

      <Button onClick={guardar} disabled={!!motivo || guardando} ancho="full" className="justify-center">
        {guardando
          ? <><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Guardando…</>
          : 'Guardar estado'}
      </Button>
    </div>
  )
}
