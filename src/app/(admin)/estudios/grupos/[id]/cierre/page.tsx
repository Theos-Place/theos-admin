'use client'

import { use, useState, useCallback, useEffect } from 'react'
import { useToast } from '@/components/shared/Toast'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useGroup } from '@/hooks/useGroup'
import type { StudyGroup, StudyType } from '@/types/study'
import { cn } from '@/lib/utils'
import { DeleteConfirmModal } from '@/components/shared/DeleteConfirmModal'
import { allowsCloseRecommendations } from '@/lib/studies/close-recommendations'
import { allowsCdebRecommendation } from '@/lib/studies/cdeb-recommendation'
import { CdebRecommendationModal } from '@/components/studies/CdebRecommendationModal'
import { PrematCoupleEvaluation } from '@/components/studies/PrematCoupleEvaluation'
import { validatePrematEvaluation, type PrematEvaluationInput } from '@/lib/studies/premat-evaluation'
import { toClosePayload, missingReasons, missingReasonsMessage } from '@/lib/studies/close-payload'
import { ChevronLeft, CheckCircle, AlertTriangle, BookOpen, Star, Sparkles } from 'lucide-react'

type ParticipantResult = {
  member_id: string
  member_name: string
  attendance_pct: number
  status_result: 'aprobado' | 'reprobado' | 'retirado' | ''
  grade: string
  /** Justificación obligatoria al reprobar. */
  fail_reason: string
  /** Comentario OPCIONAL al retirar (pedido 2026-07-31): por qué se retiró. */
  withdraw_reason: string
  rec_oracion: boolean
  rec_servicio: boolean
  rec_dirigente: boolean
  rec_justification: string
}

export default function CierrePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { group, studyTypes, loading } = useGroup(id)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <div className="h-6 w-6 rounded-full border-2 border-coral border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!group) {
    return (
      <div className="space-y-4">
        <Link href="/estudios/grupos" className="flex items-center gap-1 text-sm text-navy-light/80 hover:text-navy">
          <ChevronLeft size={16} /> Grupos
        </Link>
        <p className="text-navy-light/80 font-body">Grupo no encontrado.</p>
      </div>
    )
  }

  // Solo grupos EN CURSO se cierran (la URL era accesible en cualquier estado).
  if (group.status !== 'en_curso') {
    return (
      <div className="space-y-4">
        <Link href={`/estudios/grupos/${group.id}`} className="flex items-center gap-1 text-sm text-navy-light/80 hover:text-navy">
          <ChevronLeft size={16} /> Volver al grupo
        </Link>
        <p className="text-navy-light/80 font-body">
          {group.status === 'finalizado'
            ? 'Este grupo ya fue cerrado.'
            : 'Este grupo todavía está en matrícula; solo los grupos en curso se pueden cerrar.'}
        </p>
      </div>
    )
  }

  const studyType = studyTypes.find(s => s.code === group.study_type_id) ?? null
  return <CierreForm group={group} studyType={studyType} />
}

