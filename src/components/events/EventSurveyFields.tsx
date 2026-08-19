'use client'

// EVE-4 · Qué se envía y cuándo, para la encuesta de satisfacción de un evento.
// Lo comparten el wizard de creación y la pantalla de edición: la programación
// se arma igual en los dos lados.
//
// A QUIÉNES es fijo y se dice acá, no se elige: a quienes hicieron check-in
// (decisión 2026-08-06). Quien no llegó no tiene qué evaluar.
import { useEffect, useState } from 'react'
import { Plus, Users, AlertTriangle } from 'lucide-react'
import { SURVEY_OFFSETS, computeSurveySendAt, surveyScheduleError } from '@/lib/events/survey-schedule'
import { cn } from '@/lib/utils'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'
const labelCls = 'text-[13px] text-navy-light/80 font-display mb-1 block'

export type SurveyFieldsValue = {
  survey_form_id: string | null
  survey_template_id: string | null
  survey_offset_hours: number | null
  survey_send_at: string | null
}

type Opcion = { id: string; label: string }

export function EventSurveyFields({ value, onChange, endsAt }: {
  value: SurveyFieldsValue
  onChange: (patch: Partial<SurveyFieldsValue>) => void
  /** Fin del evento (ISO). Con esto se calcula el momento de las opciones relativas. */
  endsAt: string | null
}) {
  const [forms, setForms] = useState<Opcion[]>([])
  const [templates, setTemplates] = useState<Opcion[]>([])

  useEffect(() => {
    let vivo = true
    fetch('/api/forms')
      .then(r => (r.ok ? r.json() : []))
      .then((rows: Array<{ id: string; title?: string; name?: string; is_active?: boolean }>) => {
        if (!vivo || !Array.isArray(rows)) return
        setForms(rows.filter(f => f.is_active !== false).map(f => ({ id: f.id, label: f.title ?? f.name ?? 'Sin nombre' })))
      })
      .catch(() => {})
    fetch('/api/communications/templates')
      .then(r => (r.ok ? r.json() : []))
      .then((rows: Array<{ id: string; name: string; channel?: string; is_active?: boolean }>) => {
        if (!vivo || !Array.isArray(rows)) return
        setTemplates(rows.filter(t => t.is_active !== false && t.channel !== 'whatsapp').map(t => ({ id: t.id, label: t.name })))
      })
      .catch(() => {})
    return () => { vivo = false }
  }, [])

  const modo: 'form' | 'template' = value.survey_template_id && !value.survey_form_id ? 'template' : 'form'
  const usaFechaExacta = value.survey_offset_hours == null

  const error = surveyScheduleError({
    requires_survey: true,
    target: value.survey_form_id
      ? { kind: 'form', formId: value.survey_form_id }
      : value.survey_template_id
        ? { kind: 'template', templateId: value.survey_template_id }
        : { kind: 'none' },
    sendAt: value.survey_send_at,
    endsAt,
  })

  function elegirOffset(hours: number | null) {
    if (hours == null) {
      onChange({ survey_offset_hours: null })  // pasa a fecha exacta
      return
    }
    onChange({ survey_offset_hours: hours, survey_send_at: computeSurveySendAt(endsAt, hours) })
  }

  return (
    <div className="space-y-4 pl-14">
      {/* QUÉ se envía */}
      <div className="space-y-2">
        <span className={labelCls}>Qué se envía</span>
        <div className="flex gap-2">
          {(['form', 'template'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => onChange(m === 'form'
                ? { survey_template_id: null }
                : { survey_form_id: null })}
              className={cn('rounded-full px-3 py-1.5 text-[13px] transition-colors font-body border',
                modo === m
                  ? 'bg-navy text-white border-navy'
                  : 'border-[var(--outline-variant)] text-navy-light hover:bg-surface-low')}
            >
              {m === 'form' ? 'Un formulario' : 'Una plantilla de correo'}
            </button>
          ))}
        </div>

        {modo === 'form' ? (
          <div className="flex items-end gap-2 flex-wrap">
            <div className="flex-1 min-w-[220px]">
              <label className={labelCls} htmlFor="survey-form">Formulario de la encuesta</label>
              <select
                id="survey-form"
                className={inputCls}
                value={value.survey_form_id ?? ''}
                onChange={e => onChange({ survey_form_id: e.target.value || null, survey_template_id: null })}
              >
                <option value="">Elegí un formulario…</option>
                {forms.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
            <a href="/formularios/nuevo" target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
              <Plus size={13} /> Crear encuesta
            </a>
          </div>
        ) : (
          <div>
            <label className={labelCls} htmlFor="survey-template">Plantilla de correo</label>
            <select
              id="survey-template"
              className={inputCls}
              value={value.survey_template_id ?? ''}
              onChange={e => onChange({ survey_template_id: e.target.value || null, survey_form_id: null })}
            >
              <option value="">Elegí una plantilla…</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* CUÁNDO se envía */}
      <div className="space-y-2">
        <span className={labelCls}>Cuándo se envía</span>
        <div className="flex flex-wrap gap-2">
          {SURVEY_OFFSETS.map(o => (
            <button
              key={o.hours}
              type="button"
              onClick={() => elegirOffset(o.hours)}
              className={cn('rounded-full px-3 py-1.5 text-[13px] transition-colors font-body border',
                value.survey_offset_hours === o.hours
                  ? 'bg-coral text-white border-coral'
                  : 'border-[var(--outline-variant)] text-navy-light hover:bg-surface-low')}
            >
              {o.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => elegirOffset(null)}
            className={cn('rounded-full px-3 py-1.5 text-[13px] transition-colors font-body border',
              usaFechaExacta
                ? 'bg-coral text-white border-coral'
                : 'border-[var(--outline-variant)] text-navy-light hover:bg-surface-low')}
          >
            Fecha y hora exactas
          </button>
        </div>

        {usaFechaExacta && (
          <div className="max-w-[260px]">
            <label className={labelCls} htmlFor="survey-send-at">Fecha y hora del envío</label>
            <input
              id="survey-send-at"
              type="datetime-local"
              className={inputCls}
              value={value.survey_send_at ? toLocalInput(value.survey_send_at) : ''}
              onChange={e => onChange({
                survey_send_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                survey_offset_hours: null,
              })}
            />
          </div>
        )}

        {value.survey_send_at && !error && (
          <p className="text-[13px] text-navy-light/80 font-body">
            Se enviará el <strong className="text-navy">{formatoLargo(value.survey_send_at)}</strong>.
          </p>
        )}
      </div>

      {/* A QUIÉNES — fijo, pero visible */}
      <p className="flex items-start gap-1.5 text-[13px] text-navy-light/80 font-body">
        <Users size={13} className="mt-0.5 shrink-0" />
        <span>Se le manda a <strong className="text-navy">quienes hicieron check-in</strong>. Quien se inscribió y no llegó no la recibe.</span>
      </p>

      {error && (
        <p className="flex items-start gap-1.5 text-[13px] text-coral font-body" role="alert">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}

/** ISO → valor de <input type="datetime-local"> en hora local del navegador. */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function formatoLargo(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('es-CR', {
    weekday: 'long', day: 'numeric', month: 'long',
    hour: 'numeric', minute: '2-digit', timeZone: 'America/Costa_Rica',
  })
}
