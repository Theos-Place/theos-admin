'use client'

// PRE-8: evaluación de la PAREJA en el cierre de un grupo prematrimonial (una
// por pareja del grupo). Los textos y opciones vienen del módulo puro
// premat-evaluation.ts (fuente única, la misma que valida el API).
// SENSIBLE: el contenido es pastoral — se guarda en prematrimonial_evaluations
// y solo lo leen coordinador_estudios / direccion / admin.

import { useState, useEffect } from 'react'
import { Heart, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  COMMITMENT_QUESTION, COMMITMENT_OPTIONS, STRENGTHS_QUESTION, STRENGTH_OPTIONS,
  TOPICS_QUESTION, TOPIC_OPTIONS, BLIND_SPOT_QUESTION, OBSERVATIONS_LABEL,
  ACTION_PLAN_LABEL, ACTION_PLAN_OPTIONS, BLESSING_LABEL, needsFollowUp,
  type PrematEvaluationInput,
} from '@/lib/studies/premat-evaluation'

export type Pair = { request_id: string; requester_name: string; spouse_name: string }

const LABEL = 'block text-[13px] font-medium text-navy-light/80 font-body mb-1.5'
const INPUT = 'w-full rounded-xl border border-navy/15 bg-white px-3 py-2.5 text-sm text-navy outline-none focus:border-navy/30 font-body'

function emptyEval(requestId: string): PrematEvaluationInput {
  return {
    request_id: requestId,
    commitment: '',
    strengths: [],
    strengths_notes: '',
    topics_to_work: [],
    observations: '',
    blind_spot: false,
    blind_spot_notes: '',
    action_plan: '',
    blessing: '',
  }
}

