'use client'

import { useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import type { Application, ApplicationStatus } from '@/types/server'
import { useServers } from '@/hooks/useServers'
import { cn } from '@/lib/utils'
import { TOAST_LONG_MS } from '@/lib/constants'
import { Check, Users } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { Modal } from '@/components/shared/Modal'
import { VACANCY_STATE_BADGE, VACANCY_STATE_LABEL } from '@/lib/servers/vacancy-states'
import { formatDate } from '@/lib/format'
import { PanelDeAplicacion } from '@/components/servers/PanelDeAplicacion'
import {
  APPLICATION_STATE_BADGE, APPLICATION_STATE_LABEL,
} from '@/lib/servers/application-states'

type Tab = 'descripcion' | 'aplicaciones'

// SRV-14 · Las etiquetas y los colores salen del módulo compartido. Estaban
// escritos a mano en DOS pantallas, así que el mismo estado se llamaba
// «Aprobada» en una y «Aceptada» en la otra — y el estado nuevo habría hecho
// falta agregarlo en los dos lados.
const APP_STATUS_COLORS = APPLICATION_STATE_BADGE
const APP_STATUS_LABELS = APPLICATION_STATE_LABEL

const VACANCY_STATUS_COLORS: Record<string, string> = VACANCY_STATE_BADGE
const VACANCY_STATUS_LABELS: Record<string, string> = VACANCY_STATE_LABEL

export default function VacanteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { vacancies, applications, refetch } = useServers('vacancies', 'applications')

  const vacancy = useMemo(() => vacancies.find(v => v.id === id), [vacancies, id])
  const initialApps = useMemo(
    () => applications.filter(a => a.vacancy_id === id),
    [applications, id]
  )

  const [tab, setTab] = useState<Tab>('descripcion')
  // Copia local porque abajo se editan estados de forma optimista. Se
  // resincroniza cuando el server manda otra lista, ajustando DURANTE el render
  // en vez de en un efecto: así no queda un frame con la lista vieja.
  const [apps, setApps] = useState<Application[]>(initialApps)
  const [appsDelServer, setAppsDelServer] = useState(initialApps)
  if (appsDelServer !== initialApps) { setAppsDelServer(initialApps); setApps(initialApps) }
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)
  // Los modales de «Asignar al puesto» y «No seleccionar» se fueron con el
  // panel viejo: hacían `approved` y `rejected` a secas, que es lo que hace el
  // panel compartido con tres estados más. La «fecha de inicio» de aquel modal
  // tampoco se perdió — nunca se mandaba al servidor.
  const [toast, setToast] = useState<string | null>(null)
  const [closeVacancyOpen, setCloseVacancyOpen] = useState(false)
  const [closeReason, setCloseReason] = useState('')
  const [vacancyClosed, setVacancyClosed] = useState(false)

  if (!vacancy) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <p className="text-sm text-navy-light/80 font-body">
          Puesto no encontrado.
        </p>
      </div>
    )
  }

  async function changeStatus(appId: string, status: ApplicationStatus) {
    // Optimista en UI; persiste en la BD y refresca para reflejar slots/volunteer.
    setApps(prev => prev.map(a => a.id === appId ? { ...a, status } : a))
    if (selectedApp?.id === appId) setSelectedApp(prev => prev ? { ...prev, status } : null)
    try {
      const res = await fetch(`/api/servers/applications/${appId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('No se pudo actualizar la aplicación')
      await refetch()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Error al actualizar')
    }
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), TOAST_LONG_MS)
  }

  const counts = {
    total:     apps.length,
    pending:   apps.filter(a => a.status === 'pending').length,
    reviewing: apps.filter(a => a.status === 'reviewing').length,
    approved:  apps.filter(a => a.status === 'approved').length,
    rejected:  apps.filter(a => a.status === 'rejected').length,
  }

  const slotsLeft = vacancy.slots_total - vacancy.slots_filled

  async function handleCloseVacancy() {
    setVacancyClosed(true)
    setCloseVacancyOpen(false)
    try {
      const res = await fetch(`/api/servers/vacancies/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cerrada' }),
      })
      if (!res.ok) throw new Error('No se pudo cerrar el puesto')
      await refetch()
    } catch (e) {
      setVacancyClosed(false)
      showToast(e instanceof Error ? e.message : 'Error al cerrar el puesto')
    }
  }

  return (
    <div className="page">
      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full px-5 py-3 shadow-lg bg-surface-card border border-[var(--outline-variant)]"
        >
          <Check size={14} className="text-teal-deep shrink-0" />
          <span className="text-sm text-navy font-body">{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="ph">
        <button className="btn btn-ghost btn-sm mb-[10px]" onClick={() => window.history.back()}>
          ← Volver a puestos de servicio
        </button>
        <div className="ph-row">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="rounded-full bg-navy/10 px-2.5 py-0.5 text-[11px] font-semibold text-navy-light/80 font-display">
                {vacancy.committee_name}
              </span>
              <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold font-display', vacancyClosed ? VACANCY_STATUS_COLORS['cerrada'] : VACANCY_STATUS_COLORS[vacancy.status])}>
                {vacancyClosed ? 'Cerrada' : VACANCY_STATUS_LABELS[vacancy.status]}
              </span>
              {vacancy.published_at && (
                <span className="text-[13px] text-navy-light/80 font-body">
                  Publicada {formatDate(vacancy.published_at)}
                </span>
              )}
            </div>
            <h1 className="ptitle">{vacancy.title}</h1>
            <div className="psub">{vacancy.position} · {slotsLeft} cupo{slotsLeft !== 1 ? 's' : ''} disponible{slotsLeft !== 1 ? 's' : ''}</div>
          </div>
          <div className="ph-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => window.location.href = `/servidores/vacantes/${id}/editar`}>Editar publicación</button>
            {!vacancyClosed && vacancy.status !== 'cerrada' && (
              <button className="btn btn-ghost btn-sm text-coral border-[rgba(214,62,61,0.3)]" onClick={() => setCloseVacancyOpen(true)}>
                Cerrar puesto
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs card */}
      <div className="card">
        <div className="flex overflow-x-auto border-b border-[rgba(22,20,64,0.09)] py-0 px-1">
        {(['descripcion', 'aplicaciones'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'shrink-0 whitespace-nowrap px-5 py-3 text-sm capitalize transition-colors border-b-2 -mb-px font-display',
              tab === t
                ? 'border-coral text-navy font-semibold'
                : 'border-transparent text-navy-light/80 hover:text-navy'
            )}
          >
            {t === 'descripcion' ? 'Descripción' : `Aplicaciones (${counts.total})`}
          </button>
        ))}
        </div>

      {/* Tab: Descripción */}
      {tab === 'descripcion' && (
        <div className="space-y-5 py-4 px-[22px]">
          {/* Descripción y funciones vienen del PUESTO (no de la vacante). Para
              vacantes viejas que tenían texto propio, se usa ese como fallback. */}
          {(vacancy.position_description || vacancy.description) && (
            <div className="space-y-2">
              <p className="text-[13px] tracking-widest uppercase text-navy-light/80 font-display">
                Descripción
              </p>
              <p className="text-sm text-navy leading-relaxed font-body whitespace-pre-line">
                {vacancy.position_description || vacancy.description}
              </p>
            </div>
          )}

          {vacancy.position_functions ? (
            <div className="space-y-2">
              <p className="text-[13px] tracking-widest uppercase text-navy-light/80 font-display">
                Funciones principales
              </p>
              <p className="text-sm text-navy leading-relaxed font-body whitespace-pre-line">
                {vacancy.position_functions}
              </p>
            </div>
          ) : vacancy.functions.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[13px] tracking-widest uppercase text-navy-light/80 font-display">
                Funciones principales
              </p>
              <ul className="space-y-1.5">
                {vacancy.functions.map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-coral shrink-0" />
                    <span className="text-sm text-navy font-body">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {vacancy.position_profile && (
            <div className="space-y-2">
              <p className="text-[13px] tracking-widest uppercase text-navy-light/80 font-display">
                Perfil
              </p>
              <p className="text-sm text-navy leading-relaxed font-body whitespace-pre-line">
                {vacancy.position_profile}
              </p>
            </div>
          )}

          {vacancy.position_skills && (
            <div className="space-y-2">
              <p className="text-[13px] tracking-widest uppercase text-navy-light/80 font-display">
                Habilidades
              </p>
              <p className="text-sm text-navy leading-relaxed font-body whitespace-pre-line">
                {vacancy.position_skills}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-[13px] tracking-widest uppercase text-navy-light/80 font-display">
                Horario
              </p>
              <p className="text-sm text-navy font-body">{vacancy.schedule}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[13px] tracking-widest uppercase text-navy-light/80 font-display">
                Compromiso
              </p>
              <p className="text-sm text-navy font-body">{vacancy.commitment}</p>
            </div>
            {vacancy.position_study_requirement && (
              <div className="space-y-1">
                <p className="text-[13px] tracking-widest uppercase text-navy-light/80 font-display">
                  Nivel requerido
                </p>
                <p className="text-sm text-navy font-body">{vacancy.position_study_requirement}</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Tab: Aplicaciones */}
      {tab === 'aplicaciones' && (
        <div className="space-y-4 py-4 px-[22px]">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              ['Total', counts.total, 'text-navy'],
              ['Pendientes', counts.pending, 'text-amber-600'],
              ['En revisión', counts.reviewing, 'text-navy'],
              ['Aprobadas', counts.approved, 'text-teal-deep'],
              ['No selec.', counts.rejected, 'text-coral'],
            ].map(([label, value, color]) => (
              <div
                key={label as string}
                className="rounded-xl p-3 text-center bg-surface-card shadow-[var(--shadow-md)]"
              >
                <p className={cn('text-2xl font-extrabold tabular-nums font-display', color as string)}>
                  {value as number}
                </p>
                <p className="text-[11px] text-navy-light/80 mt-0.5 font-display">
                  {label as string}
                </p>
              </div>
            ))}
          </div>

          {/* Table + panel */}
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Table */}
            <div
              className={cn('rounded-2xl overflow-hidden transition-all duration-200 bg-surface-card shadow-[var(--shadow-md)]', selectedApp ? 'flex-1' : 'w-full')}
            >
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {['Aplicante', 'Fecha', 'Estado', ''].map(h => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-[11px] tracking-widest uppercase text-navy-light/80 font-display"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {apps.map((a, idx) => (
                      <tr
                        key={a.id}
                        onClick={() => setSelectedApp(selectedApp?.id === a.id ? null : a)}
                        className={cn(
                          'cursor-pointer transition-colors',
                          selectedApp?.id === a.id ? 'bg-coral/5' : idx % 2 === 1 ? 'bg-surface-low/40' : '',
                          'hover:bg-navy/5'
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-navy flex items-center justify-center shrink-0">
                              <span className="text-[11px] font-bold text-white font-display">
                                {a.applicant_initials}
                              </span>
                            </div>
                            <span className="text-sm font-medium text-navy font-body">
                              {a.applicant_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-navy-light/80 whitespace-nowrap font-body">
                          {formatDate(a.applied_at)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold font-display', APP_STATUS_COLORS[a.status])}
                          >
                            {APP_STATUS_LABELS[a.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={e => { e.stopPropagation(); changeStatus(a.id, 'reviewing') }}
                            className={cn(
                              'text-[13px] text-navy-light/80 hover:text-navy transition-colors font-body',
                              a.status !== 'pending' && 'opacity-0 pointer-events-none'
                            )}
                          >
                            Revisar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {apps.length === 0 && (
                <EmptyState icon={Users} title="No hay aplicaciones todavía" />
              )}
            </div>

            {/* SRV-14 · El MISMO panel que la bandeja de Aplicaciones de
                Servicio. Antes era otro, con dos botones —«Asignar al puesto»
                y «No seleccionar»— y dos campos DECORATIVOS: la fecha de
                inicio y las notas internas no se mandaban a ningún lado. Se
                escribían y se perdían al cerrar, y nadie lo notaba porque al
                reabrir mostraban lo de la base, que siempre estaba vacío.

                El panel compartido cubre los dos botones que sí hacían algo
                (eran `approved` y `rejected` a secas), agrega los otros tres
                estados, y la nota ahora se guarda de verdad. */}
            {selectedApp && (
              <PanelDeAplicacion
                app={selectedApp}
                puedeGestionar
                onClose={() => setSelectedApp(null)}
                onSaved={() => { setSelectedApp(null); void refetch() }}
                onError={showToast}
              />
            )}
          </div>
        </div>
      )}


      </div>{/* end .card */}

      {/* ── Modal: Cerrar puesto ── */}
      {closeVacancyOpen && (
        <Modal onClose={() => setCloseVacancyOpen(false)} titleId="close-vacancy-title" width={384}>
          <div className="p-6 space-y-4">
            <p id="close-vacancy-title" className="text-base font-bold text-navy font-display">Cerrar puesto</p>
            <p className="text-sm text-navy-light/80 font-body">
              La vacante <strong>{vacancy.title}</strong> será marcada como cerrada y dejará de recibir aplicaciones.
            </p>
            <div className="space-y-1">
              <label htmlFor="motivo-de-cierre-opcional" className="text-[13px] tracking-widest uppercase text-navy-light/80 font-display">Motivo de cierre (opcional)</label>
              <textarea id="motivo-de-cierre-opcional"
                className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none resize-none font-body"
                rows={2}
                placeholder="¿Por qué se cierra este puesto?"
                value={closeReason}
                onChange={e => setCloseReason(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCloseVacancyOpen(false)} className="flex-1 rounded-xl border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body">Cancelar</button>
              <button onClick={handleCloseVacancy} className="flex-1 rounded-full bg-coral shadow-[var(--shadow-pulse-sm)] py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body">Cerrar puesto</button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  )
}
