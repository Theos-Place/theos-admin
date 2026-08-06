// EVE-4 · Cuándo se manda la encuesta de satisfacción de un evento, y si ya toca.
//
// Puro (sin Supabase ni Date.now escondido): lo usan la pantalla del evento, el
// endpoint que guarda y el cron. `now` siempre se inyecta.
//
// LA REGLA Y EL MOMENTO SE GUARDAN LOS DOS. La regla ("3 días después") es lo
// que se ve y se edita; el momento CALCULADO es lo que mira el cron. Si se
// guardara solo la regla habría que recalcularla en cada corrida contra un
// ends_at que puede haber cambiado, y el envío dejaría de ser predecible.

export const SURVEY_OFFSETS = [
  { hours: 2, label: '2 horas después de que termine' },
  { hours: 24, label: 'Al día siguiente' },
  { hours: 72, label: '3 días después' },
  { hours: 168, label: 'Una semana después' },
] as const

export type SurveyOffsetHours = (typeof SURVEY_OFFSETS)[number]['hours']

/** Qué se manda. Uno de los dos, nunca los dos (lo enforcea un CHECK). */
export type SurveyTarget =
  | { kind: 'form'; formId: string }
  | { kind: 'template'; templateId: string }
  | { kind: 'none' }

export type SurveyPlan = {
  requires_survey: boolean
  survey_form_id: string | null
  survey_template_id: string | null
  survey_offset_hours: number | null
  survey_send_at: string | null
  survey_sent_at: string | null
}

export function surveyTarget(plan: Pick<SurveyPlan, 'survey_form_id' | 'survey_template_id'>): SurveyTarget {
  if (plan.survey_form_id) return { kind: 'form', formId: plan.survey_form_id }
  if (plan.survey_template_id) return { kind: 'template', templateId: plan.survey_template_id }
  return { kind: 'none' }
}

/** El momento del envío a partir de la regla. Devuelve ISO, o null si no se
 *  puede calcular (evento sin fecha de fin). */
export function computeSurveySendAt(endsAt: string | null | undefined, offsetHours: number): string | null {
  if (!endsAt) return null
  const fin = new Date(endsAt)
  if (Number.isNaN(fin.getTime())) return null
  return new Date(fin.getTime() + offsetHours * 3_600_000).toISOString()
}

/** Motivo por el que la programación NO es válida, o null si está bien.
 *  Se usa igual en la UI (para avisar antes) y en el endpoint (para el 400). */
export function surveyScheduleError(input: {
  requires_survey: boolean
  target: SurveyTarget
  sendAt: string | null
  endsAt: string | null
}): string | null {
  if (!input.requires_survey) return null
  if (input.target.kind === 'none') {
    return 'Elegí qué se envía: un formulario o una plantilla de correo.'
  }
  if (!input.sendAt) {
    return 'Elegí cuándo se envía la encuesta.'
  }
  const envio = new Date(input.sendAt)
  if (Number.isNaN(envio.getTime())) return 'La fecha de envío no es válida.'
  if (input.endsAt) {
    const fin = new Date(input.endsAt)
    if (!Number.isNaN(fin.getTime()) && envio.getTime() <= fin.getTime()) {
      return 'La encuesta tiene que enviarse DESPUÉS de que termine el evento.'
    }
  }
  return null
}

/** ¿A este evento ya le toca la encuesta? Es la condición exacta del cron.
 *  Un evento cancelado no manda encuesta: no hubo nada que evaluar. */
export function isSurveyDue(
  plan: SurveyPlan & { status?: string | null },
  now: Date,
): boolean {
  if (!plan.requires_survey) return false
  if (plan.survey_sent_at) return false                       // dedupe
  if (surveyTarget(plan).kind === 'none') return false
  if (plan.status === 'cancelled' || plan.status === 'archived') return false
  if (!plan.survey_send_at) return false
  const envio = new Date(plan.survey_send_at)
  return !Number.isNaN(envio.getTime()) && envio.getTime() <= now.getTime()
}

export type SurveyStatus =
  | { kind: 'sin_encuesta' }
  | { kind: 'incompleta'; motivo: string }
  | { kind: 'programada'; sendAt: string }
  | { kind: 'enviada'; sentAt: string; sent: number; responses: number }

/** Estado de la encuesta para la ficha del evento. */
export function surveyStatus(
  plan: SurveyPlan & { status?: string | null; survey_sent_count?: number | null },
  counts?: { responses?: number },
): SurveyStatus {
  if (!plan.requires_survey) return { kind: 'sin_encuesta' }
  if (plan.survey_sent_at) {
    return {
      kind: 'enviada',
      sentAt: plan.survey_sent_at,
      sent: plan.survey_sent_count ?? 0,
      responses: counts?.responses ?? 0,
    }
  }
  const error = surveyScheduleError({
    requires_survey: true,
    target: surveyTarget(plan),
    sendAt: plan.survey_send_at,
    endsAt: null,   // acá solo interesa que esté completa, no re-validar fechas
  })
  if (error) return { kind: 'incompleta', motivo: error }
  return { kind: 'programada', sendAt: plan.survey_send_at! }
}
