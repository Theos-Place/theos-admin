'use client'

// Evaluación del dirigente por parte del estudiante, al cerrar el grupo.
//
// Dos preguntas y listo: una nota con su etiqueta y un comentario opcional. La
// pantalla pregunta ANTES si esta persona puede responder — llenar y que te
// rechacen al final es la peor forma de decir que no te toca.
import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Loader2, ChevronLeft, ShieldCheck } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { SCORE_LABELS, SCORE_MIN, SCORE_MAX, COMMENT_MAX } from '@/lib/studies/leader-feedback'
import { cn } from '@/lib/utils'

type Estado = {
  group: { id: string; name: string | null; plan_name: string | null; leader_name: string | null }
  can_answer?: boolean
  reason?: string | null
}

export default function EvaluarDirigentePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<Estado | null>(null)
  const [cargando, setCargando] = useState(true)
  const [score, setScore] = useState<number | null>(null)
  const [comments, setComments] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    fetch(`/api/studies/groups/${id}/leader-feedback`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (vivo) { setData(d); setCargando(false) } })
      .catch(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [id])

  async function enviar() {
    if (score == null || enviando) return
    setEnviando(true); setError(null)
    try {
      const res = await fetch(`/api/studies/groups/${id}/leader-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score, comments: comments.trim() || null }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error || 'No se pudo enviar tu evaluación.')
      setListo(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar tu evaluación.')
    } finally { setEnviando(false) }
  }

  if (cargando) {
    return <PageContainer width="form"><p className="py-16 text-center text-sm text-navy-light/60 font-body">Cargando…</p></PageContainer>
  }
  if (!data) {
    return <PageContainer width="form"><p className="py-16 text-center text-sm text-navy-light/60 font-body">No se encontró el grupo.</p></PageContainer>
  }

  const estudio = data.group.plan_name ?? data.group.name ?? 'tu estudio'

  if (listo) {
    return (
      <PageContainer width="form">
        <div className="rounded-2xl bg-surface-card p-8 text-center space-y-4 shadow-[var(--shadow-md)]">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-teal/15 flex items-center justify-center">
            <Check size={26} className="text-teal-deep" />
          </div>
          <p className="text-lg font-bold text-navy font-display">¡Gracias!</p>
          <p className="text-[13px] text-navy-light/70 font-body">
            Tu evaluación quedó registrada. Le llega a la coordinación sin tu nombre.
          </p>
          <Link href="/matricula" className="inline-flex rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body">
            Volver a Matrícula
          </Link>
        </div>
      </PageContainer>
    )
  }

  if (data.can_answer === false) {
    return (
      <PageContainer width="form">
        <div className="rounded-2xl bg-surface-card p-8 text-center space-y-3 shadow-[var(--shadow-md)]">
          <p className="text-base font-bold text-navy font-display">{estudio}</p>
          <p className="text-[13px] text-navy-light/70 font-body">{data.reason}</p>
          <Link href="/matricula" className="inline-flex items-center gap-1.5 text-[13px] text-navy-light hover:text-navy transition-colors font-body">
            <ChevronLeft size={14} /> Volver
          </Link>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer width="form">
      <div className="rounded-2xl bg-surface-card p-6 sm:p-8 space-y-6 shadow-[var(--shadow-md)]">
        <div className="space-y-1.5">
          <h1 className="text-xl font-extrabold text-navy font-display tracking-[-0.02em]">
            ¿Cómo te fue en {estudio}?
          </h1>
          {data.group.leader_name && (
            <p className="text-[13px] text-navy-light/70 font-body">
              Dirigido por <strong className="text-navy">{data.group.leader_name}</strong>
            </p>
          )}
          <p className="flex items-start gap-1.5 text-[12px] text-navy-light/70 font-body pt-1">
            <ShieldCheck size={13} className="mt-0.5 shrink-0 text-teal-deep" />
            <span>Es <strong>anónimo para tu dirigente</strong>: ve el promedio y los comentarios, nunca quién los escribió.</span>
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-navy-light/60 font-display">Tu nota</p>
          <div className="space-y-1.5">
            {Array.from({ length: SCORE_MAX - SCORE_MIN + 1 }, (_, i) => SCORE_MAX - i).map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setScore(n)}
                aria-pressed={score === n}
                className={cn(
                  'w-full flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition-colors font-body',
                  score === n
                    ? 'border-coral bg-coral/5 text-navy'
                    : 'border-[var(--outline-variant)] text-navy-light hover:bg-surface-low',
                )}
              >
                <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold',
                  score === n ? 'bg-coral text-white' : 'bg-surface-low text-navy-light')}>{n}</span>
                <span className="text-[13px]">{SCORE_LABELS[n]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="retro-comentario" className="text-[11px] uppercase tracking-widest text-navy-light/60 font-display">
            ¿Algo que quieras contarnos? (opcional)
          </label>
          <textarea
            id="retro-comentario"
            rows={4}
            maxLength={COMMENT_MAX}
            value={comments}
            onChange={e => setComments(e.target.value)}
            placeholder="Lo que funcionó, lo que se puede mejorar…"
            className="w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 resize-y font-body"
          />
          <p className="text-right text-[11px] text-navy-light/60 font-mono">{comments.length}/{COMMENT_MAX}</p>
        </div>

        {error && <p className="text-[13px] text-coral font-body" role="alert">{error}</p>}

        <button
          type="button"
          onClick={enviar}
          disabled={score == null || enviando}
          className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-coral px-5 py-3 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40 font-body"
        >
          {enviando ? <><Loader2 size={15} className="animate-spin" /> Enviando…</> : 'Enviar evaluación'}
        </button>
      </div>
    </PageContainer>
  )
}
