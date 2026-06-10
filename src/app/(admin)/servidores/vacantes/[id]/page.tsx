'use client'

import { useState, useMemo, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import type { Application, ApplicationStatus } from '@/types/server'
import { useServers } from '@/hooks/useServers'
import { cn } from '@/lib/utils'
import { TOAST_LONG_MS } from '@/lib/constants'
import { ChevronLeft, X, Check, Users } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'

type Tab = 'descripcion' | 'aplicaciones'

const APP_STATUS_COLORS: Record<ApplicationStatus, string> = {
  pending:   'bg-amber-500/10 text-amber-600',
  reviewing: 'bg-navy/10 text-navy',
  approved:  'bg-teal-deep/10 text-teal-deep',
  rejected:  'bg-coral/10 text-coral',
}

const APP_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending:   'Pendiente',
  reviewing: 'En revisión',
  approved:  'Aprobada',
  rejected:  'No seleccionada',
}

const VACANCY_STATUS_COLORS: Record<string, string> = {
  draft:     'bg-navy-light/10 text-navy-light/50',
  published: 'bg-teal-deep/10 text-teal-deep',
  filled:    'bg-navy/10 text-navy',
  closed:    'bg-coral/10 text-coral',
}
const VACANCY_STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador', published: 'Publicada', filled: 'Ocupada', closed: 'Cerrada',
}

