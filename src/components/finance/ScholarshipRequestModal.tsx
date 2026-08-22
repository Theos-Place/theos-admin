'use client'

import { useState, useMemo } from 'react'
import { GraduationCap } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { useToast } from '@/components/shared/Toast'
import { cn } from '@/lib/utils'
import { useStudyPlans } from '@/hooks/useStudyPlans'
import { usePublicEvents } from '@/hooks/useEvents'

const MIN_REASON = 20
const FIELD_CLS = 'w-full rounded-xl border border-outline bg-surface-low px-3 py-2.5 text-sm text-navy font-body outline-none focus:ring-1 focus:ring-coral/30'

type Target = { entity_type: 'study_plan' | 'event'; id: string; name: string }

/** Modal de solicitud de beca, compartido entre el perfil del miembro (destino
 *  a elegir) y las tarjetas de /matricula y /mis-eventos (destino ya fijo). */
export function ScholarshipRequestModal({
  memberId, fixedTarget, onClose, onSubmitted,
}: {
  memberId: string
  /** Si viene, el destino ya está definido (desde una tarjeta de estudio/evento). */
  fixedTarget?: Target
  onClose: () => void
  onSubmitted?: () => void
}) {
  const toast = useToast()
  const { studyTypes } = useStudyPlans()
  // usePublicEvents (no requiere permiso 'eventos'): cualquier miembro puede
  // abrir este modal desde su perfil, no solo staff con acceso a eventos.
  const { events } = usePublicEvents()

  const [entityType, setEntityType] = useState<'study_plan' | 'event'>(fixedTarget?.entity_type ?? 'study_plan')
  const [target, setTarget] = useState<Target | null>(fixedTarget ?? null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const planOptions = useMemo(
    () => studyTypes
      .filter(p => !p.is_archived && p.requires_payment && p.plan_id)
      .map(p => ({ id: p.plan_id!, name: `${p.code ?? ''} — ${p.name}`.trim() })),
    [studyTypes],
  )
  const eventOptions = useMemo(
    () => events.filter(e => e.requires_payment).map(e => ({ id: e.id, name: e.name })),
    [events],
  )
  const options = entityType === 'study_plan' ? planOptions : eventOptions

  async function submit() {
    if (!target) { setError('Elegí el estudio o evento.'); return }
    if (reason.trim().length < MIN_REASON) {
      setError(`Contanos un poco más: la razón debe tener al menos ${MIN_REASON} caracteres.`)
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/finance/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: memberId,
          request_type: 'scholarship',
          entity_type: target.entity_type,
          plan_id: target.entity_type === 'study_plan' ? target.id : null,
          event_id: target.entity_type === 'event' ? target.id : null,
          reason: reason.trim(),
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'No se pudo enviar la solicitud')
      toast('Solicitud de beca enviada. El equipo de finanzas la revisará pronto.', 'success')
      onSubmitted?.()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar la solicitud')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal onClose={() => !submitting && onClose()} titleId="solicitar-beca-title">
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <GraduationCap size={18} className="text-coral" />
          <h2 id="solicitar-beca-title" className="text-lg font-semibold text-navy font-display">Solicitar beca</h2>
        </div>

        {!fixedTarget && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {([['study_plan', 'Estudio'], ['event', 'Evento']] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => { setEntityType(v); setTarget(null) }}
                  className={cn('rounded-xl p-2.5 text-sm font-medium border transition-all text-left font-body', entityType === v ? 'border-coral bg-coral/5 text-coral' : 'border-outline bg-surface-low text-navy/80')}>
                  {l}
                </button>
              ))}
            </div>
            <div>
              <label htmlFor="schol-target" className="block text-[13px] font-medium text-navy-light/80 font-body mb-1.5">
                {entityType === 'study_plan' ? 'Estudio' : 'Evento'}
              </label>
              <select
                id="schol-target"
                value={target?.id ?? ''}
                onChange={e => {
                  const found = options.find(o => o.id === e.target.value)
                  setTarget(found ? { entity_type: entityType, id: found.id, name: found.name } : null)
                }}
                className={FIELD_CLS}
              >
                <option value="">Seleccionar…</option>
                {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          </>
        )}

        {fixedTarget && (
          <div className="rounded-xl bg-surface-low px-4 py-3">
            <p className="text-[13px] uppercase tracking-widest text-navy-light/80 font-display">Solicitando beca para</p>
            <p className="text-sm font-medium text-navy font-body">{fixedTarget.name}</p>
          </div>
        )}

        <div>
          <label htmlFor="schol-reason" className="block text-[13px] font-medium text-navy-light/80 font-body mb-1.5">
            Razón <span className="text-coral">*</span>
          </label>
          <textarea
            id="schol-reason"
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="Contanos por qué (mínimo 20 caracteres)…"
            className={cn(FIELD_CLS, 'resize-none placeholder:text-navy-light/80')}
          />
          <p className={cn('mt-1 text-[13px] font-body', reason.trim().length < MIN_REASON ? 'text-navy-light/80' : 'text-success')}>
            {reason.trim().length}/{MIN_REASON} caracteres mínimos
          </p>
        </div>

        {error && <p className="text-[13px] text-coral font-body">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} disabled={submitting} className="rounded-full px-4 py-2 text-sm text-navy-light/80 font-body hover:text-navy transition-colors">
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
      </div>
    </Modal>
  )
}
