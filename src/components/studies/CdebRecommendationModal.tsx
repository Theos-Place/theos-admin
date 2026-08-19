'use client'

// EST-9: form de recomendación a CDEB de UN estudiante, al cerrar un grupo
// DIS3 / Panorama. Pensado para llenarse EN EL CELULAR al final del cierre:
//  · convicciones POR EXCEPCIÓN (cero toques si no hubo observaciones),
//  · escalas 1-5 como botones en fila con la etiqueta del nivel visible,
//  · fecha prellenada con la del cierre.
// Guarda borrador (no valida) o envía (valida completo, server-side también).

import { useState } from 'react'
import { Loader2, Save, Send, Sparkles } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { useToast } from '@/components/shared/Toast'
import { useStudyPlans } from '@/hooks/useStudyPlans'
import { cn } from '@/lib/utils'
import {
  HEADER_TEXT, COMPLETION_DATE_LABEL, COMPLETION_DATE_HINT,
  CONVICTIONS_INSTRUCTION, CONVICTION_TOPICS, CONVICTION_STANCES,
  SCALE_LABELS, TESTIMONY_LABEL, TESTIMONY_TEXT_LABEL, PASSION_LABEL, PASSION_TEXT_LABEL,
  BIBLE_LABEL, SPEECH_LABEL, SPEECH_TEXT_LABEL, COMMITMENT_TEXT_LABEL, COMMITTEE_TEXT_LABEL,
  NA_HINT, RECOMMENDATION_LABEL, RECOMMENDATION_OPTIONS,
  allowsNoInfoOption, validateCdebRecommendation,
  type CdebRecommendationInput, type ConvictionFlag,
} from '@/lib/studies/cdeb-recommendation'

const LABEL = 'block text-[13px] font-medium text-navy-light/80 font-body mb-1.5'
const INPUT = 'w-full rounded-xl border border-navy/15 bg-white px-3 py-2.5 text-sm text-navy outline-none focus:border-navy/30 font-body'

/** Escala 1-5 en fila (+ X opcional), con la etiqueta del nivel al elegir. */
function ScaleRow({ label, value, onChange, allowX }: {
  label: string
  value: string | null | undefined
  onChange: (v: string) => void
  allowX: boolean
}) {
  const options = ['1', '2', '3', '4', '5', ...(allowX ? ['x'] : [])]
  return (
    <div>
      <label className={LABEL}>{label} <span className="text-coral">*</span></label>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {options.map(o => (
          <button
            key={o}
            type="button"
            aria-pressed={value === o}
            onClick={() => onChange(o)}
            title={SCALE_LABELS[o]}
            className={cn(
              'h-10 min-w-10 rounded-xl border text-sm font-semibold font-display transition-colors',
              value === o ? 'bg-teal text-white border-teal' : 'bg-white text-navy border-navy/15 hover:border-navy/30',
              o === 'x' && 'px-3',
            )}
          >
            {o === 'x' ? 'X' : o}
          </button>
        ))}
      </div>
      {value && <p className="mt-1 text-[13px] text-navy-light/80 font-body">{SCALE_LABELS[value]}</p>}
    </div>
  )
}

