'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useStudies } from '@/hooks/useStudies'
import type { StudyGroup, StudyType } from '@/types/study'
import { cn } from '@/lib/utils'
import { ChevronLeft, CheckCircle, AlertTriangle, BookOpen, Star } from 'lucide-react'

type ParticipantResult = {
  member_id: string
  member_name: string
  attendance_pct: number
  status_result: 'aprobado' | 'reprobado' | 'retirado' | ''
  grade: string
}

export default function CierrePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { groups, studyTypes, loading } = useStudies()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <div className="h-6 w-6 rounded-full border-2 border-coral border-t-transparent animate-spin" />
      </div>
    )
  }

  const group = groups.find(g => g.id === id)
  if (!group) {
    return (
      <div className="space-y-4">
        <Link href="/estudios/grupos" className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy">
          <ChevronLeft size={16} /> Grupos
        </Link>
        <p className="text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>Grupo no encontrado.</p>
      </div>
    )
  }

  const studyType = studyTypes.find(s => s.code === group.study_type_id) ?? null
  return <CierreForm group={group} studyType={studyType} />
}

function CierreForm({ group, studyType }: { group: StudyGroup; studyType: StudyType | null }) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<ParticipantResult[]>(() =>
    group.participants.map(p => ({
      member_id: p.member_id,
      member_name: p.member_name,
      attendance_pct: p.attendance_pct,
      status_result: (p.status === 'withdrawn' ? 'retirado' : '') as ParticipantResult['status_result'],
      grade: p.grade?.toString() ?? '',
    }))
  )
  const [confirmText, setConfirmText] = useState('')
  const [closed, setClosed] = useState(false)
  const [triedNext, setTriedNext] = useState(false)

  function setResult(memberId: string, field: keyof ParticipantResult, value: string) {
    setResults(prev => prev.map(r =>
      r.member_id === memberId ? { ...r, [field]: value } : r
    ))
  }

  const unevaluated = results.filter(r => r.status_result === '').length
  const aprobados = results.filter(r => r.status_result === 'aprobado').length
  const reprobados = results.filter(r => r.status_result === 'reprobado').length
  const retirados = results.filter(r => r.status_result === 'retirado').length
  const autoPromotable = studyType?.auto_promote && studyType?.next_study_id
  const canClose = confirmText === 'CERRAR'

  async function handleClose() {
    if (!canClose) return
    setSubmitting(true)
    try {
      const payload = results
        .filter(r => r.status_result !== '')
        .map(r => ({
          member_id: r.member_id,
          status_result: r.status_result,
          grade: r.grade ? Number(r.grade) : null,
        }))
      const res = await fetch(`/api/studies/groups/${group.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: payload }),
      })
      if (!res.ok) throw new Error('Error cerrando el grupo')
      setClosed(true)
      router.refresh()
    } catch (e) {
      console.error(e)
      alert('No se pudo cerrar el grupo. Intentá de nuevo.')
      setSubmitting(false)
    }
  }

  if (closed) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <div className="text-center space-y-3">
          <CheckCircle size={48} className="text-teal-deep mx-auto" />
          <p className="text-xl font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
            Grupo cerrado exitosamente
          </p>
          <p className="text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
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
    <div className="max-w-2xl space-y-5">
      <Link
        href={`/estudios/grupos/${group.id}`}
        className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        <ChevronLeft size={16} /> Volver al grupo
      </Link>

      <div>
        <h1
          className="text-2xl text-navy"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}
        >
          Cierre del grupo
        </h1>
        <p className="mt-1 text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
          {group.study_type_id} · {group.leader_name ?? 'Sin dirigente'}
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2].map(n => (
          <div key={n} className="flex items-center gap-2">
            <div
              className={cn(
                'h-7 w-7 rounded-full flex items-center justify-center text-[12px] font-bold transition-all',
                step >= n ? 'bg-coral text-white' : 'bg-surface-low text-navy-light/40'
              )}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {n}
            </div>
            <span
              className={cn('text-[12px]', step >= n ? 'text-navy' : 'text-navy-light/40')}
              style={{ fontFamily: 'var(--font-body)' }}
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
          {triedNext && unevaluated > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-coral/10 px-4 py-3">
              <AlertTriangle size={16} className="text-coral" />
              <p className="text-sm text-coral" style={{ fontFamily: 'var(--font-body)' }}>
                {unevaluated} estudiante{unevaluated > 1 ? 's' : ''} sin estado asignado
              </p>
            </div>
          )}

          {results.length === 0 && (
            <div className="rounded-xl bg-surface-low px-4 py-3">
              <p className="text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
                Este grupo no tiene participantes matriculados.
              </p>
            </div>
          )}

          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--outline-variant)' }}>
              <h2 className="text-sm font-semibold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
                Resultados de participantes
              </h2>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--outline-variant)' }}>
              {results.map(r => (
                <div key={r.member_id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>{r.member_name}</p>
                    <p className="text-[11px] text-navy-light/50">Asistencia: {r.attendance_pct}%</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {(['aprobado', 'reprobado', 'retirado'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setResult(r.member_id, 'status_result', s)}
                        className={cn(
                          'rounded-lg px-2.5 py-1 text-[11px] font-medium border transition-all',
                          r.status_result === s
                            ? s === 'aprobado'
                              ? 'bg-teal-deep text-white border-teal-deep'
                              : s === 'reprobado'
                              ? 'bg-coral text-white border-coral'
                              : 'bg-surface-low text-navy-light/60 border-navy-light/20'
                            : 'text-navy-light hover:bg-surface-low'
                        )}
                        style={{ borderColor: r.status_result === s ? undefined : 'var(--outline-variant)', fontFamily: 'var(--font-display)' }}
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
                        className="w-16 rounded-lg bg-surface-low px-2 py-1 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30"
                        style={{ fontFamily: 'var(--font-body)' }}
                        value={r.grade}
                        onChange={e => setResult(r.member_id, 'grade', e.target.value)}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => {
                setTriedNext(true)
                if (unevaluated === 0) setStep(2)
              }}
              className="rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors"
              style={{ fontFamily: 'var(--font-body)' }}
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
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <h2 className="text-[10px] tracking-widest uppercase text-navy-light/40 mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              Resumen
            </h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Aprobados', value: aprobados, color: 'text-teal-deep' },
                { label: 'Reprobados', value: reprobados, color: 'text-coral' },
                { label: 'Retirados', value: retirados, color: 'text-navy-light/50' },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center rounded-xl p-3" style={{ background: 'var(--surface-low)' }}>
                  <p className={`text-2xl font-bold ${color}`} style={{ fontFamily: 'var(--font-display)' }}>{value}</p>
                  <p className="text-[11px] text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>{label}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <BookOpen size={14} className="text-navy mt-0.5 shrink-0" />
                <p className="text-sm text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
                  Se actualizará el historial académico de{' '}
                  <strong className="text-navy">{aprobados + reprobados}</strong> estudiantes
                </p>
              </div>

              {autoPromotable && studyType && (
                <div className="flex items-start gap-2">
                  <Star size={14} className="text-coral mt-0.5 shrink-0" />
                  <p className="text-sm text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
                    <strong className="text-navy">{aprobados}</strong> estudiantes califican para transición automática a{' '}
                    <strong className="text-navy">{studyType.next_study_id}</strong>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Confirmation input */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <p className="text-sm text-navy-light/70 mb-3" style={{ fontFamily: 'var(--font-body)' }}>
              Para confirmar el cierre, escribe{' '}
              <strong className="text-navy font-mono">CERRAR</strong> en el campo:
            </p>
            <input
              className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-mono"
              placeholder="CERRAR"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
            />
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              disabled={submitting}
              className="rounded-xl border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
              style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
            >
              ← Atrás
            </button>
            <button
              onClick={handleClose}
              disabled={!canClose || submitting}
              className="rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {submitting ? 'Cerrando...' : 'Confirmar cierre'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
