// PRE-8: evaluación de la pareja del curso prematrimonial (catálogos con los
// TEXTOS EXACTOS de la spec + validación pura, compartida por el form del
// cierre y el API).
import type { RoleId } from '@/types/auth'

/** Visibilidad de la evaluación (información pastoral sensible): SOLO estos
 *  roles — coordinador_dirigentes puede CERRAR grupos pero no leerla. */
export const PREMAT_EVAL_ROLES: RoleId[] = ['coordinador_estudios', 'direccion', 'admin']

export const COMMITMENT_QUESTION = '¿Sienten que la pareja logró afianzar su compromiso mutuo y con Dios a lo largo del curso?'
export const COMMITMENT_OPTIONS = [
  { value: 'si', label: 'Sí' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'requiere_atencion', label: 'Requiere atención' },
] as const

export const STRENGTHS_QUESTION = '¿Cuáles son las mayores fortalezas o áreas de mayor madurez que observaron en la pareja?'
export const STRENGTH_OPTIONS = [
  'Comunicación y resolución de conflictos',
  'Alineación en principios espirituales y relación con Dios',
  'Claridad y acuerdo en finanzas y metas',
  'Manejo del pasado y familias de origen',
  'Visión compartida sobre la crianza de hijos y roles',
  'Intimidad y expectativas sobre la sexualidad',
] as const

export const TOPICS_QUESTION = '¿En cuál(es) de los 10 temas del curso consideran que la pareja necesita profundizar o seguir trabajando?'
export const TOPIC_OPTIONS = [
  'Relación con Dios',
  'Compromiso matrimonial',
  'Roles en el hogar',
  'Resolución de conflictos',
  'Manejo del pasado',
  'Finanzas / Manejo del dinero',
  'Hijos y crianza',
  'Relación con padres y suegros',
  'Sexualidad e intimidad',
  'Metas y plan de vida juntos',
] as const

export const BLIND_SPOT_QUESTION = '¿Detectaron algún punto ciego, desacuerdo grave o tema no resuelto que pudiera generar fricción en el matrimonio?'
export const OBSERVATIONS_LABEL = 'Observaciones específicas sobre las áreas a trabajar'
export const ACTION_PLAN_LABEL = 'Plan de acción y recomendaciones de mentores'
export const BLESSING_LABEL = 'Bendición final'

export const ACTION_PLAN_OPTIONS = [
  { value: 'listos', label: 'Listos para el matrimonio (cierre regular)' },
  { value: 'consejeria', label: 'Recomendado un tiempo de consejería/mentoría enfocada en un tema específico' },
  { value: 'posponer', label: 'Se sugiere pausar o posponer la fecha de boda para abordar temas críticos' },
] as const

export type PrematEvaluationInput = {
  request_id: string
  commitment: string
  strengths: string[]
  strengths_notes?: string | null
  topics_to_work: string[]
  observations?: string | null
  blind_spot: boolean
  blind_spot_notes?: string | null
  action_plan: string
  blessing?: string | null
}

/** El plan de acción distinto de "listos" deja a la pareja en SEGUIMIENTO
 *  (visible en la cola prematrimonial y en el perfil, solo a PREMAT_EVAL_ROLES). */
export function needsFollowUp(actionPlan: string): boolean {
  return actionPlan !== 'listos'
}

/** Valida una evaluación (null = ok; string = error humano). */
export function validatePrematEvaluation(e: PrematEvaluationInput): string | null {
  if (!e.request_id) return 'Falta la pareja de la evaluación.'
  if (!COMMITMENT_OPTIONS.some(o => o.value === e.commitment)) {
    return 'Respondé la pregunta del compromiso de la pareja.'
  }
  if (!Array.isArray(e.strengths) || e.strengths.some(s => !(STRENGTH_OPTIONS as readonly string[]).includes(s))) {
    return 'Hay fortalezas fuera del catálogo.'
  }
  if (!Array.isArray(e.topics_to_work) || e.topics_to_work.some(t => !(TOPIC_OPTIONS as readonly string[]).includes(t))) {
    return 'Hay temas fuera del catálogo de los 10 temas del curso.'
  }
  if (e.blind_spot && !(e.blind_spot_notes ?? '').trim()) {
    return 'Indicaste que hay un punto ciego o tema no resuelto: describilo brevemente.'
  }
  if (!ACTION_PLAN_OPTIONS.some(o => o.value === e.action_plan)) {
    return 'Seleccioná el plan de acción de los mentores.'
  }
  return null
}
