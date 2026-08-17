'use client'

import { useState, useEffect } from 'react'
import { ArrowLeftRight, BookOpen, Loader2, Info } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { useToast } from '@/components/shared/Toast'
import { useStudyPlans } from '@/hooks/useStudyPlans'
import { useDirigentes } from '@/hooks/useDirigentes'
import { Combobox, type ComboValue } from '@/components/shared/Combobox'
import { useSedes } from '@/lib/sedes'
import { cn } from '@/lib/utils'
import type { StudyRequestType } from '@/types/study'

const NEEDED_STUDY_CODES = ['N2', 'N3', 'N4', 'DIS2', 'DIS3'] as const
const CLASS_OPTIONS = [...Array.from({ length: 12 }, (_, i) => String(i + 1)), 'no_recuerda'] as const
const WEEK_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'] as const
const TIME_SLOTS = ['mañana', 'tarde', 'noche'] as const

type EligiblePlan = { id: string; code: string; name: string; stage: string }
type ActiveEnrollment = { group_id: string; group_name: string; plan_code: string | null }
type Eligibility = {
  active_enrollments: ActiveEnrollment[]
  eligible_plans: EligiblePlan[]
  commitments: { is_donor: boolean; attendance_active: boolean; is_server: boolean }
}
/** Opción del dropdown de interés: TODOS los estudios no llevados, con su
 *  elegibilidad y (si no es elegible) qué le falta al miembro. */
type StudyOption = { plan_id: string; code: string; name: string; stage: string; is_eligible: boolean; missing: string[] }

const MIN_REASON = 20
const SELECT_CLS = 'w-full rounded-xl border border-outline bg-surface-low px-3 py-2.5 text-sm text-navy font-body outline-none focus:ring-1 focus:ring-coral/30 disabled:opacity-60'
const LABEL_CLS = 'block text-[12px] font-medium text-navy-light/70 font-body mb-1.5'

