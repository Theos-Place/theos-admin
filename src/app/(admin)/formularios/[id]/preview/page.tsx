'use client'

import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { MOCK_FORM_TEMPLATES } from '@/data/mock-forms'
import { PublicField } from '@/components/forms/PublicField'
import { cn } from '@/lib/utils'
import { AlertTriangle, Check, ChevronLeft } from 'lucide-react'

export default function PreviewPage() {
  const { id } = useParams<{ id: string }>()
  const form = useMemo(() => MOCK_FORM_TEMPLATES.find(f => f.id === id), [id])

  const [answers, setAnswers] = useState<Record<string, string | string[] | number>>({})
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  if (!form) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <p className="text-sm text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>Formulario no encontrado.</p>
      </div>
    )
  }

  function setAnswer(fieldId: string, value: string | string[] | number) {
    setAnswers(prev => ({ ...prev, [fieldId]: value }))
    setErrors(prev => prev.filter(e => e !== fieldId))
  }

  function isVisible(fieldIndex: number): boolean {
    const field = form!.fields[fieldIndex]
    if (!field.conditional) return true
    const { field_id, operator, value } = field.conditional
    const ans = answers[field_id]
    const ansStr = Array.isArray(ans) ? ans.join(', ') : String(ans ?? '')
    if (operator === 'eq') return ansStr === value
    if (operator === 'neq') return ansStr !== value
    return true
  }

  function handleSubmit() {
    const requiredErrors = form!.fields
      .filter((f, i) => f.type !== 'section' && f.is_required && isVisible(i))
      .filter(f => {
        const ans = answers[f.id]
        return ans === undefined || ans === '' || (Array.isArray(ans) && ans.length === 0)
      })
      .map(f => f.id)

    if (requiredErrors.length > 0) {
      setErrors(requiredErrors)
      return
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--surface-low)' }}>
        <div className="w-full max-w-md text-center space-y-5">
          <div className="h-16 w-16 rounded-full bg-teal-soft/30 flex items-center justify-center mx-auto">
            <Check size={28} className="text-teal-deep" />
          </div>
          <h2 className="text-2xl font-extrabold text-navy" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
            ¡Respuesta enviada!
          </h2>
          <p className="text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
            Gracias por completar el formulario. Tu respuesta fue registrada correctamente.
          </p>
          <button
            type="button"
            onClick={() => { setSubmitted(false); setAnswers({}) }}
            className="rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Enviar otra respuesta
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--surface-low)' }}>
      {/* Preview banner */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-2 bg-amber-500">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-white" />
          <span className="text-[12px] font-semibold text-white" style={{ fontFamily: 'var(--font-display)' }}>
            VISTA PREVIA — Este formulario no está guardando respuestas
          </span>
        </div>
        <Link
          href={`/formularios/${id}`}
          className="flex items-center gap-1 text-[12px] text-white/80 hover:text-white transition-colors"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          <ChevronLeft size={13} />
          Volver al editor
        </Link>
      </div>

      <div className="px-4 py-10">
        <div
          className="w-full max-w-lg mx-auto rounded-2xl overflow-hidden"
          style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
        >
          {/* Form header */}
          <div className="px-8 pt-8 pb-6 border-b" style={{ borderColor: 'var(--outline-variant)' }}>
            <div className="flex justify-center mb-6">
              <Image
                src="/logo-theos-white.png"
                alt="Theos Place"
                width={100}
                height={28}
                className="object-contain opacity-60"
              />
            </div>
            <h1
              className="text-2xl font-extrabold text-navy text-center"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
            >
              {form.name}
            </h1>
            {form.description && (
              <p className="text-sm text-navy-light/60 mt-2 text-center leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>
                {form.description}
              </p>
            )}
          </div>

          {/* Fields */}
          <div className="px-8 py-6 space-y-6">
            {form.fields.map((field, index) => {
              if (!isVisible(index)) return null

              const hasError = errors.includes(field.id)

              return (
                <div key={field.id} className={cn('space-y-2', field.type === 'section' && 'pt-2')}>
                  {field.type !== 'section' && (
                    <label className="block" style={{ fontFamily: 'var(--font-body)' }}>
                      <span className="text-sm font-semibold text-navy">
                        {field.label}
                        {field.is_required && <span className="ml-1 text-coral">*</span>}
                      </span>
                      {field.helper_text && (
                        <span className="block text-[12px] text-navy-light/50 mt-0.5">{field.helper_text}</span>
                      )}
                    </label>
                  )}

                  <PublicField
                    field={field}
                    value={answers[field.id]}
                    onChange={val => setAnswer(field.id, val)}
                  />

                  {hasError && (
                    <p className="text-[11px] text-coral" style={{ fontFamily: 'var(--font-body)' }}>
                      Este campo es obligatorio.
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Submit */}
          <div className="px-8 pb-8">
            {errors.length > 0 && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-coral/5 border border-coral/20 px-4 py-3">
                <AlertTriangle size={14} className="text-coral shrink-0" />
                <p className="text-[12px] text-coral" style={{ fontFamily: 'var(--font-body)' }}>
                  Por favor completá los campos obligatorios marcados en rojo.
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              className="w-full rounded-2xl bg-coral py-3.5 text-sm font-semibold text-white hover:bg-coral-deep transition-colors"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Enviar respuesta
            </button>
            <p className="text-center text-[11px] text-navy-light/30 mt-3" style={{ fontFamily: 'var(--font-body)' }}>
              Theos Place · {form.name}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
