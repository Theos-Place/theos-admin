import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { planEnviaEncuesta, isSurveyDue } from './study-survey'

const base = {
  survey_enabled: true,
  survey_send_at: '2026-09-20T12:00:00Z',
  feedback_requested_at: null,
  status: 'finalizado',
}
const AHORA = new Date('2026-09-25T12:00:00Z')

describe('EST-17 · el plan decide si se encuesta', () => {
  it('apagado en el plan = no se encuesta, aunque el grupo lo tenga prendido', () => {
    expect(isSurveyDue({ ...base, plan_sends_survey: false }, AHORA)).toBe(false)
    expect(isSurveyDue({ ...base, plan_sends_survey: true }, AHORA)).toBe(true)
  })

  it('hacen falta LOS DOS: apagar el grupo también alcanza para no mandarla', () => {
    // Son preguntas distintas: el plan es la regla, el grupo es la excepción de
    // uno. Si alcanzara con cualquiera de los dos, apagar un plan se podría
    // saltar grupo por grupo sin que nadie lo note.
    expect(isSurveyDue({ ...base, survey_enabled: false, plan_sends_survey: true }, AHORA)).toBe(false)
  })

  it('sin el dato del plan se ASUME que sí', () => {
    // Es lo que devuelve una consulta que no trajo la columna. Quedarse sin
    // encuestas por un select incompleto es un fallo silencioso; de más se ve.
    expect(planEnviaEncuesta(undefined)).toBe(true)
    expect(planEnviaEncuesta(null)).toBe(true)
    expect(planEnviaEncuesta(false)).toBe(false)
    expect(isSurveyDue(base, AHORA)).toBe(true)
  })

  it('lo que ya bloqueaba sigue bloqueando', () => {
    expect(isSurveyDue({ ...base, feedback_requested_at: '2026-09-21T00:00:00Z' }, AHORA)).toBe(false)
    expect(isSurveyDue({ ...base, status: 'en_curso' }, AHORA)).toBe(false)
    expect(isSurveyDue({ ...base, survey_send_at: null }, AHORA)).toBe(false)
    expect(isSurveyDue({ ...base, survey_send_at: '2026-09-30T00:00:00Z' }, AHORA)).toBe(false)
  })
})

/**
 * El cable y —sobre todo— que la regla NO sea una lista de códigos en el
 * código. El ítem lo pedía explícito: «configurable por plan (flag en el
 * catálogo, no hardcode de nombres)». Los planes se archivan, se renombran y
 * se agregan, y un `if (code === 'N1')` obliga a un deploy para algo que la
 * coordinación tiene que poder cambiar sola.
 */
const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('EST-17 · el cable', () => {
  const NOTIFY = 'src/lib/email/leader-feedback-notify.ts'
  const CRON = 'src/app/api/cron/study-surveys/route.ts'

  it('no hay ningún código de nivel escrito en la lógica', () => {
    for (const ruta of [NOTIFY, CRON, 'src/lib/studies/study-survey.ts']) {
      const src = sinComentarios(ruta)
      expect(src, ruta).not.toMatch(/['"]N1['"]/)
      expect(src, ruta).not.toMatch(/['"]N3['"]/)
    }
  })

  it('el cierre NO programa cuando el plan está apagado', () => {
    // Se corta al programar y no al enviar: un grupo que no debe encuestar no
    // tiene por qué quedar con una fecha puesta esperando otro filtro.
    const src = sinComentarios(NOTIFY)
    expect(src).toContain('planEnviaEncuesta')
    const corte = src.indexOf('planEnviaEncuesta(plan?.sends_satisfaction_survey)')
    const escritura = src.indexOf('survey_send_at: cuando')
    expect(corte).toBeGreaterThan(-1)
    expect(corte).toBeLessThan(escritura)
  })

  it('y el cron lo trae DE LA BASE, no solo en el tipo', () => {
    // Un cast no trae datos: la columna tiene que estar en el select.
    const selects = sinComentarios(CRON).match(/\.select\(`[\s\S]*?`\)|\.select\('[^']*'\)/g) ?? []
    expect(selects.some(s => s.includes('sends_satisfaction_survey'))).toBe(true)
  })

  it('la pantalla del plan lo deja cambiar sin un deploy', () => {
    for (const ruta of [
      'src/app/(admin)/estudios/plan/[id]/editar/page.tsx',
      'src/app/(admin)/estudios/plan/nuevo/page.tsx',
    ]) {
      expect(sinComentarios(ruta), ruta).toContain('sends_satisfaction_survey')
    }
    expect(sinComentarios('src/app/api/studies/plans/schema.ts')).toContain('sends_satisfaction_survey')
  })

  it('la migración apaga N1 y N3, y solo esos dos', () => {
    // Discípulos y los demás quedan como estaban: el default es `true` y solo
    // se apagan dos. Una lista de «quiénes sí» habría apagado en silencio los
    // 29 planes del catálogo.
    const sql = readFileSync('supabase/migrations/20260925240000_est17_encuesta_por_plan.sql', 'utf8')
    expect(sql).toMatch(/DEFAULT true/i)
    expect(sql).toMatch(/WHERE code IN \('N1', 'N3'\)/)
  })
})
