'use client'

import { useState } from 'react'
import { ArrowLeftRight, BookOpen, Loader2 } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { useToast } from '@/components/shared/Toast'
import { isRelocationEligibleCode } from '@/lib/studies/eligibility'
import { cn } from '@/lib/utils'
import type { StudyRequestType } from '@/types/study'

/**
 * Botones "Solicitar reubicación" / "Me interesa un estudio" (este último
 * consolida los viejos "Unirme a un grupo" y "Solicitar estudio en mi zona",
 * migración 050). Visibles para cualquier rol; la elegibilidad de estudios se
 * calcula para el MIEMBRO del perfil (o el seleccionado por el coordinador)
 * vía /api/studies/eligibility (getEligibleStudiesForMember, centralizada).
 */

type EligiblePlan = { id: string; code: string; name: string; stage: string }
type ActiveEnrollment = { group_id: string; group_name: string; plan_code: string | null }
type Eligibility = {
  active_enrollments: ActiveEnrollment[]
  eligible_plans: EligiblePlan[]
  commitments: { is_donor: boolean; attendance_active: boolean; is_server: boolean }
}
type Group = {
  id: string
  name: string
  status: string
  plan: { code: string | null } | null
}

const MIN_REASON = 20

const SELECT_CLS = 'w-full rounded-xl border border-outline bg-surface-low px-3 py-2.5 text-sm text-navy font-body outline-none focus:ring-1 focus:ring-coral/30 disabled:opacity-60'
const LABEL_CLS = 'block text-[12px] font-medium text-navy-light/70 font-body mb-1.5'