export function CdebRecommendationModal({
  groupId, planCode, member, enrollmentId, defaultDate, initial, onClose, onSaved,
}: {
  groupId: string
  planCode: string | null
  member: { id: string; name: string }
  enrollmentId?: string | null
  /** Fecha de cierre del grupo (prellena la de finalización). */
  defaultDate: string
  /** Borrador existente, si ya se había guardado. */
  initial?: Partial<CdebRecommendationInput> & { status?: string }
  onClose: () => void
  onSaved: (status: 'borrador' | 'enviada') => void
}) {
  const toast = useToast()
  const { studyTypes } = useStudyPlans()
  const allowX = allowsNoInfoOption(planCode)
  const [f, setF] = useState<CdebRecommendationInput>({
    member_id: member.id,
    completion_date: initial?.completion_date ?? defaultDate,
    convictions: initial?.convictions ?? [],
    testimony_score: initial?.testimony_score ?? null,
    testimony_notes: initial?.testimony_notes ?? '',
    passion_score: initial?.passion_score ?? null,
    passion_notes: initial?.passion_notes ?? '',
    bible_knowledge_score: initial?.bible_knowledge_score ?? null,
    speech_score: initial?.speech_score ?? null,
    speech_notes: initial?.speech_notes ?? '',
    commitment_notes: initial?.commitment_notes ?? '',
    committee_notes: initial?.committee_notes ?? '',
    recommendation: initial?.recommendation ?? null,
    recommended_prior_study: initial?.recommended_prior_study ?? null,
  })
  const [busy, setBusy] = useState<'borrador' | 'enviada' | null>(null)
  const [error, setError] = useState('')

  const set = <K extends keyof CdebRecommendationInput>(k: K, v: CdebRecommendationInput[K]) =>
    setF(prev => ({ ...prev, [k]: v }))

  const flagOf = (topic: string): ConvictionFlag | undefined => f.convictions.find(c => c.topic === topic)
  function setStance(topic: string, stance: string | null) {
    setF(prev => {
      const rest = prev.convictions.filter(c => c.topic !== topic)
      if (!stance) return { ...prev, convictions: rest }
      const cur = prev.convictions.find(c => c.topic === topic)
      return { ...prev, convictions: [...rest, { topic, stance, notes: cur?.notes ?? '' }] }
    })
  }
  function setNotes(topic: string, notes: string) {
    setF(prev => ({
      ...prev,
      convictions: prev.convictions.map(c => (c.topic === topic ? { ...c, notes } : c)),
    }))
  }

  async function save(status: 'borrador' | 'enviada') {
    if (busy) return
    if (status === 'enviada') {
      const err = validateCdebRecommendation(f, planCode)
      if (err) { setError(err); return }
    }
    setError(''); setBusy(status)
    try {
      const res = await fetch('/api/studies/cdeb-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, group_id: groupId, enrollment_id: enrollmentId ?? null, status }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.error || 'No se pudo guardar.')
      toast(status === 'enviada' ? `Recomendación de ${member.name} enviada al comité.` : 'Borrador guardado.', 'success')
      onSaved(status)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally { setBusy(null) }
  }

  return (
    <Modal onClose={() => !busy && onClose()} titleId="cdeb-title" width={560}>
      <div className="max-h-[85vh] overflow-y-auto p-6 space-y-5">
        <div className="space-y-2">
          <h2 id="cdeb-title" className="text-base font-bold text-navy font-display inline-flex items-center gap-2">
            <Sparkles size={16} className="text-coral" /> Recomendar a {member.name} para CDEB
          </h2>
          <div className="rounded-xl bg-teal/8 border border-teal/20 px-4 py-3 space-y-1">
            {HEADER_TEXT.map((t, i) => (
              <p key={i} className="text-[13px] text-navy font-body">{t}</p>
            ))}
          </div>
        </div>

        {/* Fecha de finalización (prellenada con la del cierre) */}
        <div>
          <label htmlFor="cdeb-date" className={LABEL}>{COMPLETION_DATE_LABEL}</label>
          <input id="cdeb-date" type="date" value={f.completion_date ?? ''} onChange={e => set('completion_date', e.target.value)} className={INPUT} />
          <p className="mt-1 text-[13px] text-navy-light/80 font-body">{COMPLETION_DATE_HINT}</p>
        </div>

        {/* Convicciones POR EXCEPCIÓN */}
        <div className="space-y-2">
          <label className={LABEL}>Convicciones</label>
          <p className="text-[13px] text-navy-light/80 font-body">{CONVICTIONS_INSTRUCTION}</p>
          <div className="space-y-2">
            {CONVICTION_TOPICS.map(t => {
              const flag = flagOf(t.value)
              return (
                <div key={t.value} className="rounded-xl border border-navy/10 px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[13px] text-navy font-body">{t.label}</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        aria-pressed={!flag}
                        onClick={() => setStance(t.value, null)}
                        className={cn('rounded-full px-2.5 py-1 text-[13px] font-body border transition-colors',
                          !flag ? 'bg-teal/15 text-teal-deep border-teal/40' : 'bg-white text-navy-light/80 border-navy/15')}
                      >
                        Convicción firme
                      </button>
                      {CONVICTION_STANCES.map(sOpt => (
                        <button
                          key={sOpt.value}
                          type="button"
                          aria-pressed={flag?.stance === sOpt.value}
                          onClick={() => setStance(t.value, sOpt.value)}
                          className={cn('rounded-full px-2.5 py-1 text-[13px] font-body border transition-colors',
                            flag?.stance === sOpt.value ? 'bg-coral text-white border-coral' : 'bg-white text-navy border-navy/15 hover:border-navy/30')}
                        >
                          {sOpt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {flag && (
                    <textarea
                      value={flag.notes ?? ''}
                      onChange={e => setNotes(t.value, e.target.value)}
                      rows={2}
                      placeholder="¿Qué viste? (obligatorio)"
                      aria-label={`Explicación sobre ${t.label}`}
                      className={cn(INPUT, 'mt-2 resize-none placeholder:text-navy-light/50')}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Escalas + textos */}
        <ScaleRow label={TESTIMONY_LABEL} value={f.testimony_score} onChange={v => set('testimony_score', v)} allowX={allowX} />
        <div>
          <label htmlFor="cdeb-testimony" className={LABEL}>{TESTIMONY_TEXT_LABEL} <span className="text-coral">*</span></label>
          <textarea id="cdeb-testimony" value={f.testimony_notes ?? ''} onChange={e => set('testimony_notes', e.target.value)} rows={2} placeholder={NA_HINT} className={cn(INPUT, 'resize-none placeholder:text-navy-light/50')} />
        </div>

        <ScaleRow label={PASSION_LABEL} value={f.passion_score} onChange={v => set('passion_score', v)} allowX={allowX} />
        <div>
          <label htmlFor="cdeb-passion" className={LABEL}>{PASSION_TEXT_LABEL} <span className="text-coral">*</span></label>
          <textarea id="cdeb-passion" value={f.passion_notes ?? ''} onChange={e => set('passion_notes', e.target.value)} rows={2} placeholder={NA_HINT} className={cn(INPUT, 'resize-none placeholder:text-navy-light/50')} />
        </div>

        <ScaleRow label={BIBLE_LABEL} value={f.bible_knowledge_score} onChange={v => set('bible_knowledge_score', v)} allowX={false} />

        <ScaleRow label={SPEECH_LABEL} value={f.speech_score} onChange={v => set('speech_score', v)} allowX={false} />
        <div>
          <label htmlFor="cdeb-speech" className={LABEL}>{SPEECH_TEXT_LABEL} <span className="text-coral">*</span></label>
          <textarea id="cdeb-speech" value={f.speech_notes ?? ''} onChange={e => set('speech_notes', e.target.value)} rows={2} className={cn(INPUT, 'resize-none')} />
        </div>

        <div>
          <label htmlFor="cdeb-commitment" className={LABEL}>{COMMITMENT_TEXT_LABEL} <span className="text-navy-light/80">(opcional)</span></label>
          <textarea id="cdeb-commitment" value={f.commitment_notes ?? ''} onChange={e => set('commitment_notes', e.target.value)} rows={2} className={cn(INPUT, 'resize-none')} />
        </div>

        <div>
          <label htmlFor="cdeb-committee" className={LABEL}>{COMMITTEE_TEXT_LABEL} <span className="text-coral">*</span></label>
          <textarea id="cdeb-committee" value={f.committee_notes ?? ''} onChange={e => set('committee_notes', e.target.value)} rows={3} className={cn(INPUT, 'resize-none')} />
        </div>

        {/* Recomendación final */}
        <div>
          <label className={LABEL}>{RECOMMENDATION_LABEL} <span className="text-coral">*</span></label>
          <div className="space-y-2">
            {RECOMMENDATION_OPTIONS.map(o => (
              <button
                key={o.value}
                type="button"
                aria-pressed={f.recommendation === o.value}
                onClick={() => set('recommendation', o.value)}
                className={cn('block w-full rounded-xl px-3.5 py-2.5 text-[13px] font-body border text-left transition-colors',
                  f.recommendation === o.value ? 'bg-teal/10 text-navy border-teal' : 'bg-white text-navy border-navy/15 hover:border-navy/30')}
              >
                {o.label}
              </button>
            ))}
          </div>
          {/* Con "otro estudio primero" el dirigente indica CUÁL (obligatorio al enviar). */}
          {f.recommendation === 'si_otro_estudio' && (
            <div className="mt-2">
              <label htmlFor="cdeb-prior-study" className={LABEL}>¿Cuál estudio debería llevar primero? <span className="text-coral">*</span></label>
              <select
                id="cdeb-prior-study"
                value={f.recommended_prior_study ?? ''}
                onChange={e => set('recommended_prior_study', e.target.value || null)}
                className="w-full rounded-xl border border-outline bg-surface-low px-3 py-2.5 text-sm text-navy font-body outline-none focus:ring-1 focus:ring-coral/30"
              >
                <option value="">Seleccionar estudio…</option>
                {studyTypes.map(s => <option key={s.id} value={s.code}>{s.code} — {s.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {error && <p className="rounded-xl bg-coral/5 px-4 py-3 text-[13px] text-coral-deep font-body" role="alert">{error}</p>}

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() => save('enviada')}
            disabled={!!busy}
            className="flex-1 min-w-40 rounded-full bg-coral px-4 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-50 font-body inline-flex items-center justify-center gap-2"
          >
            {busy === 'enviada' ? <><Loader2 size={15} className="animate-spin" /> Enviando…</> : <><Send size={14} /> Enviar al comité</>}
          </button>
          <button
            onClick={() => save('borrador')}
            disabled={!!busy}
            className="rounded-full border border-navy/20 px-4 py-2.5 text-sm text-navy hover:bg-navy/5 transition-colors disabled:opacity-50 font-body inline-flex items-center gap-2"
          >
            {busy === 'borrador' ? <><Loader2 size={15} className="animate-spin" /> Guardando…</> : <><Save size={14} /> Guardar borrador</>}
          </button>
          <button onClick={onClose} disabled={!!busy} className="rounded-full px-4 py-2.5 text-sm text-navy-light/80 hover:text-navy transition-colors font-body">
            Cancelar
          </button>
        </div>
        <p className="text-[13px] text-navy-light/80 font-body">
          El borrador no bloquea el cierre del grupo: podés completarlo después desde el grupo.
        </p>
      </div>
    </Modal>
  )
}
