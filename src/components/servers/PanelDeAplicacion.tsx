'use client'

/**
 * SRV-14 · El panel para revisar una aplicación.
 *
 * ESTÁ ACÁ Y NO EN UNA PANTALLA porque lo usan DOS: el tab de aplicaciones de
 * una vacante y la bandeja de «Aplicaciones de Servicio». Eran dos paneles
 * distintos con la misma intención, y ya se había visto a dónde lleva eso —
 * las etiquetas de estado estaban escritas a mano en los dos lados y el mismo
 * estado se llamaba «Aprobada» en uno y «Aceptada» en el otro.
 *
 * DOS COSAS QUE CAMBIAN RESPECTO DEL PANEL VIEJO:
 *
 *  1. LA NOTA SOLO APARECE EN «EN REVISIÓN». Antes había un cuadro de «notas
 *     internas» siempre visible… que no guardaba nada: escribía en un estado
 *     local que nadie mandaba al servidor, y al cerrar el panel se perdía.
 *     Nadie lo notó porque al reabrir mostraba el `notes` de la base, que
 *     siempre estaba vacío. Ahora se guarda, y solo se pide donde se lee: la
 *     nota de una revisión viaja en el correo a RH y queda en el registro.
 *  2. SE PUEDE MOVER A CUALQUIER ESTADO VÁLIDO, no solo aprobar o rechazar.
 *     La única transición que no existe es salir de «aceptada»: eso ya dio de
 *     alta a la persona en el puesto y con permisos.
 */

import { useState } from 'react'
import Link from 'next/link'
import { X, Printer } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Application, ApplicationStatus } from '@/types/server'
import {
  APPLICATION_STATE_LABEL, APPLICATION_STATE_BADGE, APPLICATION_STATE_HELP,
  estadosDestino, admiteMotivo,
} from '@/lib/servers/application-states'
import { mensajeDeLaRespuesta } from '@/lib/api/mensaje-del-error'

