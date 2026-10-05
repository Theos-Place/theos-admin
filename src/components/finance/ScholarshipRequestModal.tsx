'use client'

import { useState, useMemo, useEffect } from 'react'
import { GraduationCap } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { useToast } from '@/components/shared/Toast'
import { cn } from '@/lib/utils'
import { useStudyPlans } from '@/hooks/useStudyPlans'
import { usePublicEvents } from '@/hooks/useEvents'
import {
  RAZONES_DE_BECA, RAZON_LABEL, LEYENDA_DE_RAZONES, MINIMO_DEL_DETALLE,
  NOTA_DE_MONTO, AVISO_DE_CUPO, montoPedido, type RazonDeBeca,
} from '@/lib/finance/solicitud-de-beca'

/** Lo que el modal necesita de un grupo para que la persona lo reconozca. */
type GrupoDisponible = {
  group_id: string
  zone: string
  location: string
  schedule_days: string
  schedule_time: string
  leader_name: string
  spots_available: number
  is_virtual: boolean
}

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
  // BEC-5 · La categoría dice el QUÉ y sirve para contar; el texto dice el
  // caso, que es lo que finanzas lee para decidir. Son dos datos, no uno.
  const [razon, setRazon] = useState<RazonDeBeca | ''>('')
  const [monto, setMonto] = useState('')
  const [grupoId, setGrupoId] = useState('')
  const [grupos, setGrupos] = useState<{ code: string; lista: GrupoDisponible[] } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  /**
   * BEC-5 punto 3 · Los grupos concretos del estudio elegido.
   *
   * Salen de la MISMA elegibilidad que usa /matricula, así que solo se
   * ofrecen grupos a los que esta persona de verdad podría entrar: con cupo,
   * con la matrícula abierta y sin chocar con su etapa o su edad. Ofrecer
   * uno al que no puede entrar sería pedirle que elija para después
   * rechazarla.
   */
  const planId = entityType === 'study_plan' ? target?.id ?? null : null
  /**
   * La elegibilidad se indexa por CÓDIGO de estudio (`study_code`), no por
   * `plan_id` — que es lo que tiene el selector. Se traduce con el catálogo
   * de planes, igual que hace `/api/studies/request-options`.
   */
  const codigoDelPlan = useMemo(
    () => studyTypes.find(p => p.plan_id === planId)?.code ?? null,
    [studyTypes, planId],
  )
  /**
   * Lo cargado se guarda JUNTO CON SU CÓDIGO y el «cargando» se DERIVA.
   *
   * Con un `setGrupos(null)` al entrar al efecto, el lint marca —con razón—
   * que se llama a setState de forma síncrona dentro de un efecto. Guardando
   * a qué estudio pertenece la lista, se sabe si está al día comparando, y
   * de paso no se pueden mostrar los grupos del estudio anterior mientras
   * llega la respuesta del nuevo.
   */
  useEffect(() => {
    if (!planId || !codigoDelPlan) return
    let vivo = true
    fetch(`/api/matricula/eligibility?member_id=${memberId}`)
      .then(r => (r.ok ? r.json() : null))
      .then((d: { eligibility?: Array<{ study_code: string; available_groups?: GrupoDisponible[] }> } | null) => {
        if (!vivo) return
        const est = (d?.eligibility ?? []).find(x => x.study_code === codigoDelPlan)
        setGrupos({ code: codigoDelPlan, lista: est?.available_groups ?? [] })
      })
      .catch(() => { if (vivo) setGrupos({ code: codigoDelPlan, lista: [] }) })
    return () => { vivo = false }
  }, [planId, codigoDelPlan, memberId])

  /** Los grupos del estudio que está elegido AHORA, o null si todavía no. */
  const gruposDelPlan = grupos && grupos.code === codigoDelPlan ? grupos.lista : null

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
    if (!razon) { setError('Elegí por cuál razón pedís la beca.'); return }
    if (entityType === 'study_plan' && !grupoId) {
      setError('Elegí el grupo específico: día, zona y dirigente.')
      return
    }
    if (reason.trim().length < MINIMO_DEL_DETALLE) {
      setError(`Contanos un poco más: el detalle debe tener al menos ${MINIMO_DEL_DETALLE} caracteres.`)
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
          study_group_id: entityType === 'study_plan' ? grupoId : null,
          reason_category: razon,
          amount: montoPedido(monto),
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
                <button key={v} type="button" onClick={() => { setEntityType(v); setTarget(null); setGrupoId('') }}
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
                  setGrupoId('')
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

        {/* BEC-5 punto 3 · El GRUPO, no el tipo de estudio. Sin esto, cuando
            el grupo se llena nadie puede avisarle: una de las solicitudes
            reales decía «la había solicitado para Romanos pero ya está
            lleno». */}
        {entityType === 'study_plan' && target && (
          <div>
            <label htmlFor="schol-grupo" className="block text-[13px] font-medium text-navy-light/80 font-body mb-1.5">
              ¿Cuál grupo? <span className="text-coral">*</span>
            </label>
            {gruposDelPlan === null ? (
              <p className="text-[13px] text-navy-light/80 font-body">Buscando grupos…</p>
            ) : gruposDelPlan.length === 0 ? (
              <p className="text-[13px] text-coral-deep font-body">
                Ahora mismo no hay grupos con cupo para ese estudio. Escribinos y lo vemos.
              </p>
            ) : (
              <select id="schol-grupo" value={grupoId} onChange={e => setGrupoId(e.target.value)} className={FIELD_CLS}>
                <option value="">Seleccionar…</option>
                {gruposDelPlan.map(g => (
                  <option key={g.group_id} value={g.group_id}>
                    {[g.schedule_days, g.schedule_time, g.is_virtual ? 'Virtual' : (g.zone || g.location), g.leader_name]
                      .filter(Boolean).join(' · ')}
                    {typeof g.spots_available === 'number' ? ` — ${g.spots_available} cupos` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* BEC-5 punto 1 · Tres razones y nada más. */}
        <div>
          <label htmlFor="schol-razon" className="block text-[13px] font-medium text-navy-light/80 font-body mb-1.5">
            Razón <span className="text-coral">*</span>
          </label>
          <select id="schol-razon" value={razon}
            onChange={e => setRazon(e.target.value as RazonDeBeca | '')} className={FIELD_CLS}>
            <option value="">Seleccionar…</option>
            {RAZONES_DE_BECA.map(r => <option key={r} value={r}>{RAZON_LABEL[r]}</option>)}
          </select>
          <p className="mt-1 text-[13px] text-navy-light/80 font-body">{LEYENDA_DE_RAZONES}</p>
        </div>

        <div>
          <label htmlFor="schol-reason" className="block text-[13px] font-medium text-navy-light/80 font-body mb-1.5">
            Contanos tu situación <span className="text-coral">*</span>
          </label>
          <textarea
            id="schol-reason"
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder={`Ampliá un poco (mínimo ${MINIMO_DEL_DETALLE} caracteres)…`}
            className={cn(FIELD_CLS, 'resize-none placeholder:text-navy-light/80')}
          />
          <p className={cn('mt-1 text-[13px] font-body', reason.trim().length < MINIMO_DEL_DETALLE ? 'text-navy-light/80' : 'text-success')}>
            {reason.trim().length}/{MINIMO_DEL_DETALLE} caracteres mínimos
          </p>
        </div>

        {/* BEC-5 punto 2 · La nota va ANTES del campo: decir el 50% primero
            fija el techo y quien necesita menos lo dice. Un campo vacío con
            «¿cuánto necesitás?» invita a pedir el máximo. */}
        <div>
          <label htmlFor="schol-monto" className="block text-[13px] font-medium text-navy-light/80 font-body mb-1.5">
            Monto que necesitás (opcional)
          </label>
          <p className="mb-1.5 text-[13px] text-navy-light/80 font-body">{NOTA_DE_MONTO}</p>
          <input id="schol-monto" type="number" min={0} inputMode="numeric"
            value={monto} onChange={e => setMonto(e.target.value)}
            placeholder="Dejalo en blanco si necesitás el 50%"
            className={cn(FIELD_CLS, 'placeholder:text-navy-light/80')} />
        </div>

        {/* BEC-5 punto 4 · El aviso del cupo, antes de enviar. Sin esto la
            persona da el campo por asegurado y la decepción después es con
            Theos, no con un cupo que nunca existió. */}
        <div className="rounded-xl bg-amber-50 px-4 py-3">
          <p className="text-[13px] text-amber-900 font-body">{AVISO_DE_CUPO}</p>
        </div>

        {error && <p className="text-[13px] text-coral font-body">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} disabled={submitting} className="rounded-full px-4 py-2 text-sm text-navy-light/80 font-body hover:text-navy transition-colors">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="rounded-full bg-coral shadow-[var(--shadow-pulse-sm)] px-5 py-2 text-sm text-white font-body font-medium hover:bg-coral-deep transition-colors disabled:opacity-60"
          >
            {submitting ? 'Enviando…' : 'Enviar solicitud'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