export function StudyRequestActions({ memberId }: { memberId: string }) {
  const toast = useToast()
  const [openModal, setOpenModal] = useState<StudyRequestType | null>(null)
  const [eligibility, setEligibility] = useState<Eligibility | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  const [planId, setPlanId] = useState('')
  const [targetGroupId, setTargetGroupId] = useState('')
  // null = sin tocar por el usuario → se autocompleta con el primer grupo activo.
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null)
  const [location, setLocation] = useState('')
  const [schedule, setSchedule] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Carga por miembro (el coordinador puede cambiar de miembro entre aperturas).
  function loadData() {
    if (loadedFor === memberId || dataLoading) return
    setDataLoading(true)
    Promise.all([
      fetch(`/api/studies/eligibility?member_id=${memberId}`),
      fetch('/api/studies/groups'),
    ])
      .then(async ([e, g]) => {
        if (e.ok) setEligibility(await e.json())
        if (g.ok) setGroups(((await g.json()) as Group[]).filter(gr => gr.status === 'en_matricula' || gr.status === 'en_curso'))
        setLoadedFor(memberId)
      })
      .catch(() => {})
      .finally(() => setDataLoading(false))
  }

  function open(type: StudyRequestType) {
    setPlanId('')
    setTargetGroupId('')
    setCurrentGroupId(null)
    setLocation('')
    setSchedule('')
    setReason('')
    setError('')
    setOpenModal(type)
    loadData()
  }

  const activeEnrollments = eligibility?.active_enrollments ?? []
  const eligiblePlans = eligibility?.eligible_plans ?? []
  // Grupo destino de reubicación: solo estudios elegibles (N1–N4, DIS1–3, SCJ).
  const relocationTargets = groups.filter(g => isRelocationEligibleCode(g.plan?.code))
  const effectiveCurrentGroup = currentGroupId ?? activeEnrollments[0]?.group_id ?? ''

  // Bloqueos por elegibilidad (mensaje + submit deshabilitado).
  const relocationBlocked = !dataLoading && eligibility !== null && activeEnrollments.length === 0
  const plansBlocked = !dataLoading && eligibility !== null && eligiblePlans.length === 0
  const blocked = openModal === 'relocation' ? relocationBlocked : plansBlocked

  async function submit() {
    if (blocked) return
    if (reason.trim().length < MIN_REASON) {
      setError(`Contanos un poco más: la razón debe tener al menos ${MIN_REASON} caracteres.`)
      return
    }
    if (openModal === 'study_interest' && !planId) {
      setError('Seleccioná el plan de estudio.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/studies/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: memberId,
          request_type: openModal,
          plan_id: planId || null,
          existing_group_id: targetGroupId || null,
          current_group_id: openModal === 'relocation' ? (effectiveCurrentGroup || null) : null,
          proposed_location: openModal === 'study_interest' ? (location || null) : null,
          proposed_schedule: openModal === 'study_interest' ? (schedule || null) : null,
          reason: reason.trim(),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'No se pudo enviar la solicitud')
      }
      setOpenModal(null)
      toast('Solicitud enviada. Un coordinador la revisará pronto.', 'success')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar la solicitud')
    } finally {
      setSubmitting(false)
    }
  }

  const reasonField = (
    <div>
      <label htmlFor="request-reason" className={LABEL_CLS}>
        Razón <span className="text-coral">*</span>
      </label>
      <textarea
        id="request-reason"
        value={reason}
        onChange={e => setReason(e.target.value)}
        rows={3}
        disabled={blocked}
        placeholder="Contanos por qué (mínimo 20 caracteres)…"
        className={cn(SELECT_CLS, 'resize-none placeholder:text-navy-light/50')}
      />
      <p className={cn('mt-1 text-[11px] font-body', reason.trim().length < MIN_REASON ? 'text-navy-light/60' : 'text-success')}>
        {reason.trim().length}/{MIN_REASON} caracteres mínimos
      </p>
    </div>
  )

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => open('relocation')}
          className="inline-flex items-center gap-1.5 rounded-full bg-surface-low px-3.5 py-2 text-[13px] text-navy font-body hover:bg-navy/10 transition-colors"
        >
          <ArrowLeftRight size={13} />
          Solicitar reubicación
        </button>
        <button
          onClick={() => open('study_interest')}
          className="inline-flex items-center gap-1.5 rounded-full bg-coral px-3.5 py-2 text-[13px] text-white font-body hover:bg-coral-deep transition-colors"
        >
          <BookOpen size={13} />
          Me interesa un estudio
        </button>
      </div>

      {openModal && (
        <Modal onClose={() => setOpenModal(null)} titleId="study-request-title">
          <div className="p-6 space-y-4">
            <h2 id="study-request-title" className="text-lg font-semibold text-navy font-display">
              {openModal === 'relocation' ? 'Solicitar reubicación' : 'Me interesa un estudio'}
            </h2>

            {dataLoading || !eligibility ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={18} className="animate-spin text-navy-light/40" />
              </div>
            ) : (
              <>
                {openModal === 'relocation' && relocationBlocked && (
                  <div className="rounded-xl bg-coral/7 border border-coral/20 px-4 py-3">
                    <p className="text-[13px] text-coral font-body">
                      No tenés estudios activos elegibles para reubicación.
                    </p>
                  </div>
                )}
                {openModal === 'study_interest' && plansBlocked && (
                  <div className="rounded-xl bg-coral/7 border border-coral/20 px-4 py-3">
                    <p className="text-[13px] text-coral font-body">
                      No hay estudios disponibles para solicitar: o ya los llevaste,
                      o falta cumplir el prerequisito o los compromisos de la etapa
                      (donador y asistencia; servidor para la etapa intermedia).
                    </p>
                  </div>
                )}

                {openModal === 'relocation' && !relocationBlocked && (
                  <>
                    <div>
                      <label htmlFor="current-group" className={LABEL_CLS}>Grupo actual</label>
                      <select id="current-group" value={effectiveCurrentGroup} onChange={e => setCurrentGroupId(e.target.value)} className={SELECT_CLS}>
                        <option value="">Sin estudio seleccionado</option>
                        {activeEnrollments.map(en => (
                          <option key={en.group_id} value={en.group_id}>
                            {en.group_name}{en.plan_code ? ` (${en.plan_code})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="target-group" className={LABEL_CLS}>Grupo al que quiere ir (opcional)</label>
                      <select id="target-group" value={targetGroupId} onChange={e => setTargetGroupId(e.target.value)} className={SELECT_CLS}>
                        <option value="">Que el coordinador decida</option>
                        {relocationTargets.filter(g => g.id !== effectiveCurrentGroup).map(g => (
                          <option key={g.id} value={g.id}>{g.name}{g.plan?.code ? ` (${g.plan.code})` : ''}</option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] text-navy-light/60 font-body">
                        Solo niveles (N1–N4), discipulados (DIS1–DIS3) y SCJ admiten reubicación.
                      </p>
                    </div>
                  </>
                )}

                {openModal === 'study_interest' && !plansBlocked && (
                  <>
                    <div>
                      <label htmlFor="interest-plan" className={LABEL_CLS}>Plan de estudio <span className="text-coral">*</span></label>
                      <select id="interest-plan" value={planId} onChange={e => setPlanId(e.target.value)} className={SELECT_CLS}>
                        <option value="">Seleccionar plan…</option>
                        {eligiblePlans.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                      </select>
                      <p className="mt-1 text-[11px] text-navy-light/60 font-body">
                        Solo se muestran los estudios que aún no has llevado y para los que cumplís los requisitos.
                      </p>
                    </div>
                    <div>
                      <label htmlFor="proposed-location" className={LABEL_CLS}>Ubicación (opcional)</label>
                      <input
                        id="proposed-location"
                        value={location}
                        onChange={e => setLocation(e.target.value)}
                        placeholder="Ej: Heredia centro"
                        className={cn(SELECT_CLS, 'placeholder:text-navy-light/50')}
                      />
                    </div>
                    <div>
                      <label htmlFor="proposed-schedule" className={LABEL_CLS}>Horario tentativo (opcional)</label>
                      <input
                        id="proposed-schedule"
                        value={schedule}
                        onChange={e => setSchedule(e.target.value)}
                        placeholder="Ej: Miércoles 7pm"
                        className={cn(SELECT_CLS, 'placeholder:text-navy-light/50')}
                      />
                    </div>
                  </>
                )}

                {!blocked && reasonField}

                {error && <p className="text-[13px] text-coral font-body">{error}</p>}

                {openModal === 'study_interest' && (
                  <p className="rounded-xl bg-surface-low px-4 py-3 text-[12px] text-navy-light/70 font-body">
                    Reportar interés no implica que el estudio se vaya a abrir. El equipo
                    de estudios analiza la demanda para programar nuevos grupos.
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setOpenModal(null)}
                    className="rounded-full px-4 py-2 text-sm text-navy-light/70 font-body hover:text-navy transition-colors"
                  >
                    {blocked ? 'Cerrar' : 'Cancelar'}
                  </button>
                  {!blocked && (
                    <button
                      onClick={submit}
                      disabled={submitting}
                      className="rounded-full bg-coral px-5 py-2 text-sm text-white font-body font-medium hover:bg-coral-deep transition-colors disabled:opacity-60"
                    >
                      {submitting ? 'Enviando…' : 'Enviar solicitud'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
