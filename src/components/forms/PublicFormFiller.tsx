'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { PublicField } from '@/components/forms/PublicField'
import { faltaEnEnvioInvitado } from '@/lib/forms/public-access'
import { esCampoCalculado } from '@/lib/forms/computed-fields'
import { cn } from '@/lib/utils'

type Campo = {
  id: string; field_type: string; label: string
  placeholder: string | null; help_text: string | null; is_required: boolean
  options: string[] | null; description: string | null
  scale_min: number | null; scale_max: number | null
  scale_min_label: string | null; scale_max_label: string | null
}

/**
 * Formulario ABIERTO: se contesta sin cuenta.
 *
 * Es una pantalla aparte y no el FormFiller de siempre, a propósito. Aquél
 * depende de la sesión en todo: prellena datos del perfil, resuelve la
 * convocatoria, permite responder a nombre de otro y guarda borradores. Nada de
 * eso existe sin cuenta, y meterle condicionales a cada paso dejaría un
 * componente donde es difícil ver qué corre para un invitado — que es
 * exactamente donde se cuela un permiso de más.
 */
export function PublicFormFiller({ formId, form, fields }: {
  formId: string
  form: { title: string; description: string | null; hero_title: string | null; hero_subtitle: string | null; hero_image_url: string | null }
  fields: Campo[]
}) {
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [answers, setAnswers] = useState<Record<string, string | string[] | number>>({})
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState(false)
  /** El 409 de duplicado: la respuesta ya existía, no se guardó una nueva. */
  const [yaEstaba, setYaEstaba] = useState(false)

  // Los calculados no se dibujan (no aplican sin ficha) y el API los descarta
  // igual: acá es solo para no mostrar un hueco.
  const visibles = fields.filter(f => !esCampoCalculado(f.field_type))

  async function enviar() {
    if (enviando) return
    const faltaIdentidad = faltaEnEnvioInvitado({ nombre, correo })
    if (faltaIdentidad) { setError(faltaIdentidad); return }
    const sinContestar = visibles.filter(f => f.is_required
      && !['section', 'info', 'page_break'].includes(f.field_type)
      && (answers[f.id] === undefined || answers[f.id] === '' ||
        (Array.isArray(answers[f.id]) && (answers[f.id] as string[]).length === 0)))
    if (sinContestar.length) {
      setError(`Falta contestar: ${sinContestar.map(f => f.label).join(', ')}`)
      return
    }
    setError(null); setEnviando(true)
    try {
      const res = await fetch(`/api/public/forms/${formId}/responder`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_name: nombre, guest_email: correo, answers }),
      })
      const d = await res.json().catch(() => ({}))
      // Ya había una respuesta con ese correo. No es un error rojo: si el
      // envío se duplicó, la primera SÍ quedó guardada, y decirle que falló
      // haría que lo intente otra vez. Se muestra la pantalla de listo con el
      // texto que corresponde, sin mentir sobre lo que pasó.
      if (res.status === 409 && d?.code === 'ya_respondido') { setYaEstaba(true); setListo(true); return }
      if (!res.ok) { setError(d.error ?? 'No se pudo enviar el formulario.'); return }
      setListo(true)
    } catch {
      setError('No se pudo enviar. Revisá tu conexión.')
    } finally { setEnviando(false) }
  }

  if (listo) {
    return (
      <main className="mx-auto max-w-[560px] px-5 py-16 text-center space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-soft/30">
          <Check size={22} className="text-teal-deep" aria-hidden />
        </div>
        <h1 className="text-xl font-bold text-navy font-display">
          {yaEstaba ? 'Ya teníamos tu respuesta' : '¡Listo, recibimos tu respuesta!'}
        </h1>
        <p className="text-sm text-navy-light font-body">
          {yaEstaba
            ? 'Este formulario recibe una sola respuesta por persona, y la tuya ya está registrada. No tenés que hacer nada más.'
            : 'Gracias por tomarte el tiempo.'}
        </p>
      </main>
    )
  }

  const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'

  return (
    <main className="mx-auto max-w-[620px] px-5 py-10 space-y-6">
      {form.hero_image_url && (
        // eslint-disable-next-line @next/next/no-img-element -- imagen remota de portada; next/image exigiría remotePatterns para poco beneficio.
        <img src={form.hero_image_url} alt="" className="w-full aspect-[16/9] object-contain bg-surface-low rounded-2xl" />
      )}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-navy font-display text-balance">{form.hero_title || form.title}</h1>
        {(form.hero_subtitle || form.description) && (
          <p className="text-sm text-navy-light/80 font-body whitespace-pre-line">
            {form.hero_subtitle || form.description}
          </p>
        )}
      </div>

      {/* Identidad del invitado. Va arriba y no al final: es lo que convierte
          la respuesta en la de alguien, y pedirla al final se siente como un
          peaje después de haber trabajado. */}
      <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] space-y-3">
        <div className="space-y-1">
          <label htmlFor="inv-nombre" className="block text-sm font-semibold text-navy font-body">
            Tu nombre <span className="text-coral-deep">*</span>
          </label>
          <input id="inv-nombre" className={inputCls} value={nombre} onChange={e => setNombre(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label htmlFor="inv-correo" className="block text-sm font-semibold text-navy font-body">
            Tu correo <span className="text-coral-deep">*</span>
          </label>
          <input id="inv-correo" type="email" className={inputCls} value={correo} onChange={e => setCorreo(e.target.value)} />
          <p className="text-[13px] text-navy-light/80 font-body">Te mandamos la confirmación acá.</p>
        </div>
      </div>

      <div className="space-y-4">
        {visibles.map(f => {
          if (f.field_type === 'section') {
            return <h2 key={f.id} className="pt-2 text-base font-bold text-navy font-display">{f.label}</h2>
          }
          if (f.field_type === 'info') {
            return (
              <div key={f.id} className="rounded-2xl bg-surface-low px-4 py-3 space-y-1">
                {f.label && <p className="text-sm font-semibold text-navy font-body">{f.label}</p>}
                {f.description && <p className="text-[13px] text-navy-light/80 font-body whitespace-pre-line">{f.description}</p>}
              </div>
            )
          }
          if (f.field_type === 'page_break') return null
          return (
            <div key={f.id} className="space-y-1.5">
              <label htmlFor={`c-${f.id}`} className="block text-sm font-semibold text-navy font-body">
                {f.label} {f.is_required && <span className="text-coral-deep">*</span>}
              </label>
              {f.help_text && <p className="text-[13px] text-navy-light/80 font-body">{f.help_text}</p>}
              <PublicField
                field={{ ...f, type: f.field_type, options: f.options ?? undefined } as never}
                value={answers[f.id]}
                onChange={v => setAnswers(a => ({ ...a, [f.id]: v }))}
              />
            </div>
          )
        })}
      </div>

      {error && <p className="rounded-xl bg-coral/5 px-3 py-2 text-[13px] text-coral-deep font-body">{error}</p>}

      <button
        type="button"
        onClick={enviar}
        disabled={enviando}
        className={cn('w-full rounded-full bg-coral px-5 py-3 text-sm text-white transition-colors font-body',
          'hover:bg-coral-deep disabled:opacity-50')}
      >
        {enviando ? <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" aria-hidden /> Enviando…</span> : 'Enviar'}
      </button>
    </main>
  )
}
