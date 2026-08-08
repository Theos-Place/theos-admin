'use client'

// Evaluación del dirigente por parte del estudiante, al cerrar el grupo.
//
// Las preguntas salen del formulario que el comité edita en el builder; acá no
// hay ninguna hardcodeada. La pantalla pregunta ANTES si esta persona puede
// responder — llenar y que te rechacen al final es la peor forma de decir que no
// te toca.
import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Loader2, ChevronLeft, ShieldCheck } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { ScaleField } from '@/components/forms/ScaleField'
import { COMMENT_MAX } from '@/lib/studies/leader-feedback'
import { cn } from '@/lib/utils'

type Campo = {
  id: string; label: string; help_text: string | null; description: string | null
  field_type: string; options: string[]; is_required: boolean
  scale_min?: number | null; scale_max?: number | null
  scale_min_label?: string | null; scale_max_label?: string | null
}

/** Los tipos de campo que esta pantalla sabe pintar. Un tipo que no esté acá
 *  NO se muestra: por eso 'scale' tuvo que agregarse cuando la encuesta pasó de
 *  opciones con palabras a calificación 1-5 (2026-08-07). */
const ANSWERABLE = ['radio', 'scale', 'textarea']

type Estado = {
  group: { id: string; name: string | null; plan_name: string | null; leader_name: string | null }
  can_answer?: boolean
  reason?: string | null
  form_id?: string | null
  fields?: Campo[]
}

export default function EvaluarDirigentePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<Estado | null>(null)
  const [cargando, setCargando] = useState(true)
  // Las respuestas del cuestionario, por id de campo. Las preguntas salen del
  // formulario que el comité edita en el builder — acá no hay ninguna hardcodeada.
  const [answers, setAnswers] = useState<Record<string, string>>({})
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

  const campos = data?.fields ?? []
  const preguntas = campos.filter(c => ANSWERABLE.includes(c.field_type))
  const faltante = preguntas.find(c => c.is_required && !(answers[c.id] ?? '').trim())

  async function enviar() {
    if (faltante || enviando) return
    setEnviando(true); setError(null)
    try {
      const res = await fetch(`/api/studies/groups/${id}/leader-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
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

        {campos.map(c => {
          if (c.field_type === 'info') {
            return (
              <div key={c.id} className="rounded-xl bg-surface-low px-4 py-3 space-y-1">
                {c.label && <p className="text-[13px] font-bold text-navy font-display">{c.label}</p>}
                {c.description && (
                  <p className="text-[13px] text-navy-light/80 font-body leading-relaxed whitespace-pre-line">{c.description}</p>
                )}
              </div>
            )
          }
          if (c.field_type === 'radio') {
            return (
              <fieldset key={c.id} className="space-y-2">
                <legend className="text-[13px] text-navy font-body">
                  {c.label} {c.is_required && <span className="text-coral">*</span>}
                </legend>
                {c.help_text && <p className="text-[12px] text-navy-light/60 font-body">{c.help_text}</p>}
                <div className="space-y-1.5">
                  {c.options.map(o => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setAnswers(a => ({ ...a, [c.id]: o }))}
                      aria-pressed={answers[c.id] === o}
                      className={cn(
                        'w-full rounded-xl border px-4 py-2.5 text-left text-[13px] transition-colors font-body',
                        answers[c.id] === o
                          ? 'border-coral bg-coral/5 text-navy'
                          : 'border-[var(--outline-variant)] text-navy-light hover:bg-surface-low',
                      )}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </fieldset>
            )
          }
          if (c.field_type === 'scale') {
            // Calificación 1-5: ocupa un renglón en vez de cinco, que es el
            // punto de haber cambiado el formato — la encuesta entera cabe en
            // una pantalla. La escala misma la pinta ScaleField (una sola
            // implementación para las tres pantallas que la usan).
            return (
              <fieldset key={c.id} className="space-y-2">
                <legend className="text-[13px] text-navy font-body">
                  {c.label} {c.is_required && <span className="text-coral">*</span>}
                </legend>
                {c.help_text && <p className="text-[12px] text-navy-light/60 font-body">{c.help_text}</p>}
                <ScaleField
                  min={c.scale_min}
                  max={c.scale_max}
                  minLabel={c.scale_min_label}
                  maxLabel={c.scale_max_label}
                  value={answers[c.id]}
                  onChange={n => setAnswers(a => ({ ...a, [c.id]: String(n) }))}
                  ariaLabel={c.label}
                />
              </fieldset>
            )
          }
          if (c.field_type === 'textarea') {
            return (
              <div key={c.id} className="space-y-1.5">
                <label htmlFor={`f-${c.id}`} className="text-[13px] text-navy font-body block">
                  {c.label} {!c.is_required && <span className="text-navy-light/60">(opcional)</span>}
                </label>
                {c.help_text && <p className="text-[12px] text-navy-light/60 font-body">{c.help_text}</p>}
                <textarea
                  id={`f-${c.id}`}
                  rows={3}
                  maxLength={COMMENT_MAX}
                  value={answers[c.id] ?? ''}
                  onChange={e => setAnswers(a => ({ ...a, [c.id]: e.target.value }))}
                  className="w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 resize-y font-body"
                />
              </div>
            )
          }
          return null
        })}

        {error && <p className="text-[13px] text-coral font-body" role="alert">{error}</p>}

        <button
          type="button"
          onClick={enviar}
          disabled={!!faltante || enviando}
          className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-coral px-5 py-3 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40 font-body"
        >
          {enviando ? <><Loader2 size={15} className="animate-spin" /> Enviando…</> : 'Enviar evaluación'}
        </button>
        {faltante && (
          <p className="text-[12px] text-navy-light/60 font-body text-center">
            Falta responder: {faltante.label}
          </p>
        )}
      </div>
    </PageContainer>
  )
}