export function PanelDeAplicacion({
  app, puedeGestionar, onClose, onSaved, onError, dentroDeModal = false,
}: {
  app: Application
  /** VER no es GESTIONAR: dirección abre el panel pero no cambia estados. */
  puedeGestionar: boolean
  onClose: () => void
  /**
   * Cambia dos cosas, y las dos por el mismo motivo: adentro de un Modal, el
   * Modal ya pone la X y ya es la tarjeta.
   *
   *  · NO dibuja su propia X — dos equis pegadas en la misma esquina se leen
   *    como un error de la pantalla.
   *  · NO dibuja su fondo, su sombra ni su ancho fijo — serían una tarjeta
   *    dentro de otra, con dos bordes y dos sombras.
   *
   * Como panel LATERAL (el tab de la vacante) necesita las dos: ahí no hay
   * Modal que las ponga.
   */
  dentroDeModal?: boolean
  onSaved: (estado: ApplicationStatus) => void
  onError: (mensaje: string) => void
}) {
  const [estado, setEstado] = useState<ApplicationStatus | ''>('')
  const [motivo, setMotivo] = useState(app.notes ?? '')
  const [guardando, setGuardando] = useState(false)
  const opciones = estadosDestino(app.status)

  async function guardar() {
    if (!estado) return
    setGuardando(true)
    try {
      const res = await fetch(`/api/servers/applications/${app.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: estado,
          ...(admiteMotivo(estado) && motivo.trim() ? { motivo: motivo.trim() } : {}),
        }),
      })
      if (!res.ok) throw new Error(await mensajeDeLaRespuesta(res, 'No se pudo cambiar el estado.'))
      onSaved(estado)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'No se pudo cambiar el estado.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className={cn(
      'space-y-4',
      dentroDeModal
        ? 'w-full'
        : 'w-full lg:w-80 shrink-0 rounded-2xl p-4 bg-surface-card shadow-[var(--shadow-md)]',
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-10 w-10 rounded-full bg-navy flex items-center justify-center shrink-0">
            <span className="text-[13px] font-bold text-white font-display">{app.applicant_initials}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-navy font-display truncate">{app.applicant_name}</p>
            <Link href={`/miembros/${app.applicant_id}`} className="text-[13px] text-coral hover:underline font-body">
              Ver perfil
            </Link>
          </div>
        </div>
        {!dentroDeModal && (
          <button onClick={onClose} aria-label="Cerrar" className="text-navy-light/80 hover:text-navy transition-colors shrink-0">
            <X size={15} />
          </button>
        )}
      </div>

      <div className="space-y-1">
        <span className={cn('inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold font-display', APPLICATION_STATE_BADGE[app.status])}>
          {APPLICATION_STATE_LABEL[app.status]}
        </span>
        <p className="text-[13px] text-navy-light/80 font-body">{app.vacancy_title} · {app.committee_name}</p>
      </div>

      <Link
        href={`/servidores/aplicaciones/${app.id}/hoja`}
        className="inline-flex items-center gap-1.5 text-[13px] text-navy-light/80 hover:text-coral transition-colors font-body underline"
      >
        <Printer size={13} aria-hidden="true" /> Ver la hoja para imprimir
      </Link>

      {app.service_history.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
            Historial de servicio
          </p>
          {app.service_history.map((h, i) => (
            <div key={i} className="rounded-lg px-2.5 py-2 space-y-0.5 bg-surface-low">
              <p className="text-[13px] font-medium text-navy font-body">{h.position}</p>
              <p className="text-[13px] text-navy-light/80 font-body">{h.committee} · {h.period}</p>
            </div>
          ))}
        </div>
      )}

      {/* La nota que ya está guardada se muestra siempre; el cuadro para
          ESCRIBIRLA aparece solo al elegir «en revisión». */}
      {app.notes?.trim() && (
        <div className="space-y-1">
          <p className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">Nota interna</p>
          <p className="text-[13px] text-navy-light/80 font-body whitespace-pre-line">{app.notes}</p>
        </div>
      )}

      {!puedeGestionar ? (
        <p className="text-[13px] text-navy-light/80 font-body">
          Tu acceso a esta bandeja es de lectura.
        </p>
      ) : opciones.length === 0 ? (
        <p className="text-[13px] text-navy-light/80 font-body">
          Ya fue aceptada y la persona quedó asignada al puesto. Para revertirlo hay que
          quitarla del puesto desde el comité.
        </p>
      ) : (
        <div className="space-y-2 pt-1 border-t border-[var(--outline-variant)]">
          <p className="pt-2 text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
            Cambiar el estado
          </p>
          <div className="space-y-0.5">
            {opciones.map(o => (
              <label key={o} className="flex items-start gap-2 cursor-pointer rounded-lg p-1.5 hover:bg-surface-low">
                <input
                  type="radio"
                  name={`estado-${app.id}`}
                  checked={estado === o}
                  onChange={() => setEstado(o)}
                  className="accent-coral mt-1 shrink-0"
                />
                <span className="min-w-0">
                  <span className="block text-[13px] text-navy font-body">{APPLICATION_STATE_LABEL[o]}</span>
                  <span className="block text-[13px] text-navy-light/80 font-body">{APPLICATION_STATE_HELP[o]}</span>
                </span>
              </label>
            ))}
          </div>

          {estado && admiteMotivo(estado) && (
            <div className="space-y-1">
              <label htmlFor={`nota-${app.id}`} className="block text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
                Nota interna
              </label>
              <textarea
                id={`nota-${app.id}`}
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="¿Por qué queda en revisión?"
                className="w-full rounded-xl bg-surface-low px-3 py-2 text-[13px] text-navy outline-none focus:ring-1 focus:ring-coral/30 resize-none font-body"
              />
              <p className="text-[13px] text-navy-light/80 font-body">
                Va en el correo a RH y al staff, y queda guardada.
              </p>
            </div>
          )}

          <button
            onClick={() => void guardar()}
            disabled={guardando || !estado}
            className="w-full rounded-full bg-coral shadow-[var(--shadow-pulse-sm)] px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40 font-body"
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      )}
    </div>
  )
}
