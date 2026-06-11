'use client'

import { useState } from 'react'
import { ArrowLeftRight, Users, MapPin, Loader2 } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { useToast } from '@/components/shared/Toast'
import { cn } from '@/lib/utils'
import type { StudyRequestType } from '@/types/study'

/**
 * Botones "Solicitar reubicación" / "Unirme a un grupo" / "Solicitar estudio
 * en mi zona" en el perfil del miembro. Visibles para cualquier rol: crear
 * solicitudes está abierto a todo usuario autenticado.
 */

type Plan = { id: string; code: string | null; name: string; is_active: boolean }
type Group = {
  id: string
  name: string
  status: string
  plan: { code: string | null } | null
  enrollments: Array<{ member_id: string; status: string }>
}

const MIN_REASON = 20

const SELECT_CLS = 'w-full rounded-xl border border-outline bg-surface-low px-3 py-2.5 text-sm text-navy font-body outline-none focus:ring-1 focus:ring-coral/30'
const LABEL_CLS = 'block text-[12px] font-medium text-navy-light/70 font-body mb-1.5'

export function StudyRequestActions({ memberId }: { memberId: string }) {
  const toast = useToast()
  const [openModal, setOpenModal] = useState<StudyRequestType | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)

  // Campos del formulario (se resetean al abrir)
  const [planId, setPlanId] = useState('')
  const [targetGroupId, setTargetGroupId] = useState('')
  // null = sin tocar por el usuario → se autocompleta con el grupo del miembro.
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null)
  const [location, setLocation] = useState('')
  const [schedule, setSchedule] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const memberGroup = groups.find(g =>
    g.enrollments?.some(e => e.member_id === memberId && e.status === 'enrolled'))

  // Planes y grupos se cargan una vez, al abrir el primer modal (en el handler
  // del click, no en un effect: evita setState síncrono dentro de effects).
  function loadData() {
    if (dataLoaded || dataLoading) return
    setDataLoading(true)
    Promise.all([fetch('/api/studies/plans'), fetch('/api/studies/groups')])
      .then(async ([p, g]) => {
        if (p.ok) setPlans(((await p.json()) as Plan[]).filter(pl => pl.is_active))
        if (g.ok) setGroups(((await g.json()) as Group[]).filter(gr => gr.status === 'open' || gr.status === 'in_progress'))
        setDataLoaded(true)
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

  const planCode = plans.find(p => p.id === planId)?.code ?? null
  const groupsOfPlan = groups.filter(g => planCode && g.plan?.code === planCode)
  const effectiveCurrentGroup = currentGroupId ?? memberGroup?.id ?? ''

  async function submit() {
    if (reason.trim().length < MIN_REASON) {
      setError(`Contanos un poco más: la razón debe tener al menos ${MIN_REASON} caracteres.`)
      return
    }
    if (openModal === 'join_group' && !planId) {
      setError('Seleccioná el plan de estudio.')
      return
    }
    if (openModal === 'new_group' && !planId) {
      setError('Seleccioná el plan de estudio deseado.')
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
          proposed_location: openModal === 'new_group' ? location : null,
          proposed_schedule: openModal === 'new_group' ? schedule : null,
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
          onClick={() => open('join_group')}
          className="inline-flex items-center gap-1.5 rounded-full bg-surface-low px-3.5 py-2 text-[13px] text-navy font-body hover:bg-navy/10 transition-colors"
        >
          <Users size={13} />
          Unirme a un grupo
        </button>
        <button
          onClick={() => open('new_group')}
          className="inline-flex items-center gap-1.5 rounded-full bg-surface-low px-3.5 py-2 text-[13px] text-navy font-body hover:bg-navy/10 transition-colors"
        >
          <MapPin size={13} />
          Solicitar estudio en mi zona
        </button>
      </div>

      {openModal && (
        <Modal onClose={() => setOpenModal(null)} titleId="study-request-title">
          <div className="p-6 space-y-4">
            <h2 id="study-request-title" className="text-lg font-semibold text-navy font-display">
              {openModal === 'relocation' && 'Solicitar reubicación'}
              {openModal === 'join_group' && 'Unirme a un grupo'}
              {openModal === 'new_group' && 'Solicitar estudio en mi zona'}
            </h2>

            {dataLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={18} className="animate-spin text-navy-light/40" />
              </div>
            ) : (
              <>
                {openModal === 'relocation' && (
                  <>
                    <div>
                      <label htmlFor="current-group" className={LABEL_CLS}>Grupo actual</label>
                      <select id="current-group" value={effectiveCurrentGroup} onChange={e => setCurrentGroupId(e.target.value)} className={SELECT_CLS}>
                        <option value="">Sin grupo actual</option>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="target-group" className={LABEL_CLS}>Grupo al que quiere ir (opcional)</label>
                      <select id="target-group" value={targetGroupId} onChange={e => setTargetGroupId(e.target.value)} className={SELECT_CLS}>
                        <option value="">Que el coordinador decida</option>
                        {groups.filter(g => g.id !== effectiveCurrentGroup).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </div>
                  </>
                )}

                {openModal === 'join_group' && (
                  <>
                    <div>
                      <label htmlFor="join-plan" className={LABEL_CLS}>Plan de estudio <span className="text-coral">*</span></label>
                      <select id="join-plan" value={planId} onChange={e => { setPlanId(e.target.value); setTargetGroupId('') }} className={SELECT_CLS}>
                        <option value="">Seleccionar plan…</option>
                        {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="join-group" className={LABEL_CLS}>Grupo específico (opcional)</label>
                      <select id="join-group" value={targetGroupId} onChange={e => setTargetGroupId(e.target.value)} className={SELECT_CLS} disabled={!planId}>
                        <option value="">{planId ? (groupsOfPlan.length ? 'Cualquier grupo disponible' : 'Sin grupos activos de este plan') : 'Elegí primero el plan'}</option>
                        {groupsOfPlan.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </div>
                  </>
                )}

                {openModal === 'new_group' && (
                  <>
                    <div>
                      <label htmlFor="new-plan" className={LABEL_CLS}>Plan de estudio deseado <span className="text-coral">*</span></label>
                      <select id="new-plan" value={planId} onChange={e => setPlanId(e.target.value)} className={SELECT_CLS}>
                        <option value="">Seleccionar plan…</option>
                        {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="proposed-location" className={LABEL_CLS}>Ubicación propuesta</label>
                      <input
                        id="proposed-location"
                        value={location}
                        onChange={e => setLocation(e.target.value)}
                        placeholder="Ej: Heredia centro"
                        className={cn(SELECT_CLS, 'placeholder:text-navy-light/50')}
                      />
                    </div>
                    <div>
                      <label htmlFor="proposed-schedule" className={LABEL_CLS}>Horario tentativo</label>
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

                {reasonField}

                {error && <p className="text-[13px] text-coral font-body">{error}</p>}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setOpenModal(null)}
                    className="rounded-full px-4 py-2 text-sm text-navy-light/70 font-body hover:text-navy transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={submit}
                    disabled={submitting}
                    className="rounded-full bg-coral px-5 py-2 text-sm text-white font-body font-medium hover:bg-coral-deep transition-colors disabled:opacity-60"
                  >
                    {submitting ? 'Enviando…' : 'Enviar solicitud'}
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
