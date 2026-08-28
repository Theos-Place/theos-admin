// EVE-4 · Programación de la encuesta de satisfacción.
//
// Lo que se fija: que un evento SIN encuesta se comporte igual que siempre, que
// una programada a futuro no se mande antes de tiempo, y que el cron no reenvíe.
import { describe, it, expect } from 'vitest'
import {
  computeSurveySendAt, surveyScheduleError, isSurveyDue, surveyStatus,
  surveyTarget, SURVEY_OFFSETS,
} from './survey-schedule'
import { formToSurvey } from '@/lib/events/form-mapper'

const FIN = '2026-09-10T02:00:00.000Z'   // el evento termina

const BASE = {
  requires_survey: true,
  survey_form_id: 'form-1' as string | null,
  survey_template_id: null as string | null,
  survey_offset_hours: 24 as number | null,
  survey_send_at: null as string | null,
  survey_sent_at: null as string | null,
}

describe('computeSurveySendAt', () => {
  it('suma las horas al fin del evento', () => {
    expect(computeSurveySendAt(FIN, 2)).toBe('2026-09-10T04:00:00.000Z')
    expect(computeSurveySendAt(FIN, 24)).toBe('2026-09-11T02:00:00.000Z')
    expect(computeSurveySendAt(FIN, 72)).toBe('2026-09-13T02:00:00.000Z')
  })

  it('sin fecha de fin no se puede calcular', () => {
    expect(computeSurveySendAt(null, 24)).toBeNull()
    expect(computeSurveySendAt('no es fecha', 24)).toBeNull()
  })

  it('las opciones ofrecidas son todas posteriores al evento', () => {
    for (const o of SURVEY_OFFSETS) expect(o.hours).toBeGreaterThan(0)
  })
})

describe('validación de la programación', () => {
  const ok = { requires_survey: true, target: { kind: 'form' as const, formId: 'f' }, sendAt: '2026-09-11T02:00:00.000Z', endsAt: FIN }

  it('una programación completa pasa', () => {
    expect(surveyScheduleError(ok)).toBeNull()
  })

  it('sin encuesta no valida nada', () => {
    expect(surveyScheduleError({ ...ok, requires_survey: false, target: { kind: 'none' }, sendAt: null })).toBeNull()
  })

  it('exige elegir qué se envía', () => {
    expect(surveyScheduleError({ ...ok, target: { kind: 'none' } })).toMatch(/qué se envía/i)
  })

  it('exige elegir cuándo', () => {
    expect(surveyScheduleError({ ...ok, sendAt: null })).toMatch(/cuándo/i)
  })

  it('el envío tiene que ser DESPUÉS de que termine el evento', () => {
    expect(surveyScheduleError({ ...ok, sendAt: '2026-09-09T02:00:00.000Z' })).toMatch(/después/i)
    // Justo al terminar tampoco: la gente todavía está ahí.
    expect(surveyScheduleError({ ...ok, sendAt: FIN })).toMatch(/después/i)
  })
})

describe('isSurveyDue — la condición exacta del cron', () => {
  const ENVIO = '2026-09-11T02:00:00.000Z'
  const plan = { ...BASE, survey_send_at: ENVIO }

  it('un evento SIN encuesta nunca entra', () => {
    expect(isSurveyDue({ ...plan, requires_survey: false }, new Date('2027-01-01'))).toBe(false)
  })

  it('programada a futuro NO se manda antes de tiempo', () => {
    expect(isSurveyDue(plan, new Date('2026-09-10T12:00:00Z'))).toBe(false)
  })

  it('llegado el momento, sí', () => {
    expect(isSurveyDue(plan, new Date(ENVIO))).toBe(true)
    expect(isSurveyDue(plan, new Date('2026-09-12T00:00:00Z'))).toBe(true)
  })

  it('YA ENVIADA no se reenvía — este es el dedupe del cron', () => {
    const enviada = { ...plan, survey_sent_at: '2026-09-11T02:05:00.000Z' }
    expect(isSurveyDue(enviada, new Date('2026-09-30T00:00:00Z'))).toBe(false)
  })

  it('sin destino no se manda (quedaría un correo sin encuesta adentro)', () => {
    expect(isSurveyDue({ ...plan, survey_form_id: null, survey_template_id: null }, new Date('2026-09-30'))).toBe(false)
  })

  it('un evento cancelado no manda encuesta: no hubo qué evaluar', () => {
    expect(isSurveyDue({ ...plan, status: 'cancelled' }, new Date('2026-09-30'))).toBe(false)
    expect(isSurveyDue({ ...plan, status: 'archived' }, new Date('2026-09-30'))).toBe(false)
  })

  it('sin momento calculado no entra', () => {
    expect(isSurveyDue({ ...plan, survey_send_at: null }, new Date('2027-01-01'))).toBe(false)
  })
})