export default function VacanteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { vacancies, applications, refetch } = useServers()

  const vacancy = useMemo(() => vacancies.find(v => v.id === id), [vacancies, id])
  const initialApps = useMemo(
    () => applications.filter(a => a.vacancy_id === id),
    [applications, id]
  )

  const [tab, setTab] = useState<Tab>('descripcion')
  const [apps, setApps] = useState<Application[]>([])
  useEffect(() => { setApps(initialApps) }, [initialApps])
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)
  const [panelNotes, setPanelNotes] = useState<Record<string, string>>({})
  const [assignModal, setAssignModal] = useState<Application | null>(null)
  const [assignDate, setAssignDate] = useState(new Date().toISOString().split('T')[0])
  const [rejectModal, setRejectModal] = useState<Application | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [closeVacancyOpen, setCloseVacancyOpen] = useState(false)
  const [closeReason, setCloseReason] = useState('')
  const [vacancyClosed, setVacancyClosed] = useState(false)

  if (!vacancy) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <p className="text-sm text-navy-light/50 font-body">
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

  async function handleAssign() {
    if (!assignModal) return
    const name = assignModal.applicant_name
    setAssignModal(null)
    await changeStatus(assignModal.id, 'approved')
    showToast(`Servidor asignado · Notificación de bienvenida enviada a ${name}`)
  }

  async function handleReject() {
    if (!rejectModal) return
    const appId = rejectModal.id
    setRejectModal(null)
    setRejectReason('')
    await changeStatus(appId, 'rejected')
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
        body: JSON.stringify({ status: 'closed' }),
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
              <span className="rounded-full bg-navy/10 px-2.5 py-0.5 text-[10px] font-semibold text-navy-light/60 font-display">
                {vacancy.committee_name}
              </span>
              <span className={cn('rounded-full px-2.5 py-0.5 text-[10px] font-semibold font-display', vacancyClosed ? VACANCY_STATUS_COLORS['closed'] : VACANCY_STATUS_COLORS[vacancy.status])}>
                {vacancyClosed ? 'Cerrada' : VACANCY_STATUS_LABELS[vacancy.status]}
              </span>
              {vacancy.published_at && (
                <span className="text-[11px] text-navy-light/60 font-body">
                  Publicada {new Date(vacancy.published_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
            <div className="ptitle">{vacancy.title}</div>
            <div className="psub">{vacancy.position} · {slotsLeft} cupo{slotsLeft !== 1 ? 's' : ''} disponible{slotsLeft !== 1 ? 's' : ''}</div>
          </div>
          <div className="ph-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => window.location.href = `/servidores/vacantes/${id}/editar`}>Editar publicación</button>
            {!vacancyClosed && vacancy.status !== 'closed' && (
              <button className="btn btn-ghost btn-sm text-coral border-[rgba(239,85,84,0.3)]" onClick={() => setCloseVacancyOpen(true)}>
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
                : 'border-transparent text-navy-light/50 hover:text-navy'
            )}
          >
            {t === 'descripcion' ? 'Descripción' : `Aplicaciones (${counts.total})`}
          </button>
        ))}
        </div>

      {/* Tab: Descripción */}
      {tab === 'descripcion' && (
        <div className="space-y-5 py-4 px-[22px]">
          <div className="space-y-2">
            <p className="text-[11px] tracking-widest uppercase text-navy-light/40 font-display">
              Descripción
            </p>
            <p className="text-sm text-navy leading-relaxed font-body">
              {vacancy.description}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] tracking-widest uppercase text-navy-light/40 font-display">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-[11px] tracking-widests uppercase text-navy-light/40 font-display">
                Horario
              </p>
              <p className="text-sm text-navy font-body">{vacancy.schedule}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] tracking-widests uppercase text-navy-light/40 font-display">
                Compromiso
              </p>
              <p className="text-sm text-navy font-body">{vacancy.commitment}</p>
            </div>
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
                <p className="text-[10px] text-navy-light/40 mt-0.5 font-display">
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
                          className="px-4 py-3 text-left text-[10px] tracking-widests uppercase text-navy-light/50 font-display"
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
                              <span className="text-[10px] font-bold text-white font-display">
                                {a.applicant_initials}
                              </span>
                            </div>
                            <span className="text-sm font-medium text-navy font-body">
                              {a.applicant_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[12px] text-navy-light/60 whitespace-nowrap font-body">
                          {new Date(a.applied_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold font-display', APP_STATUS_COLORS[a.status])}
                          >
                            {APP_STATUS_LABELS[a.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={e => { e.stopPropagation(); changeStatus(a.id, 'reviewing') }}
                            className={cn(
                              'text-[11px] text-navy-light/50 hover:text-navy transition-colors font-body',
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

            {/* Detail panel */}
            {selectedApp && (
              <div
                className="w-full lg:w-72 shrink-0 rounded-2xl p-4 space-y-4 bg-surface-card shadow-[var(--shadow-md)]"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-navy flex items-center justify-center">
                      <span className="text-[11px] font-bold text-white font-display">
                        {selectedApp.applicant_initials}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-navy font-display">
                        {selectedApp.applicant_name}
                      </p>
                      <Link
                        href={`/miembros/${selectedApp.applicant_id}`}
                        className="text-[11px] text-coral hover:underline font-body"
                      >
                        Ver perfil
                      </Link>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedApp(null)}
                    className="text-navy-light/40 hover:text-navy transition-colors"
                  >
                    <X size={15} />
                  </button>
                </div>

                <span
                  className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold font-display', APP_STATUS_COLORS[selectedApp.status])}
                >
                  {APP_STATUS_LABELS[selectedApp.status]}
                </span>

                {/* Service history */}
                {selectedApp.service_history.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] tracking-widests uppercase text-navy-light/40 font-display">
                      Historial de servicio
                    </p>
                    {selectedApp.service_history.map((h, i) => (
                      <div key={i} className="rounded-lg px-2.5 py-2 space-y-0.5 bg-surface-low">
                        <p className="text-[12px] font-medium text-navy font-body">
                          {h.position}
                        </p>
                        <p className="text-[11px] text-navy-light/50 font-body">
                          {h.committee} · {h.period}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Internal notes */}
                <div className="space-y-1.5">
                  <p className="text-[10px] tracking-widests uppercase text-navy-light/40 font-display">
                    Notas internas
                  </p>
                  <textarea
                    className="w-full rounded-xl bg-surface-low px-3 py-2 text-[12px] text-navy outline-none focus:ring-1 focus:ring-coral/30 resize-none font-body"
                    rows={3}
                    placeholder="Agrega notas sobre esta aplicación..."
                    value={panelNotes[selectedApp.id] ?? selectedApp.notes}
                    onChange={e => setPanelNotes(prev => ({ ...prev, [selectedApp.id]: e.target.value }))}
                  />
                </div>

                {/* Actions */}
                {selectedApp.status !== 'approved' && selectedApp.status !== 'rejected' && (
                  <div className="space-y-2 pt-1">
                    <button
                      onClick={() => setAssignModal(selectedApp)}
                      className="w-full rounded-xl bg-teal-deep py-2 text-sm text-white hover:bg-teal-deep/90 transition-colors font-body"
                    >
                      Asignar al puesto
                    </button>
                    <button
                      onClick={() => setRejectModal(selectedApp)}
                      className="w-full rounded-xl border py-2 text-sm text-coral hover:bg-coral/5 transition-colors border-[var(--outline-variant)] font-body"
                    >
                      No seleccionar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Assign modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-ink/60 backdrop-blur-sm">
          <div
            className="w-full max-w-sm rounded-2xl p-6 space-y-4 bg-surface-card shadow-[var(--shadow-md)]"
          >
            <div className="flex items-start justify-between">
              <p className="text-base font-bold text-navy font-display">
                Confirmar asignación
              </p>
              <button onClick={() => setAssignModal(null)} className="text-navy-light/40 hover:text-navy">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-navy-light/70 font-body">
              Asignar a <strong>{assignModal.applicant_name}</strong> al puesto de{' '}
              <strong>{vacancy.position}</strong> en {vacancy.committee_name}.
            </p>
            <div className="space-y-1">
              <label className="text-[11px] tracking-widests uppercase text-navy-light/40 font-display">
                Fecha de inicio
              </label>
              <input
                type="date"
                className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none font-body"
                value={assignDate}
                onChange={e => setAssignDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setAssignModal(null)}
                className="flex-1 rounded-xl border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
              >
                Cancelar
              </button>
              <button
                onClick={handleAssign}
                className="flex-1 rounded-xl bg-teal-deep py-2.5 text-sm text-white hover:bg-teal-deep/90 transition-colors font-body"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      </div>{/* end .card */}

      {/* ── Modal: Cerrar puesto ── */}
      {closeVacancyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-ink/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4 bg-surface-card shadow-[var(--shadow-md)]">
            <div className="flex items-start justify-between">
              <p className="text-base font-bold text-navy font-display">Cerrar puesto</p>
              <button onClick={() => setCloseVacancyOpen(false)} className="text-navy-light/40 hover:text-navy"><X size={18} /></button>
            </div>
            <p className="text-sm text-navy-light/70 font-body">
              La vacante <strong>{vacancy.title}</strong> será marcada como cerrada y dejará de recibir aplicaciones.
            </p>
            <div className="space-y-1">
              <label className="text-[11px] tracking-widest uppercase text-navy-light/40 font-display">Motivo de cierre (opcional)</label>
              <textarea
                className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none resize-none font-body"
                rows={2}
                placeholder="¿Por qué se cierra este puesto?"
                value={closeReason}
                onChange={e => setCloseReason(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCloseVacancyOpen(false)} className="flex-1 rounded-xl border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body">Cancelar</button>
              <button onClick={handleCloseVacancy} className="flex-1 rounded-xl bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body">Cerrar puesto</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-ink/60 backdrop-blur-sm">
          <div
            className="w-full max-w-sm rounded-2xl p-6 space-y-4 bg-surface-card shadow-[var(--shadow-md)]"
          >
            <div className="flex items-start justify-between">
              <p className="text-base font-bold text-navy font-display">
                No seleccionar aplicante
              </p>
              <button onClick={() => setRejectModal(null)} className="text-navy-light/40 hover:text-navy">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-navy-light/70 font-body">
              {rejectModal.applicant_name} será marcado como no seleccionado para este puesto.
            </p>
            <div className="space-y-1">
              <label className="text-[11px] tracking-widests uppercase text-navy-light/40 font-display">
                Motivo (opcional)
              </label>
              <textarea
                className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none resize-none font-body"
                rows={2}
                placeholder="¿Por qué no fue seleccionado?"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setRejectModal(null)}
                className="flex-1 rounded-xl border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
              >
                Cancelar
              </button>
              <button
                onClick={handleReject}
                className="flex-1 rounded-xl bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