/** Chips de selección múltiple (fortalezas / temas). */
function Chips({ options, selected, onToggle, ariaLabel }: {
  options: readonly string[]
  selected: string[]
  onToggle: (v: string) => void
  ariaLabel: string
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={ariaLabel}>
      {options.map(o => {
        const on = selected.includes(o)
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(o)}
            className={cn(
              'rounded-full px-3 py-1.5 text-[13px] font-body border transition-colors text-left',
              on ? 'bg-teal text-white border-teal' : 'bg-white text-navy border-navy/15 hover:border-navy/30',
            )}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Carga las parejas del grupo y renderiza una evaluación por pareja.
 * `onChange` entrega las evaluaciones al padre (el cierre las manda en el POST);
 * `onReady` informa si están completas para habilitar Continuar.
 */
export function PrematCoupleEvaluation({ groupId, onChange }: {
  groupId: string
  onChange: (evals: PrematEvaluationInput[], pairsCount: number) => void
}) {
  const [pairs, setPairs] = useState<Pair[] | null>(null)
  const [evals, setEvals] = useState<Record<string, PrematEvaluationInput>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    fetch(`/api/studies/groups/${groupId}/premat-pairs`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => {
        if (!alive) return
        const items: Pair[] = d.items ?? []
        setPairs(items)
        setEvals(Object.fromEntries(items.map(p => [p.request_id, emptyEval(p.request_id)])))
      })
      .catch(() => { if (alive) { setPairs([]); setError('No se pudieron cargar las parejas del grupo.') } })
    return () => { alive = false }
  }, [groupId])

  // Avisar al padre en cada cambio (él decide si habilita Continuar).
  useEffect(() => {
    if (!pairs) return
    onChange(Object.values(evals), pairs.length)
    // onChange es estable en el caller (useCallback); evals/pairs son la señal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evals, pairs])

  function patch(requestId: string, changes: Partial<PrematEvaluationInput>) {
    setEvals(prev => ({ ...prev, [requestId]: { ...prev[requestId], ...changes } }))
  }
  function toggleIn(requestId: string, key: 'strengths' | 'topics_to_work', value: string) {
    setEvals(prev => {
      const cur = prev[requestId][key]
      const next = cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value]
      return { ...prev, [requestId]: { ...prev[requestId], [key]: next } }
    })
  }

  if (pairs === null) {
    return (
      <p className="rounded-2xl bg-surface-card p-5 text-[13px] text-navy-light/80 font-body inline-flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" /> Cargando parejas del grupo…
      </p>
    )
  }
  if (error) return <p className="rounded-2xl bg-coral/5 p-5 text-[13px] text-coral-deep font-body">{error}</p>
  if (pairs.length === 0) {
    return (
      <p className="rounded-2xl bg-surface-card p-5 text-[13px] text-navy-light/80 font-body">
        Este grupo prematrimonial no tiene parejas registradas desde la cola de solicitudes, así que no hay evaluación por llenar.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {pairs.map(p => {
        const e = evals[p.request_id]
        if (!e) return null
        return (
          <div key={p.request_id} className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] space-y-4">
            <div className="flex items-center gap-2">
              <Heart size={15} className="text-coral shrink-0" />
              <h3 className="text-sm font-bold text-navy font-display">
                {p.requester_name} &amp; {p.spouse_name}
              </h3>
            </div>
            <p className="text-[13px] text-navy-light/80 font-body">
              Evaluación de mentores. Es información pastoral: solo la ve la coordinación de estudios y dirección.
            </p>

            {/* 1) compromiso */}
            <div>
              <label className={LABEL}>{COMMITMENT_QUESTION} <span className="text-coral">*</span></label>
              <div className="flex flex-wrap gap-2">
                {COMMITMENT_OPTIONS.map(o => (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={e.commitment === o.value}
                    onClick={() => patch(p.request_id, { commitment: o.value })}
                    className={cn('rounded-full px-3.5 py-1.5 text-[13px] font-body border transition-colors',
                      e.commitment === o.value ? 'bg-navy text-white border-navy' : 'bg-white text-navy border-navy/15 hover:border-navy/30')}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2) fortalezas */}
            <div>
              <label className={LABEL}>{STRENGTHS_QUESTION}</label>
              <Chips options={STRENGTH_OPTIONS} selected={e.strengths} onToggle={v => toggleIn(p.request_id, 'strengths', v)} ariaLabel="Fortalezas de la pareja" />
              <textarea
                value={e.strengths_notes ?? ''}
                onChange={ev => patch(p.request_id, { strengths_notes: ev.target.value })}
                rows={2}
                placeholder="Notas adicionales sobre las fortalezas (opcional)…"
                aria-label="Notas sobre las fortalezas"
                className={cn(INPUT, 'mt-2 resize-none placeholder:text-navy-light/50')}
              />
            </div>

            {/* 3) temas a profundizar */}
            <div>
              <label className={LABEL}>{TOPICS_QUESTION}</label>
              <Chips options={TOPIC_OPTIONS} selected={e.topics_to_work} onToggle={v => toggleIn(p.request_id, 'topics_to_work', v)} ariaLabel="Temas a profundizar" />
            </div>

            {/* 4) observaciones */}
            <div>
              <label htmlFor={`obs-${p.request_id}`} className={LABEL}>{OBSERVATIONS_LABEL}</label>
              <textarea
                id={`obs-${p.request_id}`}
                value={e.observations ?? ''}
                onChange={ev => patch(p.request_id, { observations: ev.target.value })}
                rows={3}
                className={cn(INPUT, 'resize-none')}
              />
            </div>

            {/* 5) punto ciego */}
            <div>
              <label className={LABEL}>{BLIND_SPOT_QUESTION} <span className="text-coral">*</span></label>
              <div className="flex gap-2">
                {[{ v: true, l: 'Sí' }, { v: false, l: 'No' }].map(o => (
                  <button
                    key={o.l}
                    type="button"
                    aria-pressed={e.blind_spot === o.v}
                    onClick={() => patch(p.request_id, { blind_spot: o.v })}
                    className={cn('rounded-full px-4 py-1.5 text-[13px] font-body border transition-colors',
                      e.blind_spot === o.v ? 'bg-navy text-white border-navy' : 'bg-white text-navy border-navy/15 hover:border-navy/30')}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
              {e.blind_spot && (
                <textarea
                  value={e.blind_spot_notes ?? ''}
                  onChange={ev => patch(p.request_id, { blind_spot_notes: ev.target.value })}
                  rows={2}
                  placeholder="Describilo brevemente (obligatorio)…"
                  aria-label="Descripción del punto ciego"
                  className={cn(INPUT, 'mt-2 resize-none placeholder:text-navy-light/50')}
                />
              )}
            </div>

            {/* 6) plan de acción */}
            <div>
              <label className={LABEL}>{ACTION_PLAN_LABEL} <span className="text-coral">*</span></label>
              <div className="space-y-2">
                {ACTION_PLAN_OPTIONS.map(o => (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={e.action_plan === o.value}
                    onClick={() => patch(p.request_id, { action_plan: o.value })}
                    className={cn('block w-full rounded-xl px-3.5 py-2.5 text-[13px] font-body border text-left transition-colors',
                      e.action_plan === o.value ? 'bg-teal/10 text-navy border-teal' : 'bg-white text-navy border-navy/15 hover:border-navy/30')}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {e.action_plan && needsFollowUp(e.action_plan) && (
                <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-800 font-body">
                  La pareja queda marcada para <strong>seguimiento</strong>: aparece en la cola prematrimonial y en su ficha administrativa (solo para coordinación y dirección). El grupo se cierra igual.
                </p>
              )}
            </div>

            {/* 7) bendición */}
            <div>
              <label htmlFor={`bless-${p.request_id}`} className={LABEL}>{BLESSING_LABEL}</label>
              <textarea
                id={`bless-${p.request_id}`}
                value={e.blessing ?? ''}
                onChange={ev => patch(p.request_id, { blessing: ev.target.value })}
                rows={3}
                placeholder="Palabras de bendición para la pareja…"
                className={cn(INPUT, 'resize-none placeholder:text-navy-light/50')}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