describe('surveyTarget — uno u otro, nunca los dos', () => {
  it('el formulario manda si están los dos', () => {
    expect(surveyTarget({ survey_form_id: 'f', survey_template_id: 't' })).toEqual({ kind: 'form', formId: 'f' })
  })
  it('plantilla', () => {
    expect(surveyTarget({ survey_form_id: null, survey_template_id: 't' })).toEqual({ kind: 'template', templateId: 't' })
  })
  it('nada', () => {
    expect(surveyTarget({ survey_form_id: null, survey_template_id: null })).toEqual({ kind: 'none' })
  })
})

describe('estado para la ficha del evento', () => {
  it('sin encuesta', () => {
    expect(surveyStatus({ ...BASE, requires_survey: false }).kind).toBe('sin_encuesta')
  })
  it('programada', () => {
    const st = surveyStatus({ ...BASE, survey_send_at: '2026-09-11T02:00:00.000Z' })
    expect(st).toEqual({ kind: 'programada', sendAt: '2026-09-11T02:00:00.000Z' })
  })
  it('incompleta cuando falta el destino', () => {
    const st = surveyStatus({ ...BASE, survey_form_id: null, survey_send_at: '2026-09-11T02:00:00.000Z' })
    expect(st.kind).toBe('incompleta')
  })
  it('enviada, con cuántos y cuántas respuestas', () => {
    const st = surveyStatus(
      { ...BASE, survey_send_at: '2026-09-11T02:00:00.000Z', survey_sent_at: '2026-09-11T02:01:00.000Z', survey_sent_count: 42 },
      { responses: 17 },
    )
    expect(st).toEqual({ kind: 'enviada', sentAt: '2026-09-11T02:01:00.000Z', sent: 42, responses: 17 })
  })
})

describe('mapeo del formulario del evento', () => {
  const cuerpo = {
    end_date: '2026-09-09', end_time: '20:00',
    has_satisfaction_survey: true,
    survey_form_id: 'form-1',
    survey_offset_hours: 24,
  }

  it('guarda la regla Y el momento calculado, en hora de Costa Rica', () => {
    // El fin del evento son las 20:00 DE COSTA RICA. La zona va explícita en el
    // valor esperado, igual que en combineDateTime: antes decía
    // `new Date('2026-09-09T20:00')` —sin zona, o sea hora local de la máquina—
    // y el test pasaba en verde acá y fallaba en CI, que corre en UTC. Es el
    // mismo defecto que se arregló en el mapper: comparar contra la zona de
    // quien corre el test no prueba nada.
    const finEnCR = new Date('2026-09-09T20:00:00-06:00').toISOString()
    const out = formToSurvey(cuerpo)
    expect(out.survey_offset_hours).toBe(24)
    expect(out.survey_send_at).toBe(computeSurveySendAt(finEnCR, 24))
    // Y el valor absoluto, para que no se pueda "arreglar" moviendo las dos
    // puntas a la vez: 20:00 CR + 24 h = 2026-09-11T02:00Z.
    expect(out.survey_send_at).toBe('2026-09-11T02:00:00.000Z')
  })

  it('apagar la encuesta LIMPIA la programación guardada', () => {
    // Si no, quedaría un envío esperando en la base para un evento sin encuesta.
    const out = formToSurvey({ ...cuerpo, has_satisfaction_survey: false })
    expect(out.survey_form_id).toBeNull()
    expect(out.survey_template_id).toBeNull()
    expect(out.survey_send_at).toBeNull()
    expect(out.survey_offset_hours).toBeNull()
  })

  it('no guarda formulario Y plantilla a la vez (lo prohíbe el CHECK)', () => {
    const out = formToSurvey({ ...cuerpo, survey_template_id: 'tpl-1' })
    expect(out.survey_form_id).toBe('form-1')
    expect(out.survey_template_id).toBeNull()
  })

  it('con plantilla sola, se guarda la plantilla', () => {
    const out = formToSurvey({ ...cuerpo, survey_form_id: '', survey_template_id: 'tpl-1' })
    expect(out.survey_form_id).toBeNull()
    expect(out.survey_template_id).toBe('tpl-1')
  })

  it('fecha exacta: sin regla, con momento', () => {
    const out = formToSurvey({
      ...cuerpo, survey_offset_hours: '', survey_send_at: '2026-09-15T15:00:00.000Z',
    })
    expect(out.survey_offset_hours).toBeNull()
    expect(out.survey_send_at).toBe('2026-09-15T15:00:00.000Z')
  })

  it('el formulario de inscripción es independiente de la encuesta', () => {
    const out = formToSurvey({ has_satisfaction_survey: false, registration_form_id: 'reg-1' })
    expect(out.registration_form_id).toBe('reg-1')
  })
})