export function StudyRequestActions({ memberId, only, variant = 'buttons' }: {
  memberId: string
  /** REU-2: mostrar SOLO uno de los dos accesos. Sin esto salen los dos (perfil). */
  only?: StudyRequestType
  /** 'link' = enlace discreto, para meterlo dentro de otra pantalla sin competir
   *  con lo que esa pantalla vino a hacer. */
  variant?: 'buttons' | 'link'
}) {
  const toast = useToast()
  const { studyTypes } = useStudyPlans()
  const { dirigentes } = useDirigentes()
  const { zoneSedes } = useSedes()
  const [openModal, setOpenModal] = useState<StudyRequestType | null>(null)
  const [eligibility, setEligibility] = useState<Eligibility | null>(null)
  const [dataLoading, setDataLoading] = useState(false)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  // Interés de estudio (v2): opciones (no llevados) + si ya tiene una abierta.
  const [options, setOptions] = useState<StudyOption[]>([])
  const [hasOpenReq, setHasOpenReq] = useState(false)
  const [optionsLoaded, setOptionsLoaded] = useState(false)

  const [planId, setPlanId] = useState('')
  const [reason, setReason] = useState('')
  // Interés v2: día(s) hasta 2, horario, zona (sede existente o "otra").
  const [days, setDays] = useState<string[]>([])
  const [time, setTime] = useState('')
  const [zoneSel, setZoneSel] = useState('')     // id de sede | 'otra' | ''
  const [zoneOther, setZoneOther] = useState('')
  // Reubicación (REU-1: días y zonas con selección múltiple)
  const [zones, setZones] = useState<string[]>([])
  const [neededStudyCode, setNeededStudyCode] = useState('')
  const [lastClassAttended, setLastClassAttended] = useState('')
  const [lastLeader, setLastLeader] = useState<ComboValue>({ kind: 'empty' })
  const [wantsFolleto, setWantsFolleto] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Opciones de interés + estado de "ya tiene una abierta" (para bloquear el botón).
  useEffect(() => {
    let alive = true
    setOptionsLoaded(false)
    fetch(`/api/studies/request-options?member_id=${memberId}`)
      .then(r => (r.ok ? r.json() : { options: [], has_open_request: false }))
      .then(d => { if (alive) { setOptions(d.options ?? []); setHasOpenReq(!!d.has_open_request); setOptionsLoaded(true) } })
      .catch(() => { if (alive) setOptionsLoaded(true) })
    return () => { alive = false }
  }, [memberId])

  function loadData() {
    if (loadedFor === memberId || dataLoading) return
    setDataLoading(true)
    fetch(`/api/studies/eligibility?member_id=${memberId}`)
      .then(async e => { if (e.ok) setEligibility(await e.json()); setLoadedFor(memberId) })
      .catch(() => {})
      .finally(() => setDataLoading(false))
  }

  function open(type: StudyRequestType) {
    setPlanId(''); setReason('')
    setDays([]); setTime(''); setZoneSel(''); setZoneOther(''); setZones([])
    setNeededStudyCode(''); setLastClassAttended(''); setLastLeader({ kind: 'empty' }); setWantsFolleto(false)
    setError(''); setOpenModal(type); loadData()
  }

  const activeEnrollments = eligibility?.active_enrollments ?? []
  // Grupo de origen: el primer estudio activo del miembro (ya no se elige a mano).
  const effectiveCurrentGroup = activeEnrollments[0]?.group_id ?? ''

  const relocationBlocked = !dataLoading && eligibility !== null && activeEnrollments.length === 0
  // Interés: se bloquea solo si no hay NINGÚN estudio no llevado (nada que pedir).
  const interestBlocked = optionsLoaded && options.length === 0
  const blocked = openModal === 'relocation' ? relocationBlocked : interestBlocked

  const selectedOption = options.find(o => o.plan_id === planId) ?? null

  function toggleDay(d: string) {
    // El tope de 2 días aplica solo al interés; la reubicación es libre (REU-1).
    const cap = openModal === 'study_interest' ? 2 : WEEK_DAYS.length
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : (prev.length >= cap ? prev : [...prev, d]))
  }
  function toggleZone(z: string) {
    setZones(prev => prev.includes(z) ? prev.filter(x => x !== z) : [...prev, z])
  }
  const zoneLabel = zoneSel === 'otra' ? zoneOther.trim() : (zoneSedes.find(s => s.id === zoneSel)?.name ?? '')

  async function submit() {
    if (blocked) return
    if (openModal === 'study_interest') {
      if (!planId) { setError('Seleccioná el estudio de interés.'); return }
    }
    if (openModal === 'relocation') {
      if (reason.trim().length < MIN_REASON) { setError(`Contanos un poco más: la razón debe tener al menos ${MIN_REASON} caracteres.`); return }
      if (!neededStudyCode) { setError('Seleccioná el estudio que necesitás.'); return }
      if (!lastClassAttended) { setError('Seleccioná en cuál clase quedaste.'); return }
      if (lastLeader.kind === 'empty' || !lastLeader.label.trim()) { setError('Indicá tu último dirigente.'); return }
    }
    setError(''); setSubmitting(true)
    try {
      const res = await fetch('/api/studies/requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: memberId,
          request_type: openModal,
          plan_id: planId || null,
          existing_group_id: null,
          current_group_id: openModal === 'relocation' ? (effectiveCurrentGroup || null) : null,
          // Interés: zona en proposed_location, día(s)/horario estructurados,
          // y la elegibilidad capturada para el coordinador.
          proposed_location: openModal === 'study_interest' ? (zoneLabel || null) : null,
          proposed_days: days,
          proposed_time: time || null,
          proposed_zones: openModal === 'relocation' ? zones : undefined,
          was_eligible: openModal === 'study_interest' ? (selectedOption?.is_eligible ?? null) : undefined,
          eligibility_note: openModal === 'study_interest' && selectedOption && !selectedOption.is_eligible ? selectedOption.missing.join(' · ') : undefined,
          reason: openModal === 'relocation' ? reason.trim() : undefined,
          needed_study_code: openModal === 'relocation' ? neededStudyCode : undefined,
          last_class_attended: openModal === 'relocation' ? lastClassAttended : undefined,
          last_leader_name: openModal === 'relocation' ? (lastLeader.kind === 'empty' ? '' : lastLeader.label.trim()) : undefined,
          wants_folleto: openModal === 'relocation' ? wantsFolleto : undefined,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'No se pudo enviar la solicitud')
      }
      const wasInterest = openModal === 'study_interest'
      setOpenModal(null)
      if (wasInterest) setHasOpenReq(true)
      // EST-6: el interés es informativo — no prometemos gestión de un coordinador.
      toast(wasInterest
        ? '¡Gracias! Registramos tu interés. Revisá la página de Matrícula para ver cuándo se abren grupos nuevos.'
        : 'Solicitud enviada. Un coordinador la revisará pronto.', 'success')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar la solicitud')
    } finally {
      setSubmitting(false)
    }
  }

  // El modal es el MISMO para las dos variantes de abajo: lo que cambia es
  // cómo se abre — los botones del perfil o el enlace discreto que REU-2 mete
  // dentro de otras pantallas.
  const modal = openModal ? (
        <Modal onClose={() => setOpenModal(null)} titleId="study-request-title">
          <div className="p-6 space-y-4">
            <h2 id="study-request-title" className="text-lg font-semibold text-navy font-display">
              {openModal === 'relocation' ? 'Solicitar reubicación' : 'Me interesa un estudio'}
            </h2>

            {(openModal === 'relocation' && (dataLoading || !eligibility)) || (openModal === 'study_interest' && !optionsLoaded) ? (
              <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-navy-light/60" /></div>
            ) : (
              <>
                {/* Disclaimer de interés — al inicio, tono cálido. */}
                {openModal === 'study_interest' && (
                  <div className="flex items-start gap-2 rounded-xl bg-teal/8 border border-teal/20 px-4 py-3">
                    <Info size={15} className="mt-0.5 shrink-0 text-teal-deep" aria-hidden />
                    <p className="text-[13px] text-navy font-body">
                      Esta solicitud es <strong>informativa</strong>: nos ayuda a ver qué estudios tienen demanda para
                      abrir grupos nuevos. <strong>No te vamos a contactar</strong> — revisá la página de Matrícula,
                      ahí van a aparecer los grupos nuevos cuando se abran. ¡Gracias por contarnos!
                    </p>
                  </div>
                )}

                {/* REU-2: qué pasa después. Sin esto la gente manda la solicitud
                    y se queda esperando sin saber si tiene que hacer algo más. */}
                {openModal === 'relocation' && !relocationBlocked && (
                  <div className="flex items-start gap-2 rounded-xl bg-teal/8 border border-teal/20 px-4 py-3">
                    <Info size={15} className="mt-0.5 shrink-0 text-teal-deep" aria-hidden />
                    <p className="text-[13px] text-navy font-body">
                      Lo revisa el <strong>coordinador de estudios</strong>: no es automático.
                      Mientras tanto <strong>seguís matriculado en tu grupo actual</strong> — no
                      pierdas las clases. Te avisamos cuando esté resuelto.
                    </p>
                  </div>
                )}

                {openModal === 'relocation' && relocationBlocked && (
                  <div className="rounded-xl bg-coral/7 border border-coral/20 px-4 py-3">
                    <p className="text-[13px] text-coral font-body">No tenés estudios activos elegibles para reubicación.</p>
                  </div>
                )}
                {openModal === 'study_interest' && interestBlocked && (
                  <div className="rounded-xl bg-coral/7 border border-coral/20 px-4 py-3">
                    <p className="text-[13px] text-coral font-body">Ya llevaste (o estás llevando) todos los estudios del plan. No hay ninguno para solicitar.</p>
                  </div>
                )}

                {openModal === 'relocation' && !relocationBlocked && (
                  <>
                    <div>
                      <label htmlFor="relocation-needed-study" className={LABEL_CLS}>Estudio que necesito <span className="text-coral">*</span></label>
                      <select id="relocation-needed-study" value={neededStudyCode} onChange={e => setNeededStudyCode(e.target.value)} className={SELECT_CLS}>
                        <option value="">Seleccionar…</option>
                        {NEEDED_STUDY_CODES.map(code => <option key={code} value={code}>{code} — {studyTypes.find(s => s.code === code)?.name ?? code}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="relocation-last-class" className={LABEL_CLS}>En cuál clase quedé <span className="text-coral">*</span></label>
                      <select id="relocation-last-class" value={lastClassAttended} onChange={e => setLastClassAttended(e.target.value)} className={SELECT_CLS}>
                        <option value="">Seleccionar…</option>
                        {CLASS_OPTIONS.map(c => <option key={c} value={c}>{c === 'no_recuerda' ? 'No me acuerdo' : `Clase ${c}`}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Último dirigente <span className="text-coral">*</span></label>
                      <Combobox
                        items={dirigentes.map(d => ({ value: d.member_id, label: d.member_name }))}
                        value={lastLeader}
                        onChange={setLastLeader}
                        allowCreate
                        createLabel={t => `Usar “${t}” (no está en la lista)`}
                        placeholder="Buscá un dirigente o escribí el nombre…"
                        ariaLabel="Último dirigente"
                      />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={wantsFolleto} onChange={e => setWantsFolleto(e.target.checked)} className="accent-coral h-3.5 w-3.5" />
                      <span className="text-sm text-navy-light/70 font-body">Ocupo folleto</span>
                    </label>
                    <div>
                      <label className={LABEL_CLS}>Día(s) que te sirven</label>
                      <div className="flex flex-wrap gap-2">
                        {WEEK_DAYS.map(d => {
                          const on = days.includes(d)
                          return (
                            <button key={d} type="button" onClick={() => toggleDay(d)}
                              className={cn('rounded-full px-3 py-1.5 text-[13px] font-body border transition-colors',
                                on ? 'bg-teal text-white border-teal' : 'bg-white text-navy border-navy/15 hover:border-navy/30')}>{d}</button>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <label htmlFor="relocation-time" className={LABEL_CLS}>Horario</label>
                      <select id="relocation-time" value={time} onChange={e => setTime(e.target.value)} className={SELECT_CLS}>
                        <option value="">Seleccionar…</option>
                        {TIME_SLOTS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Zona(s) que te sirven</label>
                      <div className="flex flex-wrap gap-2">
                        {[...zoneSedes.map(sd => sd.name), 'Cualquiera'].map(z => {
                          const on = zones.includes(z)
                          return (
                            <button key={z} type="button" onClick={() => toggleZone(z)}
                              className={cn('rounded-full px-3 py-1.5 text-[13px] font-body border transition-colors',
                                on ? 'bg-teal text-white border-teal' : 'bg-white text-navy border-navy/15 hover:border-navy/30')}>{z}</button>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <label htmlFor="request-reason" className={LABEL_CLS}>Razón <span className="text-coral">*</span></label>
                      <textarea id="request-reason" value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Contanos por qué (mínimo 20 caracteres)…" className={cn(SELECT_CLS, 'resize-none placeholder:text-navy-light/50')} />
                      <p className={cn('mt-1 text-[11px] font-body', reason.trim().length < MIN_REASON ? 'text-navy-light/60' : 'text-success')}>{reason.trim().length}/{MIN_REASON} caracteres mínimos</p>
                    </div>
                  </>
                )}

                {openModal === 'study_interest' && !interestBlocked && (
                  <>
                    <div>
                      <label htmlFor="interest-plan" className={LABEL_CLS}>¿Qué estudio te interesa? <span className="text-coral">*</span></label>
                      <select id="interest-plan" value={planId} onChange={e => setPlanId(e.target.value)} className={SELECT_CLS}>
                        <option value="">Seleccionar estudio…</option>
                        {options.map(o => <option key={o.plan_id} value={o.plan_id}>{o.code} — {o.name}{o.is_eligible ? '' : ' (aún no elegible)'}</option>)}
                      </select>
                      <p className="mt-1 text-[11px] text-navy-light/60 font-body">Se muestran los estudios que aún no has llevado.</p>
                    </div>

                    {/* Aviso de elegibilidad: informa qué falta, pero permite enviar igual. */}
                    {selectedOption && !selectedOption.is_eligible && (
                      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                        <p className="text-[13px] text-amber-800 font-body font-medium">Todavía no cumplís los requisitos de este estudio.</p>
                        {selectedOption.missing.length > 0 && (
                          <ul className="mt-1 list-disc pl-4 text-[12px] text-amber-700 font-body">
                            {selectedOption.missing.map((m, i) => <li key={i}>{m}</li>)}
                          </ul>
                        )}
                        <p className="mt-1 text-[12px] text-amber-700 font-body">Podés enviar la solicitud igual: nos sirve para medir el interés.</p>
                      </div>
                    )}

                    <div>
                      <label className={LABEL_CLS}>Día(s) que podés — hasta 2</label>
                      <div className="flex flex-wrap gap-2">
                        {WEEK_DAYS.map(d => {
                          const on = days.includes(d)
                          return (
                            <button key={d} type="button" onClick={() => toggleDay(d)} disabled={!on && days.length >= 2}
                              className={cn('rounded-full px-3 py-1.5 text-[13px] font-body border transition-colors disabled:opacity-40',
                                on ? 'bg-teal text-white border-teal' : 'bg-white text-navy border-navy/15 hover:border-navy/30')}>{d}</button>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <label htmlFor="interest-time" className={LABEL_CLS}>Horario</label>
                      <select id="interest-time" value={time} onChange={e => setTime(e.target.value)} className={SELECT_CLS}>
                        <option value="">Seleccionar…</option>
                        {TIME_SLOTS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="interest-zone" className={LABEL_CLS}>Zona</label>
                      <select id="interest-zone" value={zoneSel} onChange={e => setZoneSel(e.target.value)} className={SELECT_CLS}>
                        <option value="">Seleccionar zona…</option>
                        {zoneSedes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        <option value="otra">Otra (escribir)</option>
                      </select>
                      {zoneSel === 'otra' && (
                        <input value={zoneOther} onChange={e => setZoneOther(e.target.value)} placeholder="Escribí la zona" className={cn(SELECT_CLS, 'mt-2 placeholder:text-navy-light/50')} />
                      )}
                    </div>
                  </>
                )}

                {error && <p className="text-[13px] text-coral font-body">{error}</p>}

                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={() => setOpenModal(null)} className="rounded-full px-4 py-2 text-sm text-navy-light/70 font-body hover:text-navy transition-colors">{blocked ? 'Cerrar' : 'Cancelar'}</button>
                  {!blocked && (
                    <button onClick={submit} disabled={submitting} className="rounded-full bg-coral px-5 py-2 text-sm text-white font-body font-medium hover:bg-coral-deep transition-colors disabled:opacity-60">
                      {submitting ? 'Enviando…' : 'Enviar solicitud'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </Modal>
  ) : null

  const muestra = (t: StudyRequestType) => !only || only === t

  // REU-2 · Enlace discreto: el mismo modal, pero puesto donde la persona se da
  // cuenta del error (su grupo, la confirmación de matrícula) y no enterrado en
  // una pestaña del perfil.
  if (variant === 'link') {
    return (
      <>
        <button
          onClick={() => open(only ?? 'relocation')}
          className="inline-flex items-center gap-1.5 text-[12px] text-navy-light/70 hover:text-navy underline underline-offset-2 transition-colors font-body"
        >
          <ArrowLeftRight size={12} />
          {only === 'study_interest'
            ? '¿Buscás otro estudio? Contanos cuál'
            : '¿Te matriculaste en el grupo equivocado? Pedí un cambio de grupo'}
        </button>
        {modal}
      </>
    )
  }

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        {muestra('relocation') && (
        <button
          onClick={() => open('relocation')}
          className="inline-flex items-center gap-1.5 rounded-full bg-surface-low px-3.5 py-2 text-[13px] text-navy font-body hover:bg-navy/10 transition-colors"
        >
          <ArrowLeftRight size={13} /> Solicitar reubicación
        </button>
        )}
        {muestra('study_interest') && (
        <button
          onClick={() => open('study_interest')}
          disabled={hasOpenReq}
          title={hasOpenReq ? 'Ya tenés una solicitud de estudio abierta' : undefined}
          className="inline-flex items-center gap-1.5 rounded-full bg-surface-low px-3.5 py-2 text-[13px] text-navy font-body hover:bg-navy/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <BookOpen size={13} /> Me interesa un estudio
        </button>
        )}
      </div>
      {muestra('study_interest') && hasOpenReq && (
        <p className="mt-1.5 text-[12px] text-navy-light/60 font-body">
          Ya registraste una solicitud de estudio (una a la vez). Revisá la página de Matrícula: ahí aparecen los grupos nuevos cuando se abren.
        </p>
      )}

      {modal}
    </>
  )
}