function CierreForm({ group, studyType }: { group: StudyGroup; studyType: StudyType | null }) {
  const router = useRouter()
  const toast = useToast()
  const [step, setStep] = useState(1)
  // PRE-8: evaluaciones de pareja (solo grupos PREMAT).
  const [evals, setEvals] = useState<PrematEvaluationInput[]>([])
  const [pairsCount, setPairsCount] = useState(0)
  const handleEvalsChange = useCallback((next: PrematEvaluationInput[], count: number) => {
    setEvals(next); setPairsCount(count)
  }, [])
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<ParticipantResult[]>(() =>
    group.participants.map(p => ({
      member_id: p.member_id,
      member_name: p.member_name,
      attendance_pct: p.attendance_pct,
      status_result: (p.status === 'withdrawn' ? 'retirado' : '') as ParticipantResult['status_result'],
      grade: p.grade?.toString() ?? '',
      fail_reason: '',
      withdraw_reason: '',
      rec_oracion: false,
      rec_servicio: false,
      rec_dirigente: false,
      rec_justification: '',
    }))
  )
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [closed, setClosed] = useState(false)
  const [triedNext, setTriedNext] = useState(false)

  function setResult(memberId: string, field: keyof ParticipantResult, value: string | boolean) {
    setResults(prev => prev.map(r =>
      r.member_id === memberId ? { ...r, [field]: value } : r
    ))
  }

  const unevaluated = results.filter(r => r.status_result === '').length
  // Regla pura (con tests): reprobado exige justificación y retirado exige
  // motivo (obligatorio desde 2026-08-04). Las dos bloquean el cierre.
  const faltanMotivos = missingReasons(results)
  const faltanMotivosMsg = missingReasonsMessage(
    faltanMotivos,
    id => results.find(r => r.member_id === id)?.member_name ?? 'un estudiante',
  )
  const aprobados = results.filter(r => r.status_result === 'aprobado').length
  const reprobados = results.filter(r => r.status_result === 'reprobado').length
  const retirados = results.filter(r => r.status_result === 'retirado').length
  const autoPromotable = studyType?.auto_promote && studyType?.next_study_id

  // EST-9: en DIS3 / Panorama el cierre lleva el flujo de recomendación a CDEB
  // POR ESTUDIANTE, y el bloque simple de EST-3 (oración/servicio/dirigente)
  // NO se muestra — nunca los dos juntos (decisión confirmada).
  const isCdebSource = allowsCdebRecommendation(group.study_type_id)
  // EST-3: recomendaciones simples solo en N4+ o capacitaciones (DIS), y solo
  // cuando el grupo no es de los que llevan el flujo CDEB.
  const canRecommend = !isCdebSource && allowsCloseRecommendations(group.study_type_id)

  // EST-9: modal de recomendación a CDEB (un estudiante a la vez) + estado de
  // lo ya guardado (borrador/enviada) para mostrarlo en la lista.
  const [cdebTarget, setCdebTarget] = useState<{ id: string; name: string } | null>(null)
  const [cdebByMember, setCdebByMember] = useState<Record<string, { status: string } & Record<string, unknown>>>({})
  const loadCdeb = useCallback(() => {
    if (!isCdebSource) return
    fetch(`/api/studies/cdeb-recommendations?group_id=${group.id}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        const items: Array<{ member_id: string; status: string }> = d?.items ?? []
        setCdebByMember(Object.fromEntries(items.map(i => [i.member_id, i as never])))
      })
      .catch(() => {})
  }, [isCdebSource, group.id])
  useEffect(() => { loadCdeb() }, [loadCdeb])

  // PRE-8: los grupos prematrimoniales llevan una evaluación POR PAREJA antes
  // de cerrar (el API la exige igual; esto es el form + gate de UX).
  const isPremat = group.study_type_id === 'PREMAT'
  const evalsIncomplete = isPremat && (
    evals.length < pairsCount || evals.some(e => validatePrematEvaluation(e) !== null)
  )

  // FOL-1: el cierre ya no genera folletos (reglas nuevas: cupo lleno /
  // fin de matrícula durante la matrícula + manual).

  async function handleClose() {
    if (submitting) return
    setSubmitting(true)
    try {
      // Cada campo viaja solo con su resultado (ver lib/studies/close-payload.ts).
      const payload = toClosePayload(results, canRecommend)

      const res = await fetch(`/api/studies/groups/${group.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          results: payload,
          ...(isPremat ? { evaluations: evals } : {}),
        }),
      })
      if (!res.ok) throw new Error('Error en el cierre de estudio')
      setClosed(true)
      router.refresh()
    } catch (e) {
      console.error(e)
      toast('No se pudo completar el cierre de estudio. Intentá de nuevo.', 'error')
      setSubmitting(false)
    }
  }

  if (closed) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <div className="text-center space-y-3">
          <CheckCircle size={48} className="text-teal-deep mx-auto" />
          <p className="text-xl font-bold text-navy font-display">
            Cierre de estudio completado
          </p>
          <p className="text-sm text-navy-light/80 font-body">
            Los historiales académicos fueron actualizados.
          </p>
          <Link
            href="/estudios/grupos"
            className="inline-block rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors mt-2"
          >
            Ver todos los grupos
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Link
        href={`/estudios/grupos/${group.id}`}
        className="flex items-center gap-1 text-sm text-navy-light/80 hover:text-navy transition-colors font-body"
      >
        <ChevronLeft size={16} /> Volver al grupo
      </Link>

      <div>
        <h1
          className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]"
        >
          Cierre de estudio
        </h1>
        <p className="mt-1 text-sm text-navy-light/80 font-body">
          {group.study_type_id} · {group.leader_name ?? 'Sin dirigente'}
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2].map(n => (
          <div key={n} className="flex items-center gap-2">
            <div
              className={cn(
                'h-7 w-7 rounded-full flex items-center justify-center text-[13px] font-bold transition-all',
                step >= n ? 'bg-coral text-white' : 'bg-surface-low text-navy-light/80',
                'font-display',
              )}
            >
              {n}
            </div>
            <span
              className={cn('text-[13px]', step >= n ? 'text-navy' : 'text-navy-light/80', 'font-body')}
            >
              {n === 1 ? 'Resultados' : 'Confirmación'}
            </span>
            {n < 2 && <div className="h-px w-8 bg-surface-low" />}
          </div>
        ))}
      </div>

      {/* Step 1: Results */}
      {step === 1 && (
        <div className="space-y-4">
          {triedNext && (unevaluated > 0 || faltanMotivos.length > 0) && (
            <div className="flex items-start gap-2 rounded-xl bg-coral/10 px-4 py-3" role="alert">
              <AlertTriangle size={16} className="text-coral shrink-0 mt-0.5" />
              <p className="text-sm text-coral font-body">
                {unevaluated > 0 && `${unevaluated} estudiante${unevaluated > 1 ? 's' : ''} sin estado asignado. `}
                {faltanMotivosMsg}
              </p>
            </div>
          )}

          {results.length === 0 && (
            <div className="rounded-xl bg-surface-low px-4 py-3">
              <p className="text-sm text-navy-light/80 font-body">
                Este grupo no tiene participantes matriculados.
              </p>
            </div>
          )}

          <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
            <div className="px-4 py-3 border-b border-[var(--outline-variant)]">
              <h2 className="text-sm font-semibold text-navy font-display">
                Resultados de participantes
              </h2>
            </div>
            <div className="divide-y border-[var(--outline-variant)]">
              {results.map(r => (
                <div key={r.member_id} className="px-4 py-3 space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-navy font-body">{r.member_name}</p>
                      <p className="text-[13px] text-navy-light/80">Asistencia: {r.attendance_pct}%</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {(['aprobado', 'reprobado', 'retirado'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => setResult(r.member_id, 'status_result', s)}
                          className={cn(
                            'rounded-lg px-2.5 py-1 text-[13px] font-medium border transition-all',
                            r.status_result === s
                              ? s === 'aprobado'
                                ? 'bg-teal-deep text-white border-teal-deep'
                                : s === 'reprobado'
                                ? 'bg-coral text-white border-coral'
                                : 'bg-surface-low text-navy-light/80 border-navy-light/20'
                              : 'text-navy-light hover:bg-surface-low',
                            'font-display',
                          )}
                          style={{ borderColor: r.status_result === s ? undefined : 'var(--outline-variant)' }}
                        >
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                      ))}
                      {studyType?.requires_grade && (r.status_result === 'aprobado' || r.status_result === 'reprobado') && (
                        <input
                          type="number"
                          min={0}
                          max={100}
                          placeholder="Nota"
                          aria-label={`Nota de ${r.member_name}`}
                          className="w-16 rounded-lg bg-surface-low px-2 py-1 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
                          value={r.grade}
                          onChange={e => setResult(r.member_id, 'grade', e.target.value)}
                        />
                      )}
                    </div>
                  </div>

                  {/* Justificación obligatoria al reprobar */}
                  {r.status_result === 'reprobado' && (
                    <div>
                      <label htmlFor={`fail-${r.member_id}`} className="block text-[13px] font-medium text-coral font-body mb-1">
                        Explicá por qué <span aria-hidden>*</span>
                      </label>
                      <textarea
                        id={`fail-${r.member_id}`}
                        rows={2}
                        value={r.fail_reason}
                        onChange={e => setResult(r.member_id, 'fail_reason', e.target.value)}
                        placeholder="Justificación del reprobado…"
                        className={cn(
                          'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body resize-none placeholder:text-navy-light/50',
                          triedNext && !r.fail_reason.trim() && 'ring-1 ring-coral',
                        )}
                      />
                    </div>
                  )}

                  {/* Motivo OBLIGATORIO al retirar (2026-08-04): se abre solo al
                      elegir "Retirado". Queda en drop_reason de la inscripción. */}
                  {r.status_result === 'retirado' && (
                    <div>
                      <label htmlFor={`withdraw-${r.member_id}`} className="block text-[13px] font-medium text-navy-light/80 font-body mb-1">
                        Motivo del retiro *
                      </label>
                      <textarea
                        id={`withdraw-${r.member_id}`}
                        rows={2}
                        value={r.withdraw_reason}
                        onChange={e => setResult(r.member_id, 'withdraw_reason', e.target.value)}
                        placeholder="Ej.: se mudó de zona, cambió de horario de trabajo, motivos de salud…"
                        aria-required="true"
                        aria-invalid={triedNext && !r.withdraw_reason.trim() ? true : undefined}
                        className={cn(
                          'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body resize-none placeholder:text-navy-light/50',
                          triedNext && !r.withdraw_reason.trim() && 'ring-1 ring-coral',
                        )}
                      />
                    </div>
                  )}

                  {/* EST-9: recomendación a CDEB por estudiante (DIS3/Panorama).
                      El form se abre SOLO al tocar el botón — no es para todos. */}
                  {isCdebSource && r.status_result === 'aprobado' && (() => {
                    const saved = cdebByMember[r.member_id]
                    return (
                      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-low px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => setCdebTarget({ id: r.member_id, name: r.member_name })}
                          className="inline-flex items-center gap-1.5 rounded-full border border-coral/40 px-3 py-1.5 text-[13px] text-coral hover:bg-coral/5 transition-colors font-body"
                        >
                          <Sparkles size={12} /> {saved ? 'Editar recomendación a CDEB' : 'Recomendar para CDEB'}
                        </button>
                        {saved && (
                          <span className={cn('rounded-full px-2.5 py-0.5 text-[13px] font-semibold font-display',
                            saved.status === 'enviada' ? 'bg-teal-soft/30 text-teal-deep' : 'bg-amber-50 text-amber-700')}>
                            {saved.status === 'enviada' ? 'Enviada al comité' : 'Borrador guardado'}
                          </span>
                        )}
                      </div>
                    )
                  })()}

                  {/* Recomendaciones opcionales — solo N4+ o capacitaciones (EST-3) */}
                  {canRecommend && r.status_result !== '' && r.status_result !== 'retirado' && (
                    <div className="rounded-xl bg-surface-low px-3 py-2.5 space-y-2">
                      <p className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
                        Recomendar para (opcional)
                      </p>
                      <div className="flex items-center gap-4 flex-wrap">
                        {([
                          ['rec_oracion', 'Oración'],
                          ['rec_servicio', 'Servicio'],
                          ['rec_dirigente', 'Dirigente'],
                        ] as const).map(([field, label]) => (
                          <label key={field} className="flex items-center gap-1.5 cursor-pointer text-[13px] text-navy font-body">
                            <input
                              type="checkbox"
                              className="accent-coral"
                              checked={r[field]}
                              onChange={e => setResult(r.member_id, field, e.target.checked)}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                      {(r.rec_oracion || r.rec_servicio || r.rec_dirigente) && (
                        <textarea
                          rows={2}
                          value={r.rec_justification}
                          onChange={e => setResult(r.member_id, 'rec_justification', e.target.value)}
                          placeholder="Justificación de la recomendación (opcional)…"
                          aria-label={`Justificación de la recomendación de ${r.member_name}`}
                          className="w-full rounded-xl bg-surface-card px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body resize-none placeholder:text-navy-light/50"
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* PRE-8: cierre especial de prematrimonial — evaluación por pareja. */}
          {isPremat && (
            <div className="space-y-3">
              <h2 className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
                Evaluación de la pareja (mentores)
              </h2>
              <PrematCoupleEvaluation groupId={group.id} onChange={handleEvalsChange} />
            </div>
          )}

          {triedNext && evalsIncomplete && (
            <p className="rounded-xl bg-coral/5 px-4 py-3 text-[13px] text-coral-deep font-body" role="alert">
              Completá la evaluación de {pairsCount === 1 ? 'la pareja' : 'cada pareja'}: el compromiso, si hay punto ciego (con su descripción) y el plan de acción son obligatorios.
            </p>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => {
                setTriedNext(true)
                if (unevaluated === 0 && faltanMotivos.length === 0 && !evalsIncomplete) setStep(2)
              }}
              className="rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body"
            >
              Continuar →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Confirm */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)]">
            <h2 className="text-[11px] tracking-widest uppercase text-navy-light/80 mb-4 font-display">
              Resumen
            </h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Aprobados', value: aprobados, color: 'text-teal-deep' },
                { label: 'Reprobados', value: reprobados, color: 'text-coral' },
                { label: 'Retirados', value: retirados, color: 'text-navy-light/80' },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center rounded-xl p-3 bg-surface-low">
                  <p className={`text-2xl font-bold font-display ${color}`}>{value}</p>
                  <p className="text-[13px] text-navy-light/80 font-body">{label}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <BookOpen size={14} className="text-navy mt-0.5 shrink-0" />
                <p className="text-sm text-navy-light/80 font-body">
                  Se actualizará el historial académico de{' '}
                  <strong className="text-navy">{aprobados + reprobados}</strong> estudiantes
                </p>
              </div>

              {autoPromotable && studyType && (
                <div className="flex items-start gap-2">
                  <Star size={14} className="text-coral mt-0.5 shrink-0" />
                  <p className="text-sm text-navy-light/80 font-body">
                    <strong className="text-navy">{aprobados}</strong> estudiantes califican para transición automática a{' '}
                    <strong className="text-navy">{studyType.next_study_id}</strong>
                  </p>
                </div>
              )}
            </div>
          </div>


          {/* Advertencia: el cierre es irreversible. */}
          <div className="rounded-2xl p-5 bg-coral/5 border border-coral/20 flex items-start gap-3">
            <AlertTriangle size={18} className="text-coral mt-0.5 shrink-0" />
            <p className="text-[13px] text-navy-light/80 leading-relaxed font-body">
              Estás a punto de cerrar este grupo. Esta acción es <strong className="text-navy">definitiva y no se puede deshacer</strong>:
              se registrarán las calificaciones y recomendaciones, y el grupo quedará finalizado.
            </p>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              disabled={submitting}
              className="rounded-xl border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
            >
              ← Atrás
            </button>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={submitting}
              className="rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40 font-body"
            >
              {submitting ? 'Cerrando...' : 'Cerrar grupo'}
            </button>
          </div>
        </div>
      )}

      {cdebTarget && (
        <CdebRecommendationModal
          groupId={group.id}
          planCode={group.study_type_id}
          member={cdebTarget}
          enrollmentId={null}
          defaultDate={new Date().toISOString().slice(0, 10)}
          initial={cdebByMember[cdebTarget.id] as never}
          onClose={() => setCdebTarget(null)}
          onSaved={() => loadCdeb()}
        />
      )}

      <DeleteConfirmModal
        open={confirmOpen}
        keyword="cerrar"
        confirmLabel="Cerrar grupo"
        loading={submitting}
        title="Cerrar grupo de estudio"
        description="Esta acción es definitiva y no se puede deshacer: se registrarán las calificaciones y recomendaciones, y el grupo quedará finalizado."
        onConfirm={handleClose}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
